import type { LangGraphRunnableConfig } from '@langchain/langgraph';
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
import type {
  NovaiGraphAnnotation,
  NovaiGraphReturnType,
} from '../../state.js';
import { ARTIFACT_TOOL_SCHEMA } from './schemas.js';
import { createArtifactContent, formatNewArtifactPrompt } from './utils.js';

/**
 * Generate a new artifact based on the user's query.
 */
export const generateArtifact = async (
  state: typeof NovaiGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<NovaiGraphReturnType> => {
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
