import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { Command, END, Send, START, StateGraph } from '@langchain/langgraph';
import { GameEngineService } from '@workspace/engine';
import { DEFAULT_INPUTS } from '@workspace/shared/constants';
import { createAIMessageFromWebResults, getModelConfig } from '../utils.js';
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

async function initGameEngine(
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

async function processGameRequest(
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

const builder = new StateGraph(NovaiGraphAnnotation)
  .addNode('generatePath', generatePath)
  .addEdge(START, 'generatePath')
  // Nodes
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
  .addNode('initGameEngine', initGameEngine)
  .addNode('processGameRequest', processGameRequest)
  // Initial router
  .addConditionalEdges('generatePath', routeNode, [
    'saveChapterNode',
    'initGameEngine',
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
  .addEdge('initGameEngine', 'processGameRequest')
  .addEdge('processGameRequest', 'generateArtifact')
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
  // Terminal edges
  .addEdge('saveChapterNode', END)
  .addEdge('generateTitle', END)
  .addEdge('summarizer', END);

export const graph = builder.compile().withConfig({ runName: 'novai' });
