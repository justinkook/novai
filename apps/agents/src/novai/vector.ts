import { OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';

export function getPinecone() {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error('PINECONE_API_KEY not set');
  return new Pinecone({ apiKey });
}

export async function ensureIndexes() {
  const pc = getPinecone();
  const indexName = process.env.PINECONE_INDEX || 'novai-chapters';
  const indexes = await pc.listIndexes();
  const exists = indexes.indexes?.some((i) => i.name === indexName);
  if (!exists) {
    await pc.createIndex({
      name: indexName,
      dimension: 1536,
      metric: 'cosine',
      spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
    });
  }
  return pc.index(indexName);
}

export async function upsertChapterEmbedding(args: {
  threadId: string;
  chapterId: string;
  title: string;
  summary?: string;
  embedding: number[];
}) {
  const { threadId, chapterId, title, summary, embedding } = args;
  const index = await ensureIndexes();
  await index.upsert([
    {
      id: `${threadId}:${chapterId}`,
      values: embedding,
      metadata: {
        threadId,
        chapterId,
        title,
        summary: summary || '',
      },
    },
  ]);
}

export async function embedText(text: string): Promise<number[]> {
  const model = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  });
  return model.embedQuery(text);
}

export async function querySimilarChapters(args: {
  threadId: string;
  query: string;
  topK?: number;
}) {
  const { threadId, query, topK = 5 } = args;
  const index = await ensureIndexes();
  const vector = await embedText(query);
  const res = await index.query({
    vector,
    topK,
    includeMetadata: true,
    filter: { threadId: { $eq: threadId } },
  });
  return (
    res.matches?.map((m) => ({
      score: m.score || 0,
      id: m.id,
      metadata: m.metadata as Record<string, any>,
    })) || []
  );
}

export async function indexChapter(args: {
  threadId: string;
  chapterId: string;
  title: string;
  content: string; // full novelized content (not embedded)
  summary: string; // concise summary (embedded)
  memo?: string; // ultra-short continuity memo
}) {
  const { threadId, chapterId, title, summary, memo } = args;
  // Only embed the concise summary (and optional memo) for efficient context
  const embeddingTarget = memo ? `${summary}\n\nMemo: ${memo}` : summary;
  const embedding = await embedText(embeddingTarget);
  await upsertChapterEmbedding({
    threadId,
    chapterId,
    title,
    summary,
    embedding,
  });
}
