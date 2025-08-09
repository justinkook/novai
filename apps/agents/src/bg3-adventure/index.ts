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
import { getModelConfig } from '../utils.js';
import { getOrCreateSession, persistChapter, persistTurn } from './persistence';
import {
  BG3_CAMPAIGN_GUARDRAILS,
  BG3_CANON_QUERY_HINT,
  BG3_RULESET_PROMPT,
} from './prompts.js';
import { Bg3GraphAnnotation } from './state.js';
import { indexChapter, querySimilarChapters } from './vector';

type Bg3State = typeof Bg3GraphAnnotation.State;

async function novelizeChapterContent(
  args: {
    narration: string;
    gameState: GameState;
    output: NonNullable<Bg3State['output']>;
  },
  config: LangGraphRunnableConfig
): Promise<{ title: string; content: string; summary: string; memo: string }> {
  const { narration, gameState, output } = args;

  // Basic fallback sanitization in case LLM call fails
  const basicSanitize = (text: string) => {
    return (
      text
        // Remove explicit stat check phrasing
        .replace(/Make a\s+\w+\s+check\s*\(DC\s*\d+\)/gi, '')
        // Remove inline dice/roll markers like [Roll: 14], (d20=12), etc.
        .replace(/\[(?:Roll|Check):?\s*\d+\]/gi, '')
        .replace(/\(d\d+\s*=\s*\d+\)/gi, '')
        // Trim leftover blank lines
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    );
  };

  // Prefer UI-provided model settings when compatible; fallback to env/local
  const llmConfig = (() => {
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

  const llm = new LLMService(llmConfig);

  const system = `You are an expert fiction editor adapting tabletop RPG session logs into a serialized web novel chapter.
Requirements:
- Remove or translate any explicit game mechanics (e.g., DC checks, dice rolls, turn order, combat rounds) into immersive prose.
- Maintain continuity with provided context and incorporate outcomes of checks and combat as narrative consequences, not mechanics.
- Write in a clean, engaging web novel style with proper paragraphs.
- Do not include bullet lists or numbered choices in the final chapter.
- Provide a concise, catchy chapter title.
- Output strictly in JSON with keys: title (string), chapter (string), summary (string <= 600 chars), memo (string <= 240 chars). The memo should be an ultra-concise continuity note capturing only persistent facts needed to continue the next chapter (no lists, no spoilers).`;

  const contextBits: string[] = [];
  if (output.statCheck) {
    const { stat, difficulty, success } = output.statCheck;
    contextBits.push(
      `StatCheck: ${stat} vs DC ${difficulty} → ${success ? 'success' : 'failure'}`
    );
  }
  if (output.combat) {
    const { enemies } = output.combat;
    contextBits.push(`Combat: ${enemies.join(', ')}`);
  }

  const user = `GAME CONTEXT\nPlayer: ${gameState.playerName}\nLocation: ${gameState.currentLocation}\nCompanions: ${gameState.companions.join(', ') || 'None'}\n${
    contextBits.length ? `Notes: ${contextBits.join(' | ')}` : ''
  }\n\nRAW NARRATION\n${narration}\n\nReturn JSON only.`;

  try {
    const response = await llm.callLLM(`${system}\n\n${user}`, [], 0.5);
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(response);
    const title: string =
      (parsed.title || '').toString().trim() || 'Untitled Chapter';
    const chapterText: string = (parsed.chapter || narration).toString();
    const summarySource: string = (parsed.summary || chapterText).toString();
    const memo: string = (parsed.memo || '').toString().slice(0, 240);
    const content = chapterText.trim();
    const summary = summarySource.slice(0, 600);
    return { title, content, summary, memo };
  } catch {
    const content = basicSanitize(narration);
    const firstLine =
      content.split('\n').find((l) => l.trim().length > 0) || '';
    const title = firstLine.slice(0, 80) || 'Untitled Chapter';
    const summary = content.slice(0, 600);
    const sentences = content.split(/(?<=[.!?])\s+/);
    const memo = (sentences[sentences.length - 1] || '').slice(0, 240);
    return { title, content, summary, memo };
  }
}

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

  // Attach sessionId to config for downstream nodes
  const cfg = config as unknown as { configurable?: Record<string, unknown> };
  cfg.configurable = cfg.configurable || {};
  cfg.configurable.bg3_session_id = sessionId;

  return {
    ...state,
    gameState,
  };
}

async function runTurn(
  state: Bg3State,
  config: LangGraphRunnableConfig
): Promise<Bg3State> {
  if (!state.gameState) {
    throw new Error('gameState missing in state');
  }
  const playerInput = Array.isArray(state.messages)
    ? getLatestUserText(state.messages as unknown[])
    : '';

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
      if (state.gameState?.currentLocation) {
        queryHints.push(`location:${state.gameState.currentLocation}`);
      }
      if (state.gameState?.companions?.length) {
        queryHints.push(
          `companions:${state.gameState.companions.slice(0, 3).join(',')}`
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
    gameState: state.gameState,
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
    // Let the MessagesAnnotation reducer append this AI message to the history
    messages: [new AIMessage(response.narration)],
  };
}

async function persistAndReturn(
  state: Bg3State,
  config: LangGraphRunnableConfig
): Promise<Bg3State> {
  const sessionId = config.configurable?.bg3_session_id as string | undefined;
  if (!sessionId) {
    throw new Error('Missing bg3_session_id in configurable');
  }
  if (!state.gameState || !state.output) {
    return state;
  }

  await persistTurn({
    sessionId,
    gameState: state.gameState,
    output: state.output,
  });

  // Optionally finalize and index as a chapter
  const shouldFinalize = Boolean(state.finalizeChapter);
  const threadId =
    (config.configurable?.thread_id as string | undefined) ||
    (config.configurable?.threadId as string | undefined);
  if (shouldFinalize && threadId) {
    // Rewrite/sanitize mechanics into novel-style prose and index
    const { title, content, summary, memo } = await novelizeChapterContent(
      {
        narration: state.output.narration,
        gameState: state.gameState,
        output: state.output,
      },
      config
    );
    const chapterId = `${Date.now()}`;
    // Persist full novelized content for archival/retrieval
    await persistChapter({
      sessionId,
      threadId,
      chapterId,
      title,
      content,
      summary,
      memo,
    });
    // Index short summary (+memo) for efficient retrieval context
    await indexChapter({ threadId, chapterId, title, content, summary, memo });
  }

  return state;
}

const builder = new StateGraph(Bg3GraphAnnotation)
  .addNode('loadOrInitSession', loadOrInitSession)
  .addNode('runTurn', runTurn)
  .addNode('persistAndReturn', persistAndReturn)
  .addEdge(START, 'loadOrInitSession')
  .addEdge('loadOrInitSession', 'runTurn')
  .addEdge('runTurn', 'persistAndReturn')
  .addEdge('persistAndReturn', END);

export const graph = builder.compile().withConfig({ runName: 'bg3' });
