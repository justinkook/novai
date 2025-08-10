import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { ArtifactV3 } from '@workspace/shared/types';
import {
  getArtifactContent,
  isArtifactMarkdownContent,
} from '@workspace/shared/utils/artifacts';
import { getModelFromConfig } from '../../utils';
import { persistChapter } from '../persistence';
import { SUMMARIZE_CHAPTER_SYSTEM_PROMPT } from '../prompts';
import type { OpenCanvasGraphAnnotation } from '../state';
import { indexChapter } from '../vector';

const SUMMARY_CHARACTER_LIMIT = 600;
const MAX_INPUT_CHARACTERS = 24000;

function clampInputLength(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function normalizeModelContent(content: unknown): string {
  return (typeof content === 'string' ? content : String(content ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
}

async function summarizeForEmbedding(
  sourceMarkdown: string,
  config: LangGraphRunnableConfig
): Promise<string> {
  const model = await getModelFromConfig(config, { temperature: 0 });
  const input = clampInputLength(sourceMarkdown, MAX_INPUT_CHARACTERS);
  const response = await model.invoke([
    { role: 'system', content: SUMMARIZE_CHAPTER_SYSTEM_PROMPT },
    { role: 'user', content: input },
  ]);
  const normalized = normalizeModelContent(response.content);
  return normalized.slice(0, SUMMARY_CHARACTER_LIMIT);
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
  const summary = await summarizeForEmbedding(content, config).catch(() =>
    content.slice(0, SUMMARY_CHARACTER_LIMIT)
  );

  const chapterId = `${Date.now()}`;
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
