import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { ArtifactV3 } from '@workspace/shared/types';
import {
  getArtifactContent,
  isArtifactMarkdownContent,
} from '@workspace/shared/utils/artifacts';
import { getModelFromConfig } from '../../utils';
import { persistChapter } from '../persistence';
import type { NovaiGraphState } from '../state';
import { indexChapter } from '../vector';

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
  // Sanitize mechanics and rewrite to third person, web-novel style before saving
  const content = await novelizeArtifactText(
    artifactContent.fullMarkdown,
    config
  ).catch(() => artifactContent.fullMarkdown);
  const summary = await summarizeForEmbedding(content, config).catch(() =>
    content.slice(0, 600)
  );
  const memo = computeMemo(content);

  const chapterId = `${Date.now()}`;
  await persistChapter({
    sessionId,
    threadId,
    chapterId,
    title,
    content,
    summary,
    memo,
  });
  await indexChapter({ threadId, chapterId, title, content, summary, memo });

  return {};
}

async function novelizeArtifactText(
  sourceMarkdown: string,
  config: LangGraphRunnableConfig
): Promise<string> {
  const model = await getModelFromConfig(config, { temperature: 0.5 });
  const system = `You are an expert fiction editor adapting tabletop RPG session logs into a serialized web novel fan fiction chapter.
Requirements:
- Remove or translate any explicit game mechanics (e.g., DC checks, dice rolls, turn order, combat rounds) into immersive prose.
- Write strictly in third person (he/she/they), avoiding second person and GM tone.
- Show, don't tell: prefer vivid description, actions, and dialogue over exposition.
- Maintain continuity with the provided text; do not invent new plot points, only refine and adapt.
- Use clean paragraphs in plain markdown (no bullet lists or numbered choices).
- Do not include code fences or metadata; return only the rewritten chapter text.`;

  // If the source is extremely long, pass it whole; the model invocation should handle chunking upstream.
  const res = await model.invoke([
    { role: 'system', content: system },
    { role: 'user', content: sourceMarkdown },
  ]);
  const raw =
    typeof res.content === 'string' ? res.content : String(res.content ?? '');
  return raw.trim();
}

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

function computeMemo(markdown: string): string | undefined {
  const sentences = String(markdown || '').split(/(?<=[.!?])\s+/);
  return (sentences[sentences.length - 1] || '').slice(0, 240);
}
