import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { ArtifactV3 } from '@workspace/shared/types';
import {
  getArtifactContent,
  isArtifactMarkdownContent,
} from '@workspace/shared/utils/artifacts';
import { getModelFromConfig } from 'src/utils';
import { persistChapter } from '../persistence';
import type { NovaiGraphState } from '../state';
import { indexChapter } from '../vector';

async function summarizeForEmbedding(
  sourceMarkdown: string,
  config: LangGraphRunnableConfig
): Promise<string> {
  const model = await getModelFromConfig(config, { temperature: 0 });
  const CHARACTER_LIMIT = 600;
  const MAX_INPUT_CHARS = 24000;
  const input =
    sourceMarkdown.length > MAX_INPUT_CHARS
      ? sourceMarkdown.slice(0, MAX_INPUT_CHARS)
      : sourceMarkdown;
  const system =
    'You are an expert editor. Summarize the chapter into ONE concise paragraph, capturing key plot points, characters, locations, and outcomes. Use plain text only. Hard limit: 600 characters.';
  const res = await model.invoke([
    { role: 'system', content: system },
    { role: 'user', content: input },
  ]);
  const raw =
    typeof res.content === 'string' ? res.content : String(res.content ?? '');
  return raw.replace(/\s+/g, ' ').trim().slice(0, CHARACTER_LIMIT);
}

export async function saveChapterNode(
  state: NovaiGraphState,
  config: LangGraphRunnableConfig
): Promise<Partial<NovaiGraphState>> {
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
  // Use the artifact content as-is; normalization happens upstream
  const content = artifactContent.fullMarkdown;
  const summary = await summarizeForEmbedding(content, config).catch(() =>
    content.slice(0, 600)
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
