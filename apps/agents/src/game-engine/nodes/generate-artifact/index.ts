import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { ArtifactV3 } from '@workspace/shared/types';
import type { z } from 'zod';
import {
  createContextDocumentMessages,
  getModelConfig,
  getModelFromConfig,
  isUsingO1MiniModel,
  optionallyGetSystemPromptFromConfig,
} from '../../../utils.js';
import { GAME_ENGINE_NEW_ARTIFACT_PROMPT } from '../../prompts.js';
import type {
  GameEngineGraphAnnotation,
  GameEngineGraphReturnType,
} from '../../state.js';
import { ARTIFACT_TOOL_SCHEMA } from './schemas.js';
import { createArtifactContent, formatNewArtifactPrompt } from './utils.js';

/**
 * Generate a new artifact based on the user's query.
 */
export const generateArtifact = async (
  state: typeof GameEngineGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<GameEngineGraphReturnType> => {
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

  const results = state.gameEngineResults;
  if (!results) {
    throw new Error('No gameEngineResults found for novelization');
  }

  const characterName =
    (config.configurable?.assistant_name as string) || 'Tav';

  const engineResultsText = [
    `Narration: ${results.narration}`,
    Array.isArray(results.choices) && results.choices.length
      ? `Choices: ${results.choices.map((c, i) => `${i + 1}. ${c}`).join(' ')}`
      : undefined,
    results.statCheck
      ? `StatCheck: ${results.statCheck.stat} (DC ${results.statCheck.difficulty}) → result ${results.statCheck.result} → ${results.statCheck.success ? 'success' : 'fail'}`
      : undefined,
    results.combat
      ? `Combat: Enemies ${results.combat.enemies.join(', ')} | PlayerHealth ${results.combat.playerHealth} | EnemyHealth ${JSON.stringify(results.combat.enemyHealth)}`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  const novelPrompt = formatNewArtifactPrompt(modelName)
    .replace('{engineResults}', engineResultsText)
    .replaceAll('{characterName}', characterName);

  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${novelPrompt}`
    : novelPrompt;

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
