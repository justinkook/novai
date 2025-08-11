import { AIMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type {
  ArtifactMarkdownV3,
  ArtifactV3,
  Reflections,
} from '@workspace/shared/types';
import {
  getArtifactContent,
  isArtifactMarkdownContent,
} from '@workspace/shared/utils/artifacts';
import {
  extractThinkingAndResponseTokens,
  isThinkingModel,
} from '@workspace/shared/utils/thinking';
import { v4 as uuidv4 } from 'uuid';
import {
  ensureStoreInConfig,
  formatReflections,
  getModelConfig,
  getModelFromConfig,
} from '../../utils.js';
import {
  ADD_EMOJIS_TO_ARTIFACT_PROMPT,
  CHANGE_ARTIFACT_LANGUAGE_PROMPT,
  CHANGE_ARTIFACT_LENGTH_PROMPT,
  CHANGE_ARTIFACT_READING_LEVEL_PROMPT,
  CHANGE_ARTIFACT_TO_PIRATE_PROMPT,
  CONVERT_ARTIFACT_TO_NOVEL_PROMPT,
} from '../prompts.js';
import type {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from '../state.js';

export const rewriteArtifactTheme = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const { modelName } = getModelConfig(config);
  const smallModel = await getModelFromConfig(config);

  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error('`assistant_id` not found in configurable');
  }
  const memoryNamespace = ['memories', assistantId];
  const memoryKey = 'reflection';
  const memories = await store.get(memoryNamespace, memoryKey);
  const memoriesAsString = memories?.value
    ? formatReflections(memories.value as Reflections)
    : 'No reflections found.';

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    throw new Error('No artifact found');
  }
  if (!isArtifactMarkdownContent(currentArtifactContent)) {
    throw new Error('Current artifact content is not markdown');
  }

  let formattedPrompt = '';
  if (state.language) {
    formattedPrompt = CHANGE_ARTIFACT_LANGUAGE_PROMPT.replace(
      '{newLanguage}',
      state.language
    ).replace('{artifactContent}', currentArtifactContent.fullMarkdown);
  } else if (state.readingLevel && state.readingLevel !== 'pirate') {
    let newReadingLevel = '';
    switch (state.readingLevel) {
      case 'child':
        newReadingLevel = 'elementary school student';
        break;
      case 'teenager':
        newReadingLevel = 'high school student';
        break;
      case 'college':
        newReadingLevel = 'college student';
        break;
      case 'phd':
        newReadingLevel = 'PhD student';
        break;
    }
    formattedPrompt = CHANGE_ARTIFACT_READING_LEVEL_PROMPT.replace(
      '{newReadingLevel}',
      newReadingLevel
    ).replace('{artifactContent}', currentArtifactContent.fullMarkdown);
  } else if (state.readingLevel && state.readingLevel === 'pirate') {
    formattedPrompt = CHANGE_ARTIFACT_TO_PIRATE_PROMPT.replace(
      '{artifactContent}',
      currentArtifactContent.fullMarkdown
    );
  } else if (state.artifactLength) {
    let newLength = '';
    switch (state.artifactLength) {
      case 'shortest':
        newLength = 'much shorter than it currently is';
        break;
      case 'short':
        newLength = 'slightly shorter than it currently is';
        break;
      case 'long':
        newLength = 'slightly longer than it currently is';
        break;
      case 'longest':
        newLength = 'much longer than it currently is';
        break;
    }
    formattedPrompt = CHANGE_ARTIFACT_LENGTH_PROMPT.replace(
      '{newLength}',
      newLength
    ).replace('{artifactContent}', currentArtifactContent.fullMarkdown);
  } else if (state.regenerateWithEmojis) {
    formattedPrompt = ADD_EMOJIS_TO_ARTIFACT_PROMPT.replace(
      '{artifactContent}',
      currentArtifactContent.fullMarkdown
    );
  } else if (state.convertNovel) {
    // When converting to a novel, we want to pass the entire artifact history
    // (all text entries) rather than only the current scene, so the model
    // can merge scenes into a single flowing chapter.
    const buildFullArtifactMarkdown = (): string => {
      const textSections = state.artifact.contents
        .filter((c): c is ArtifactMarkdownV3 => isArtifactMarkdownContent(c))
        .sort((a, b) => a.index - b.index)
        .map((c) => c.fullMarkdown);

      const joined = textSections.join('\n\n');

      // Light pre-clean of explicit game formatting that shouldn't leak into the
      // prose conversion. We keep this conservative; the prompt also instructs
      // removal and transformation.
      const stripGameMeta = (input: string): string =>
        input
          // Remove scene headers like "### Scene 1"
          .replace(/^###\s*Scene\s+\d+\s*$/gim, '')
          // Remove Choices sections: the header and immediate numbered/list lines
          .replace(/^###\s*Choices[\s\S]*?(?=\n\s*###|\n\s*#|\n{2,}|$)/gim, '')
          // Remove simple stat/combat callouts
          .replace(/^>\s*(Stat Check|Combat):.*$/gim, '')
          .trim();

      return stripGameMeta(joined);
    };

    const entireArtifactMarkdown = buildFullArtifactMarkdown();
    formattedPrompt = CONVERT_ARTIFACT_TO_NOVEL_PROMPT.replace(
      '{artifactContent}',
      entireArtifactMarkdown
    );
  } else {
    throw new Error('No theme selected');
  }

  formattedPrompt = formattedPrompt.replace('{reflections}', memoriesAsString);

  const newArtifactValues = await smallModel.invoke([
    { role: 'user', content: formattedPrompt },
  ]);

  let thinkingMessage: AIMessage | undefined;
  let artifactContentText = newArtifactValues.content as string;

  if (isThinkingModel(modelName)) {
    const { thinking, response } =
      extractThinkingAndResponseTokens(artifactContentText);
    thinkingMessage = new AIMessage({
      id: `thinking-${uuidv4()}`,
      content: thinking,
    });
    artifactContentText = response;
  }

  const newArtifact: ArtifactV3 = {
    ...state.artifact,
    currentIndex: state.artifact.contents.length + 1,
    contents: [
      ...state.artifact.contents,
      {
        ...currentArtifactContent,
        index: state.artifact.contents.length + 1,
        fullMarkdown: artifactContentText,
      },
    ],
  };

  return {
    artifact: newArtifact,
    messages: [...(thinkingMessage ? [thinkingMessage] : [])],
    _messages: [...(thinkingMessage ? [thinkingMessage] : [])],
  };
};
