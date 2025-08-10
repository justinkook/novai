import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { ArtifactV3 } from '@workspace/shared/types';
import {
  getArtifactContent,
  isArtifactMarkdownContent,
} from '@workspace/shared/utils/artifacts';
import { v4 as uuidv4 } from 'uuid';
import { formatMessages, getModelFromConfig } from '../../utils';
import { persistChapter } from '../persistence';
import { SUMMARIZE_CHAPTER_SYSTEM_PROMPT } from '../prompts';
import type { OpenCanvasGraphAnnotation } from '../state';
import { indexChapter } from '../vector';

const SUMMARY_CHARACTER_LIMIT = 600;

async function summarizeForEmbedding(
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<string> {
  const model = await getModelFromConfig(config, { temperature: 0 });
  const messagesToSummarize = formatMessages(state.messages);

  const response = await model.invoke([
    ['system', SUMMARIZE_CHAPTER_SYSTEM_PROMPT],
    ['user', `Here are the messages to summarize:\n${messagesToSummarize}`],
  ]);

  return response.content.toString();
}

export async function saveChapterNode(
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<Partial<typeof OpenCanvasGraphAnnotation.State>> {
  const sessionId =
    state.sessionId ||
    (config.configurable?.bg3_session_id as string | undefined);
  const threadId =
    (config.configurable?.thread_id as string | undefined) ||
    (config.configurable?.threadId as string | undefined);

  if (!sessionId) {
    throw new Error('Missing bg3_session_id in configurable');
  }
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
  const summary = await summarizeForEmbedding(state, config).catch(() =>
    content.slice(0, SUMMARY_CHARACTER_LIMIT)
  );

  const chapterId = uuidv4();
  await persistChapter({
    sessionId,
    threadId,
    chapterId,
    title,
    content,
    summary,
  });
  await indexChapter({ threadId, chapterId, title, content, summary });

  return {};
}
