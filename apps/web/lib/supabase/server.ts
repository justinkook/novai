import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Helper to fetch the last chapter's summary/memo for a given thread using RLS
export async function getLastChapterForThread(threadId: string) {
  const supabase = await createClient();

  const { data: session, error: sessionErr } = await supabase
    .from('bg3_sessions')
    .select('id')
    .eq('thread_id', threadId)
    .limit(1)
    .maybeSingle();

  if (sessionErr || !session) return null;

  const { data: chapter, error: chapterErr } = await supabase
    .from('bg3_chapters')
    .select('chapter_id, title, summary, memo, created_at')
    .eq('session_id', session.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (chapterErr) return null;
  return chapter || null;
}
