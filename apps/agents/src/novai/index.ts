import { AIMessage } from '@langchain/core/messages';
import { ExaRetriever } from '@langchain/exa';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { END, START, StateGraph } from '@langchain/langgraph';
import {
  GameEngineService,
  type GameState,
  LLMService,
} from '@workspace/engine';
import ExaClient from 'exa-js';
import z from 'zod';
import { getModelConfig, getModelFromConfig } from '../utils.js';
import { getOrCreateSession } from './persistence';
import {
  BG3_CAMPAIGN_GUARDRAILS,
  BG3_CANON_QUERY_HINT,
  BG3_RULESET_PROMPT,
} from './prompts.js';
import { saveChapter } from './saveChapter';
import { Bg3GraphAnnotation } from './state.js';
import { querySimilarChapters } from './vector';

type Bg3State = typeof Bg3GraphAnnotation.State;

// Reuse the Open Canvas style artifact tool schema for compatibility with the Canvas UI
const BG3_ARTIFACT_TOOL_SCHEMA = z.object({
  type: z
    .enum(['code', 'text'])
    .describe('The content type of the artifact generated.'),
  language: z
    .enum([
      'typescript',
      'javascript',
      'cpp',
      'java',
      'php',
      'python',
      'html',
      'sql',
      'json',
      'rust',
      'xml',
      'clojure',
      'csharp',
      'other',
    ])
    .optional()
    .describe(
      "The language/programming language of the artifact generated. If generating code, it should be one of the options, or 'other'. If not generating code, the language should ALWAYS be 'other'."
    ),
  isValidReact: z
    .boolean()
    .optional()
    .describe(
      'Whether or not the generated code is valid React code. Only populate this field if generating code.'
    ),
  artifact: z.string().describe('The content of the artifact to generate.'),
  title: z
    .string()
    .describe(
      'A short title to give to the artifact. Should be less than 5 words.'
    ),
});

// Extracts the latest user message text from mixed message shapes
function getLatestUserText(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as {
      role?: string;
      content?: unknown;
      kwargs?: { content?: unknown; type?: string };
      getType?: () => string;
      _getType?: () => string;
      type?: string;
    };
    try {
      const type =
        (typeof msg?.getType === 'function' && msg.getType()) ||
        (typeof msg?._getType === 'function' && msg._getType()) ||
        msg?.type ||
        msg?.kwargs?.type;
      if (type === 'human' || msg?.role === 'user') {
        if (
          Array.isArray(msg?.content) &&
          (msg.content[0] as { type?: string; text?: unknown })?.type === 'text'
        ) {
          return String((msg.content[0] as { text?: unknown }).text || '');
        }
        if (typeof msg?.content === 'string') {
          return msg.content;
        }
        if (typeof msg?.kwargs?.content === 'string') {
          return msg.kwargs.content;
        }
      }
    } catch {
      // continue scanning
    }
  }
  return '';
}

async function loadOrInitSession(
  state: Bg3State,
  config: LangGraphRunnableConfig
): Promise<Bg3State> {
  const userId = config.configurable?.supabase_user_id as string | undefined;
  const threadId =
    (config.configurable?.thread_id as string | undefined) ||
    (config.configurable?.threadId as string | undefined);
  const campaignId =
    (config.configurable?.campaign_id as string | undefined) ||
    'baldurs-gate-3';
  const playerName =
    (config.configurable?.player_name as string | undefined) || 'Traveler';

  if (!userId) {
    throw new Error('Missing supabase_user_id in configurable');
  }
  if (!threadId) {
    throw new Error('Missing thread_id in configurable');
  }

  const engineLLMConfig = (() => {
    if (process.env.LOCAL_LLM_URL) {
      return {
        provider: 'local' as const,
        apiKey: undefined,
        baseUrl: process.env.LOCAL_LLM_URL,
        model:
          process.env.LOCAL_LLM_MODEL ||
          process.env.OPENAI_MODEL ||
          'gpt-4o-mini',
      };
    }
    try {
      const { modelProvider, modelName, apiKey, baseUrl } =
        getModelConfig(config);
      if (
        modelProvider === 'openai' &&
        (apiKey || process.env.OPENAI_API_KEY)
      ) {
        return {
          provider: 'openai' as const,
          apiKey: apiKey || process.env.OPENAI_API_KEY,
          baseUrl,
          model: modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        };
      }
    } catch {
      // ignore and fallback below
    }
    return {
      provider: 'openai' as const,
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: undefined,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  })();

  const engine = new GameEngineService(engineLLMConfig);

  const { sessionId, gameState } = await getOrCreateSession({
    threadId,
    userId,
    campaignId,
    playerName,
    engine,
  });

  return {
    ...state,
    sessionId,
    gameState,
  };
}

async function runTurn(
  state: Bg3State,
  config: LangGraphRunnableConfig
): Promise<Bg3State> {
  // Build engine config up-front as we may need it for session recovery
  const engineLLMConfig2 = (() => {
    if (process.env.LOCAL_LLM_URL) {
      return {
        provider: 'local' as const,
        apiKey: undefined,
        baseUrl: process.env.LOCAL_LLM_URL,
        model:
          process.env.LOCAL_LLM_MODEL ||
          process.env.OPENAI_MODEL ||
          'gpt-4o-mini',
      };
    }
    try {
      const { modelProvider, modelName, apiKey, baseUrl } =
        getModelConfig(config);
      if (
        modelProvider === 'openai' &&
        (apiKey || process.env.OPENAI_API_KEY)
      ) {
        return {
          provider: 'openai' as const,
          apiKey: apiKey || process.env.OPENAI_API_KEY,
          baseUrl,
          model: modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        };
      }
    } catch {
      // ignore and fallback below
    }
    return {
      provider: 'openai' as const,
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: undefined,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  })();
  const engine = new GameEngineService(engineLLMConfig2);

  // Attempt to recover a missing gameState by reloading/creating the session
  let currentGameState = state.gameState;
  let effectiveSessionId = state.sessionId as string | undefined;
  if (!currentGameState) {
    const userId = config.configurable?.supabase_user_id as string | undefined;
    const threadId =
      (config.configurable?.thread_id as string | undefined) ||
      (config.configurable?.threadId as string | undefined);
    const campaignId =
      (config.configurable?.campaign_id as string | undefined) ||
      'baldurs-gate-3';
    const playerName =
      (config.configurable?.player_name as string | undefined) || 'Traveler';

    if (!userId || !threadId) {
      throw new Error('gameState missing in state');
    }

    const { sessionId, gameState } = await getOrCreateSession({
      threadId,
      userId,
      campaignId,
      playerName,
      engine,
    });

    // Track session id locally for downstream use
    effectiveSessionId = sessionId;
    currentGameState = gameState;
  }
  const playerInput = Array.isArray(state.messages)
    ? getLatestUserText(state.messages as unknown[])
    : '';

  // Retrieve relevant chapter memory and optional canon web context, pass as context
  const threadId =
    (config.configurable?.thread_id as string | undefined) ||
    (config.configurable?.threadId as string | undefined);
  let memoryNote: string | undefined;
  if (threadId) {
    const similar = await querySimilarChapters({
      threadId,
      query: playerInput,
      topK: 3,
    });
    if (similar.length > 0) {
      const bullets = similar
        .map(
          (m) =>
            `- ${m.metadata?.title || m.id}: ${(m.metadata?.summary || '').slice(0, 200)}`
        )
        .join('\n');
      memoryNote = `Relevant prior chapters\n${bullets}`;
    }
  }

  // Optional: lightweight canon retrieval via web search (Exa)
  let webCanonNote: string | undefined;
  const webSearchEnabled = Boolean(
    (config.configurable as Record<string, unknown> | undefined)
      ?.web_search_enabled
  );
  if (webSearchEnabled && process.env.EXA_API_KEY) {
    try {
      const exaClient = new ExaClient(process.env.EXA_API_KEY);
      const retriever = new ExaRetriever({
        client: exaClient,
        searchArgs: { filterEmptyResults: true, numResults: 5 },
      });
      // Build a BG3-focused query to stabilize pacing/timeline
      const queryHints: string[] = [];
      if (currentGameState?.currentLocation) {
        queryHints.push(`location:${currentGameState.currentLocation}`);
      }
      if (currentGameState?.companions?.length) {
        queryHints.push(
          `companions:${currentGameState.companions.slice(0, 3).join(',')}`
        );
      }
      const canonQuery = [
        BG3_CANON_QUERY_HINT,
        playerInput.slice(0, 160),
        queryHints.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
      const results = await retriever.invoke(canonQuery);
      const top =
        (
          results as unknown as Array<{
            pageContent?: string;
            metadata?: { title?: string; url?: string };
          }>
        )?.slice(0, 3) || [];
      if (top.length) {
        const bullets = top
          .map((d) => {
            const title = d?.metadata?.title || d?.metadata?.url || 'result';
            const snippet = String(d?.pageContent || '')
              .replace(/\s+/g, ' ')
              .slice(0, 220);
            return `- ${title}: ${snippet}`;
          })
          .join('\n');
        webCanonNote = `Canon references (web):\n${bullets}`;
      }
    } catch {
      // Ignore web retrieval errors and proceed
    }
  }

  const response = await engine.processGameRequest({
    gameState: currentGameState,
    playerInput,
    context:
      memoryNote || webCanonNote
        ? {
            chapterMemory: memoryNote,
            webCanon: webCanonNote,
            ruleset: BG3_RULESET_PROMPT,
            guardrails: BG3_CAMPAIGN_GUARDRAILS,
          }
        : { ruleset: BG3_RULESET_PROMPT, guardrails: BG3_CAMPAIGN_GUARDRAILS },
  });

  return {
    ...state,
    output: {
      narration: response.narration,
      choices: response.choices,
      statCheck: response.statCheck,
      combat: response.combat,
    },
    gameState: response.updatedGameState,
    sessionId:
      effectiveSessionId ||
      state.sessionId ||
      (config.configurable?.bg3_session_id as string | undefined),
    // Let the MessagesAnnotation reducer append this AI message to the history
    messages: [new AIMessage(response.narration)],
  };
}

// Stream a text artifact compatible with the Canvas UI from the BG3 narration
async function generateArtifact(
  state: Bg3State,
  config: LangGraphRunnableConfig
): Promise<Bg3State> {
  if (!state.output || !state.gameState) {
    return state;
  }

  const toolCallingModel = await getModelFromConfig(config, {
    temperature: 0.5,
    isToolCalling: true,
  });
  const modelWithTool = toolCallingModel.bindTools(
    [
      {
        name: 'generate_artifact',
        description: 'Generate a text artifact to render in the Canvas UI',
        schema: BG3_ARTIFACT_TOOL_SCHEMA,
      },
    ],
    { tool_choice: 'generate_artifact' }
  );

  const { narration } = state.output;
  const { playerName, currentLocation, companions } = state.gameState;

  const system = `You are an expert fiction editor adapting tabletop RPG session logs into a serialized web novel chapter.
Requirements:
- Remove or translate any explicit game mechanics (e.g., DC checks, dice rolls, turn order, combat rounds) into immersive prose.
- Maintain continuity with provided context and incorporate outcomes of checks and combat as narrative consequences, not mechanics.
- Write in a clean, engaging web novel style with proper paragraphs.
- Do not include bullet lists or numbered choices in the final chapter.
- When you are ready, call the tool 'generate_artifact' with fields: type='text', language='other', title (short, catchy), artifact (the full chapter text).`;

  const contextBits: string[] = [];
  if (state.output.statCheck) {
    const { stat, difficulty, success } = state.output.statCheck;
    contextBits.push(
      `StatCheck: ${stat} vs DC ${difficulty} → ${success ? 'success' : 'failure'}`
    );
  }
  if (state.output.combat) {
    const { enemies } = state.output.combat;
    contextBits.push(`Combat: ${enemies.join(', ')}`);
  }

  const user = `GAME CONTEXT\nPlayer: ${playerName}\nLocation: ${currentLocation}\nCompanions: ${companions?.join(', ') || 'None'}\n${
    contextBits.length ? `Notes: ${contextBits.join(' | ')}` : ''
  }\n\nRAW NARRATION\n${narration}`;

  // Invoke with runName so the client can parse as the 'generateArtifact' node
  const response = await modelWithTool.invoke(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { runName: 'generate_artifact' }
  );

  // Also set the artifact in state at the end (for non-streaming models / persistence)
  const args = response.tool_calls?.[0]?.args as
    | z.infer<typeof BG3_ARTIFACT_TOOL_SCHEMA>
    | undefined;
  if (!args) {
    return state;
  }
  return {
    ...state,
    artifact: {
      currentIndex: 1,
      contents: [
        {
          index: 1,
          type: 'text',
          title: args.title,
          fullMarkdown: args.artifact,
        },
      ],
    },
  } as Bg3State;
}

async function persistAndReturn(state: Bg3State): Promise<Bg3State> {
  // No-op persistence here; saving is handled by the explicit saveChapter action
  return state;
}

function routeStart(state: Bg3State): 'saveChapter' | 'loadOrInitSession' {
  return state.saveChapter ? 'saveChapter' : 'loadOrInitSession';
}

const builder = new StateGraph(Bg3GraphAnnotation)
  .addNode('loadOrInitSession', loadOrInitSession)
  .addNode('runTurn', runTurn)
  .addNode('generateArtifact', generateArtifact)
  .addNode('persistAndReturn', persistAndReturn)
  .addNode('saveChapter', saveChapter)
  .addNode('routeStart', async (s: Bg3State) => s)
  .addEdge(START, 'routeStart')
  .addConditionalEdges('routeStart', routeStart, [
    'saveChapter',
    'loadOrInitSession',
  ])
  .addEdge('loadOrInitSession', 'runTurn')
  .addEdge('runTurn', 'generateArtifact')
  .addEdge('generateArtifact', 'persistAndReturn')
  .addEdge('persistAndReturn', END);

export const graph = builder.compile().withConfig({ runName: 'novai' });
