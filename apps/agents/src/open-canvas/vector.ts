import { OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

export const ChapterSummarySchema = z.object({
  embedding_text: z.string().min(1),
  metadata: z.object({
    chapter_id: z.string().optional().nullable(),
    pov: z.string().optional().nullable(),
    locations: z.array(z.string()).default([]),
    timeframe: z.string().optional().nullable(),
    key_entities: z
      .array(
        z.object({
          name: z.string(),
          aliases: z.array(z.string()).default([]),
          type: z.string(),
          role: z.string(),
        })
      )
      .default([]),
    artifacts_items: z.array(z.string()).default([]),
    relationships: z
      .array(
        z.object({
          source: z.string(),
          target: z.string(),
          relation: z.string(),
        })
      )
      .default([]),
    events_timeline: z
      .array(z.object({ order: z.number(), event: z.string() }))
      .default([]),
    stakes: z.string().optional().nullable(),
    goals_motivations: z.string().optional().nullable(),
    outcome: z.string().optional().nullable(),
    themes_motifs: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
    notable_quotes: z.array(z.string()).default([]),
    contains_spoilers: z.boolean().default(true),
    chunk_index: z.number().optional(),
    chunk_total: z.number().optional(),
  }),
});

export type ChapterSummary = z.infer<typeof ChapterSummarySchema>;
// Pinecone metadata must be flat and primitive/array values; avoid nesting and nulls
// Pinecone's SDK types typically allow string, number, boolean, and arrays of strings.
// Use a conservative metadata type to satisfy type checking.
type PineconePrimitive = string | number | boolean | string[];
type PineconeMetadata = Record<string, PineconePrimitive>;

export function getPinecone() {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    throw new Error('PINECONE_API_KEY not set');
  }
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
  const namespaceName = process.env.PINECONE_NAMESPACE || 'chapter_summaries';
  const ns = index.namespace(namespaceName);
  const vector = await embedText(query);
  const res = await ns.query({
    vector,
    topK,
    includeMetadata: true,
    filter: { threadId: { $eq: threadId } },
  });
  return (
    res.matches?.map((m) => ({
      score: m.score || 0,
      id: m.id,
      metadata: m.metadata as Record<string, unknown>,
    })) || []
  );
}

export async function upsertChapterSummary(
  llmJsonString: string,
  opts?: {
    id?: string;
    namespace?: string;
    threadId?: string;
    chapterId?: string;
  }
) {
  const parsed = ChapterSummarySchema.parse(JSON.parse(llmJsonString));
  const { embedding_text, metadata } = parsed;

  const vector = await embedText(embedding_text);

  // Ensure index exists (first use will create)
  const index = await ensureIndexes();
  const ns = index.namespace(
    opts?.namespace || process.env.PINECONE_NAMESPACE || 'chapter_summaries'
  );

  const id =
    opts?.id ||
    (metadata.chapter_id
      ? `chapter:${metadata.chapter_id}`
      : `chapter:${uuidv4()}`);

  const pineconeMetadata: PineconeMetadata = {
    // Flatten/normalize: drop non-primitive arrays of objects, stringify if needed later
    chapter_id: opts?.chapterId || '',
    thread_id: opts?.threadId || '',
    pov: metadata.pov || '',
    locations: (metadata.locations || []) as string[],
    timeframe: metadata.timeframe || '',
    artifacts_items: (metadata.artifacts_items || []) as string[],
    // relationships and key_entities/events are arrays of objects; omit from metadata to satisfy Pinecone typing
    stakes: metadata.stakes || '',
    goals_motivations: metadata.goals_motivations || '',
    outcome: metadata.outcome || '',
    themes_motifs: (metadata.themes_motifs || []) as string[],
    keywords: (metadata.keywords || []).map((k) => k.toLowerCase()),
    notable_quotes: (metadata.notable_quotes || []) as string[],
    contains_spoilers: metadata.contains_spoilers ?? true,
    chunk_index: String(
      typeof metadata.chunk_index === 'number' ? metadata.chunk_index : 0
    ),
    chunk_total: String(
      typeof metadata.chunk_total === 'number' ? metadata.chunk_total : 0
    ),
  };

  await ns.upsert([
    {
      id,
      values: vector,
      metadata: pineconeMetadata,
    },
  ]);

  const namespace =
    opts?.namespace || process.env.PINECONE_NAMESPACE || 'chapter_summaries';
  return { id, dimension: vector.length, namespace };
}
