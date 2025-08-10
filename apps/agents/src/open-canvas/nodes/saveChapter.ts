import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { ArtifactV3 } from '@workspace/shared/types';
import {
  getArtifactContent,
  isArtifactMarkdownContent,
} from '@workspace/shared/utils/artifacts';
import { v4 as uuidv4 } from 'uuid';
import { getModelFromConfig } from '../../utils';
import { persistChapter } from '../persistence';
import { SUMMARIZE_CHAPTER_SYSTEM_PROMPT } from '../prompts';
import type { OpenCanvasGraphAnnotation } from '../state';
import { indexChapter } from '../vector';

const SUMMARY_CHARACTER_LIMIT = 600;

async function summarizeForEmbedding(
  content: string,
  config: LangGraphRunnableConfig
): Promise<string> {
  const model = await getModelFromConfig(config, { temperature: 0 });

  const response = await model.invoke([
    ['system', SUMMARIZE_CHAPTER_SYSTEM_PROMPT],
    [
      'user',
      `Summarize the following chapter content for embedding:\n${content}`,
    ],
  ]);

  return response.content.toString();
}

export async function saveChapterNode(
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<Partial<typeof OpenCanvasGraphAnnotation.State>> {
  const threadId = config.configurable?.thread_id;

  if (!threadId) {
    throw new Error('Missing thread_id in configurable');
  }

  const artifact = (state as unknown as { artifact?: ArtifactV3 }).artifact;
  const artifactContent = artifact ? getArtifactContent(artifact) : undefined;
  if (!artifactContent || !isArtifactMarkdownContent(artifactContent)) {
    throw new Error('No text artifact found to save');
  }

  const title = (artifactContent.title || 'Chapter Draft').slice(0, 120);
  const content = artifactContent.fullMarkdown; // Normalized upstream
  const summary = await summarizeForEmbedding(content, config).catch(() =>
    content.slice(0, SUMMARY_CHARACTER_LIMIT)
  );

  const chapterId = uuidv4();
  await persistChapter({
    threadId,
    chapterId,
    title,
    content,
    summary,
  });
  await indexChapter({ threadId, chapterId, title, content, summary });

  return {};
}
