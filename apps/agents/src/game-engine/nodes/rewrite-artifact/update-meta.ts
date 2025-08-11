import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { getArtifactContent } from '@workspace/shared/utils/artifacts';
import type { z } from 'zod';
import {
  formatArtifactContent,
  getModelFromConfig,
  isUsingO1MiniModel,
} from '../../../utils.js';
import { GET_TITLE_TYPE_REWRITE_ARTIFACT } from '../../prompts.js';
import type { GameEngineGraphAnnotation } from '../../state.js';
import { OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA } from './schemas.js';

export async function optionallyUpdateArtifactMeta(
  state: typeof GameEngineGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<z.infer<typeof OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA>> {
  const toolCallingModel = (
    await getModelFromConfig(config, {
      isToolCalling: true,
    })
  )
    .withStructuredOutput(
      OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA,

      {
        name: 'optionallyUpdateArtifactMeta',
      }
    )
    .withConfig({ runName: 'optionally_update_artifact_meta' });

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    throw new Error('No artifact found');
  }

  const optionallyUpdateArtifactMetaPrompt =
    GET_TITLE_TYPE_REWRITE_ARTIFACT.replace(
      '{artifactContent}',
      formatArtifactContent(currentArtifactContent, true)
    );

  const recentHumanMessage = state._messages.findLast(
    (message) => message.getType() === 'human'
  );
  if (!recentHumanMessage) {
    throw new Error('No recent human message found');
  }

  const isO1MiniModel = isUsingO1MiniModel(config);
  const optionallyUpdateArtifactResponse = (await toolCallingModel.invoke([
    {
      role: isO1MiniModel ? 'user' : 'system',
      content: optionallyUpdateArtifactMetaPrompt,
    },
    recentHumanMessage,
  ])) as z.infer<typeof OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA>;

  return optionallyUpdateArtifactResponse;
}
