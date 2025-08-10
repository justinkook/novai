import { AIMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { GameEngineService } from '@workspace/engine';
import type { ArtifactV3 } from '@workspace/shared/types';
import type { z } from 'zod';
import {
  createContextDocumentMessages,
  getFormattedReflections,
  getModelConfig,
  getModelFromConfig,
  isUsingO1MiniModel,
  optionallyGetSystemPromptFromConfig,
} from '../../../utils.js';
import { getOrCreateSession, persistTurn } from '../../persistence.js';
import {
  BG3_CAMPAIGN_GUARDRAILS,
  BG3_RULESET_PROMPT,
  GENERATE_ARTIFACT_FROM_ENGINE_PROMPT,
} from '../../prompts.js';
import type {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from '../../state.js';
import { querySimilarChapters } from '../../vector.js';
import { ARTIFACT_TOOL_SCHEMA } from './schemas.js';
import { createArtifactContent, formatNewArtifactPrompt } from './utils.js';

function buildEngineLLMConfig(config: LangGraphRunnableConfig): {
  provider: 'local' | 'openai';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
} {
  if (process.env.LOCAL_LLM_URL) {
    return {
      provider: 'local',
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
    if (modelProvider === 'openai' && (apiKey || process.env.OPENAI_API_KEY)) {
      return {
        provider: 'openai',
        apiKey: apiKey || process.env.OPENAI_API_KEY,
        baseUrl,
        model: modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      };
    }
  } catch {
    // ignore and use fallback below
  }
  return {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: undefined,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  };
}

function extractLatestUserText(
  state: typeof OpenCanvasGraphAnnotation.State
): string {
  const msgs: Array<{
    role?: string;
    content?: unknown;
    kwargs?: { content?: unknown; type?: string };
    getType?: () => string;
    _getType?: () => string;
    type?: string;
  }> = Array.isArray(state.messages) ? (state.messages as any) : [];

  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i];
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
  }
  return '';
}

function formatArtifactToolPrompt(narration: string): string {
  return GENERATE_ARTIFACT_FROM_ENGINE_PROMPT.replace('{narration}', narration);
}

/**
 * Generate a new artifact based on the user's query.
 */
export const generateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  // If BG3/game engine config is present, run engine turn and map narration -> artifact
  const userId = config.configurable?.supabase_user_id as string | undefined;
  const threadId =
    (config.configurable?.thread_id as string | undefined) ||
    (config.configurable?.threadId as string | undefined);
  const campaignId =
    (config.configurable?.campaign_id as string | undefined) ||
    'baldurs-gate-3';
  const playerName =
    (config.configurable?.player_name as string | undefined) || 'Traveler';

  const isGameEngineTurn = !!(userId && threadId);

  if (isGameEngineTurn) {
    // Guard against undefined just in case
    if (!userId || !threadId) {
      // fall through to normal artifact generation
    } else {
      const engineLLMConfig = buildEngineLLMConfig(config);

      const engine = new GameEngineService(engineLLMConfig);
      const { sessionId, gameState } = await getOrCreateSession({
        threadId,
        userId,
        campaignId,
        playerName,
        engine,
      });

      // Extract latest user text
      const playerInput = extractLatestUserText(state);

      // Pull similar memory
      let memoryNote: string | undefined;
      const similar = await querySimilarChapters({
        threadId: threadId as string,
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

      const response = await engine.processGameRequest({
        gameState,
        playerInput,
        context: memoryNote
          ? {
              chapterMemory: memoryNote,
              ruleset: BG3_RULESET_PROMPT,
              guardrails: BG3_CAMPAIGN_GUARDRAILS,
            }
          : {
              ruleset: BG3_RULESET_PROMPT,
              guardrails: BG3_CAMPAIGN_GUARDRAILS,
            },
      });

      try {
        await persistTurn({
          sessionId,
          gameState: response.updatedGameState,
          output: {
            narration: response.narration,
            choices: response.choices,
            statCheck: response.statCheck,
            combat: response.combat,
          },
        });
      } catch {}

      // Use the existing tool-binding flow to emit the artifact via generate_artifact
      const toolModel = await getModelFromConfig(config, {
        temperature: 0.3,
        isToolCalling: true,
      });
      const modelWithArtifactTool = toolModel.bindTools(
        [
          {
            name: 'generate_artifact',
            description: ARTIFACT_TOOL_SCHEMA.description,
            schema: ARTIFACT_TOOL_SCHEMA,
          },
        ],
        { tool_choice: 'generate_artifact' }
      );

      const isO1Mini = isUsingO1MiniModel(config);
      const toolPrompt = formatArtifactToolPrompt(response.narration);
      const toolResult = await modelWithArtifactTool.invoke(
        [{ role: isO1Mini ? 'user' : 'system', content: toolPrompt }],
        { runName: 'generate_artifact_from_engine' }
      );
      const argsFromTool = toolResult.tool_calls?.[0]?.args as
        | z.infer<typeof ARTIFACT_TOOL_SCHEMA>
        | undefined;
      if (!argsFromTool) {
        throw new Error('No args found in response from generate_artifact');
      }

      const artifactFromTool: ArtifactV3 = {
        currentIndex: 1,
        contents: [createArtifactContent(argsFromTool)],
      };

      return {
        artifact: artifactFromTool,
        sessionId,
        messages: [
          new AIMessage(response.narration, {
            additional_kwargs: { bg3_choices: response.choices || [] },
          }),
        ],
      };
    }
  }

  const { modelName } = getModelConfig(config, {
    isToolCalling: true,
  });
  const smallModel = await getModelFromConfig(config, {
    temperature: 0.5,
    isToolCalling: true,
  });

  const modelWithArtifactTool = smallModel.bindTools(
    [
      {
        name: 'generate_artifact',
        description: ARTIFACT_TOOL_SCHEMA.description,
        schema: ARTIFACT_TOOL_SCHEMA,
      },
    ],
    {
      tool_choice: 'generate_artifact',
    }
  );

  const memoriesAsString = await getFormattedReflections(config);
  const formattedNewArtifactPrompt = formatNewArtifactPrompt(
    memoriesAsString,
    modelName
  );

  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${formattedNewArtifactPrompt}`
    : formattedNewArtifactPrompt;

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);
  const response = await modelWithArtifactTool.invoke(
    [
      { role: isO1MiniModel ? 'user' : 'system', content: fullSystemPrompt },
      ...contextDocumentMessages,
      ...state._messages,
    ],
    { runName: 'generate_artifact' }
  );
  const args = response.tool_calls?.[0]?.args as
    | z.infer<typeof ARTIFACT_TOOL_SCHEMA>
    | undefined;
  if (!args) {
    throw new Error('No args found in response');
  }

  const newArtifactContent = createArtifactContent(args);
  const newArtifact: ArtifactV3 = {
    currentIndex: 1,
    contents: [newArtifactContent],
  };

  return {
    artifact: newArtifact,
  };
};
