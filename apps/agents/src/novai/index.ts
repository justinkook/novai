import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { Command, END, Send, START, StateGraph } from '@langchain/langgraph';
import { GameEngineService } from '@workspace/engine';
import { DEFAULT_INPUTS } from '@workspace/shared/constants';
import z from 'zod';
import {
  createAIMessageFromWebResults,
  getModelConfig,
  getModelFromConfig,
} from '../utils.js';
import { graph as webSearchGraph } from '../web-search/index.js';
import { customAction } from './nodes/customAction.js';
import { generateArtifact } from './nodes/generate-artifact/index.js';
import { generatePath } from './nodes/generate-path/index.js';
import { generateFollowup } from './nodes/generateFollowup.js';
import { generateTitleNode } from './nodes/generateTitle.js';
import { reflectNode } from './nodes/reflect.js';
import { replyToGeneralInput } from './nodes/replyToGeneralInput.js';
import { rewriteArtifact } from './nodes/rewrite-artifact/index.js';
import { rewriteArtifactTheme } from './nodes/rewriteArtifactTheme.js';
import { rewriteCodeArtifactTheme } from './nodes/rewriteCodeArtifactTheme.js';
import { saveChapterNode } from './nodes/saveChapter.js';
import { summarizer } from './nodes/summarizer.js';
import { updateArtifact } from './nodes/updateArtifact.js';
import { updateHighlightedText } from './nodes/updateHighlightedText.js';
import { getOrCreateSession } from './persistence.js';
import { BG3_CAMPAIGN_GUARDRAILS, BG3_RULESET_PROMPT } from './prompts.js';
import { NovaiGraphAnnotation, type NovaiGraphState } from './state.js';
import { querySimilarChapters } from './vector.js';

const routeNode = (state: typeof NovaiGraphAnnotation.State) => {
  if (!state.next) {
    throw new Error("'next' state field not set.");
  }

  return new Send(state.next, {
    ...state,
  });
};

const cleanState = (_: typeof NovaiGraphAnnotation.State) => {
  return {
    ...DEFAULT_INPUTS,
  };
};

// ~ 4 chars per token, max tokens of 75000. 75000 * 4 = 300000
const CHARACTER_MAX = 300000;

function simpleTokenCalculator(
  state: typeof NovaiGraphAnnotation.State
): 'summarizer' | typeof END {
  const totalChars = state._messages.reduce((acc: number, msg: BaseMessage) => {
    if (typeof msg.content !== 'string') {
      const contentArray = msg.content as Array<{ text?: string }>;
      const allContent = contentArray.flatMap((c) =>
        typeof c?.text === 'string' ? c.text : []
      );
      const innerCount = allContent.reduce(
        (innerAcc: number, c: string) => innerAcc + c.length,
        0
      );
      return acc + innerCount;
    }
    return acc + (msg.content as string).length;
  }, 0);

  if (totalChars > CHARACTER_MAX) {
    return 'summarizer';
  }
  return END;
}

/**
 * Conditionally route to the "generateTitle" node if there are only
 * two messages in the conversation. This node generates a concise title
 * for the conversation which is displayed in the thread history.
 */
const conditionallyGenerateTitle = (
  state: typeof NovaiGraphAnnotation.State
): 'generateTitle' | 'summarizer' | typeof END => {
  if (state.messages.length > 2) {
    // Do not generate if there are more than two messages (meaning it's not the first human-AI conversation)
    return simpleTokenCalculator(state);
  }
  return 'generateTitle';
};

/**
 * Updates state & routes the graph based on whether or not the web search
 * graph returned any results.
 */
function routePostWebSearch(
  state: typeof NovaiGraphAnnotation.State
): Send | Command {
  // If there is more than one artifact, then route to the "rewriteArtifact" node. Otherwise, generate the artifact.
  const includesArtifacts = state.artifact?.contents?.length > 1;
  if (!state.webSearchResults?.length) {
    return new Send(
      includesArtifacts ? 'rewriteArtifact' : 'generateArtifact',
      {
        ...state,
        webSearchEnabled: false,
      }
    );
  }

  // This message is used as a way to reference the web search results in future chats.
  const webSearchResultsMessage = createAIMessageFromWebResults(
    state.webSearchResults
  );

  return new Command({
    goto: includesArtifacts ? 'rewriteArtifact' : 'generateArtifact',
    update: {
      webSearchEnabled: false,
      messages: [webSearchResultsMessage],
      _messages: [webSearchResultsMessage],
    },
  });
}

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
  state: NovaiGraphState,
  config: LangGraphRunnableConfig
): Promise<NovaiGraphState> {
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
  state: NovaiGraphState,
  config: LangGraphRunnableConfig
): Promise<NovaiGraphState> {
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

  const response = await engine.processGameRequest({
    gameState: currentGameState,
    playerInput,
    context: memoryNote
      ? {
          chapterMemory: memoryNote,
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

// Stream a text artifact compatible with the Canvas UI from the Novai narration
async function novaiGenerateArtifact(
  state: NovaiGraphState,
  config: LangGraphRunnableConfig
): Promise<NovaiGraphState> {
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

  const user = `GAME CONTEXT\nPlayer: ${playerName}\nLocation: ${currentLocation}\nCompanions: ${
    companions?.join(', ') || 'None'
  }\n${contextBits.length ? `Notes: ${contextBits.join(' | ')}` : ''}\n\nRAW NARRATION\n${narration}`;

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
  } as NovaiGraphState;
}

async function persistAndReturn(
  state: NovaiGraphState
): Promise<NovaiGraphState> {
  // No-op persistence here; saving is handled by the explicit saveChapter action
  return state;
}

function novaiRouteDecider(
  state: NovaiGraphState
): 'saveChapterNode' | 'loadOrInitSession' {
  return state.saveChapter ? 'saveChapterNode' : 'loadOrInitSession';
}

// Decide between BG3 engine flow and Open Canvas flow
async function routeInitial(
  state: NovaiGraphState,
  config: LangGraphRunnableConfig
): Promise<Send> {
  const useNovai = Boolean(
    state.gameState ||
      state.sessionId ||
      state.saveChapter ||
      (config.configurable?.campaign_id as string | undefined)
  );
  return new Send(useNovai ? 'novaiRouteStart' : 'generatePath', { ...state });
}

const builder = new StateGraph(NovaiGraphAnnotation)
  // Initial router between BG3 and OC
  .addNode('routeInitial', routeInitial)
  .addEdge(START, 'routeInitial')
  // ----- Open Canvas nodes -----
  .addNode('generatePath', generatePath)
  .addNode('replyToGeneralInput', replyToGeneralInput)
  .addNode('rewriteArtifact', rewriteArtifact)
  .addNode('rewriteArtifactTheme', rewriteArtifactTheme)
  .addNode('rewriteCodeArtifactTheme', rewriteCodeArtifactTheme)
  .addNode('updateArtifact', updateArtifact)
  .addNode('updateHighlightedText', updateHighlightedText)
  .addNode('generateArtifact', generateArtifact)
  .addNode('customAction', customAction)
  .addNode('generateFollowup', generateFollowup)
  .addNode('cleanState', cleanState)
  .addNode('reflect', reflectNode)
  .addNode('generateTitle', generateTitleNode)
  .addNode('summarizer', summarizer)
  .addNode('webSearch', webSearchGraph)
  .addNode('routePostWebSearch', routePostWebSearch)
  // ----- BG3 nodes -----
  .addNode('saveChapterNode', saveChapterNode)
  .addNode('novaiRouteStart', async (s: NovaiGraphState) => s)
  .addNode('loadOrInitSession', loadOrInitSession)
  .addNode('runTurn', runTurn)
  .addNode('novaiGenerateArtifact', novaiGenerateArtifact)
  .addNode('persistAndReturn', persistAndReturn)
  // Initial router
  .addConditionalEdges('generatePath', routeNode, [
    'saveChapterNode',
    'updateArtifact',
    'rewriteArtifactTheme',
    'rewriteCodeArtifactTheme',
    'replyToGeneralInput',
    'generateArtifact',
    'rewriteArtifact',
    'customAction',
    'updateHighlightedText',
    'webSearch',
  ])
  // Edges
  .addEdge('generateArtifact', 'generateFollowup')
  .addEdge('updateArtifact', 'generateFollowup')
  .addEdge('updateHighlightedText', 'generateFollowup')
  .addEdge('rewriteArtifact', 'generateFollowup')
  .addEdge('rewriteArtifactTheme', 'generateFollowup')
  .addEdge('rewriteCodeArtifactTheme', 'generateFollowup')
  .addEdge('customAction', 'generateFollowup')
  .addEdge('webSearch', 'routePostWebSearch')
  // End edges
  .addEdge('replyToGeneralInput', 'cleanState')
  // Only reflect if an artifact was generated/updated.
  .addEdge('generateFollowup', 'reflect')
  .addEdge('reflect', 'cleanState')
  .addConditionalEdges('cleanState', conditionallyGenerateTitle, [
    END,
    'generateTitle',
    'summarizer',
  ])
  .addConditionalEdges('novaiRouteStart', novaiRouteDecider, [
    'loadOrInitSession',
    'saveChapterNode',
  ])
  .addEdge('loadOrInitSession', 'runTurn')
  .addEdge('runTurn', 'novaiGenerateArtifact')
  .addEdge('novaiGenerateArtifact', 'persistAndReturn')
  // Terminal edges
  .addEdge('saveChapterNode', END)
  .addEdge('generateTitle', END)
  .addEdge('summarizer', END)
  .addEdge('persistAndReturn', END);

export const graph = builder.compile().withConfig({ runName: 'novai' });
