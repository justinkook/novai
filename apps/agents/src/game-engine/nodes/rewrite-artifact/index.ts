import { AIMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { isArtifactMarkdownContent } from '@workspace/shared/utils/artifacts';
import {
  extractThinkingAndResponseTokens,
  isThinkingModel,
} from '@workspace/shared/utils/thinking';
import { v4 as uuidv4 } from 'uuid';
import {
  createContextDocumentMessages,
  getModelConfig,
  getModelFromConfig,
  isUsingO1MiniModel,
  optionallyGetSystemPromptFromConfig,
} from '../../../utils.js';
import type {
  GameEngineGraphAnnotation,
  GameEngineGraphReturnType,
} from '../../state.js';
import { optionallyUpdateArtifactMeta } from './update-meta.js';
import {
  buildPrompt,
  createNewArtifactContent,
  validateState,
} from './utils.js';

export const rewriteArtifact = async (
  state: typeof GameEngineGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<GameEngineGraphReturnType> => {
  const characterName =
    (config.configurable?.assistant_name as string) || 'Tav';
  const { modelName } = getModelConfig(config);
  const smallModelWithConfig = (await getModelFromConfig(config)).withConfig({
    runName: 'rewrite_artifact_model_call',
  });
  const { currentArtifactContent, recentHumanMessage } = validateState(state);

  const artifactMetaToolCall = await optionallyUpdateArtifactMeta(
    state,
    config
  );
  const artifactType = artifactMetaToolCall.type;
  const isNewType = artifactType !== currentArtifactContent.type;

  const artifactContent = isArtifactMarkdownContent(currentArtifactContent)
    ? currentArtifactContent.fullMarkdown
    : currentArtifactContent.code;

  const engineResults = state.gameEngineResults;
  const engineResultsContext = engineResults
    ? [
        `Narration: ${engineResults.narration}`,
        Array.isArray(engineResults.choices) && engineResults.choices.length
          ? `Choices: ${engineResults.choices
              .slice(0, 3)
              .map((c, i) => `${i + 1}. ${c}`)
              .join('  ')}`
          : undefined,
        engineResults.statCheck
          ? `StatCheck: ${engineResults.statCheck.stat} (DC ${engineResults.statCheck.difficulty})`
          : undefined,
        engineResults.combat
          ? `Combat: Enemies ${engineResults.combat.enemies.join(', ')} | PlayerHealth ${engineResults.combat.playerHealth}`
          : undefined,
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const formattedPrompt = buildPrompt({
    artifactContent,
    isNewType,
    artifactMetaToolCall,
    engineResultsContext,
    characterName,
  });

  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${formattedPrompt}`
    : formattedPrompt;

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);
  const newArtifactResponse = await smallModelWithConfig.invoke([
    { role: isO1MiniModel ? 'user' : 'system', content: fullSystemPrompt },
    ...contextDocumentMessages,
    recentHumanMessage,
  ]);

  let thinkingMessage: AIMessage | undefined;
  let artifactContentText = newArtifactResponse.content as string;

  if (isThinkingModel(modelName)) {
    const { thinking, response } =
      extractThinkingAndResponseTokens(artifactContentText);
    thinkingMessage = new AIMessage({
      id: `thinking-${uuidv4()}`,
      content: thinking,
    });
    artifactContentText = response;
  }

  const newArtifactContent = createNewArtifactContent({
    artifactType,
    state,
    currentArtifactContent,
    artifactMetaToolCall,
    newContent: artifactContentText as string,
  });

  return {
    artifact: {
      ...state.artifact,
      currentIndex: (state.artifact?.contents?.length || 0) + 1,
      contents: [...(state.artifact?.contents || []), newArtifactContent],
    },
    messages: [...(thinkingMessage ? [thinkingMessage] : [])],
    _messages: [...(thinkingMessage ? [thinkingMessage] : [])],
  };
};
