import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedSupabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (cachedSupabaseClient) {
    return cachedSupabaseClient;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL not set');
  }
  if (!supabaseServiceRole) {
    throw new Error('SUPABASE_SERVICE_ROLE not set');
  }

  cachedSupabaseClient = createClient(supabaseUrl, supabaseServiceRole);
  return cachedSupabaseClient;
}

function getChaptersBucket(): string {
  return process.env.SUPABASE_CHAPTERS_BUCKET || 'chapters';
}

async function ensureBucketExists(bucket: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.storage.getBucket(bucket);
    if (data) {
      return;
    }
  } catch {
    // fallthrough to try create
  }
  try {
    // If it already exists, this will throw a 409 which we can ignore
    const supabase = getSupabaseClient();
    await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024, // 50MB
    });
  } catch (unknownError: unknown) {
    const message =
      unknownError instanceof Error
        ? unknownError.message
        : String(unknownError);
    // ignore bucket already exists
    if (message.toLowerCase().includes('already exists')) {
      return;
    }
    // Re-throw unknown errors
    throw unknownError;
  }
}

function computeSha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function persistChapter(args: {
  threadId: string;
  chapterId: string;
  title: string;
  content: string;
  summary: string;
  memo?: string;
}) {
  const { threadId, chapterId, title, content, summary, memo } = args;
  try {
    // Upload sanitized content to Supabase Storage and store pointer + metadata
    const bucket = getChaptersBucket();
    await ensureBucketExists(bucket);

    const contentBuffer = Buffer.from(content, 'utf8');
    const sha256 = computeSha256Hex(contentBuffer);
    const mime = 'text/markdown; charset=utf-8';
    const version = 1;
    const key = `bg3/threads/${threadId}/chapters/${chapterId}/v${version}.md`;

    const supabase = getSupabaseClient();
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(key, contentBuffer, {
        contentType: 'text/markdown',
        cacheControl: '31536000, immutable',
        upsert: false,
      });
    if (uploadErr) {
      throw uploadErr;
    }

    const { error } = await supabase.from('bg3_chapters').insert({
      session_id: threadId,
      thread_id: threadId,
      chapter_id: chapterId,
      title,
      // storage pointer + metadata
      content_bucket: bucket,
      content_key: key,
      content_mime: mime,
      content_size: contentBuffer.length,
      content_sha256: sha256,
      version,
      // auxiliary metadata
      summary,
      memo: memo || null,
      created_at: new Date().toISOString(),
    });
    if (error) {
      throw error;
    }
  } catch (e) {
    // Non-fatal: log and continue so finalization doesn't break if table is missing
    console.warn('Failed to persist chapter to Supabase:', e);
  }
}
