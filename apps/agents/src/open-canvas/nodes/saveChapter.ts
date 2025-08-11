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
import { upsertChapterSummary } from '../vector';

const SUMMARY_CHARACTER_LIMIT = 600;

async function generateStructuredChapterSummary(
  content: string,
  config: LangGraphRunnableConfig
): Promise<{ json: string; embeddingText: string } | null> {
  const model = await getModelFromConfig(config, { temperature: 0 });
  const response = await model.invoke([
    ['system', SUMMARIZE_CHAPTER_SYSTEM_PROMPT],
    ['user', content],
  ]);
  const raw = response.content.toString().trim();
  // Remove markdown fences if present
  const cleaned = raw.replace(/^```json\n?|^```\n?|\n?```$/g, '');
  try {
    const parsed = JSON.parse(cleaned) as { embedding_text?: string };
    const embeddingText = parsed.embedding_text || '';
    if (!embeddingText) {
      return null;
    }
    return { json: cleaned, embeddingText };
  } catch {
    return null;
  }
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
  const structured = await generateStructuredChapterSummary(content, config);
  const summary =
    structured?.embeddingText || content.slice(0, SUMMARY_CHARACTER_LIMIT);

  const chapterId = uuidv4();
  await persistChapter({
    threadId,
    chapterId,
    title,
    content,
    summary,
  });
  if (structured?.json) {
    await upsertChapterSummary(structured.json, {
      id: `chapter:${chapterId}`,
      namespace: process.env.PINECONE_NAMESPACE || 'chapter_summaries',
      threadId,
    });
  }

  return {};
}
