import { createClient } from '@supabase/supabase-js';
import type { GameEngineService, GameState } from '@workspace/engine';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL) throw new Error('SUPABASE_URL not set');
if (!SUPABASE_SERVICE_ROLE) throw new Error('SUPABASE_SERVICE_ROLE not set');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

export async function getOrCreateSession(args: {
  threadId: string;
  userId: string;
  campaignId: string;
  playerName: string;
  engine: GameEngineService;
}): Promise<{ sessionId: string; gameState: GameState }> {
  const { threadId, userId, campaignId, playerName, engine } = args;

  const { data: existing, error } = await supabase
    .from('bg3_sessions')
    .select('*')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (existing) {
    return {
      sessionId: existing.id,
      gameState: existing.game_state as GameState,
    };
  }

  const initial = await engine.createNewGame(campaignId, playerName);
  const { data: created, error: insertErr } = await supabase
    .from('bg3_sessions')
    .insert({
      user_id: userId,
      thread_id: threadId,
      campaign_id: campaignId,
      player_name: playerName,
      game_state: initial,
    })
    .select()
    .single();
  if (insertErr) throw insertErr;

  return { sessionId: created.id, gameState: initial };
}

export async function persistTurn(args: {
  sessionId: string;
  gameState: GameState;
  output: {
    narration: string;
    choices?: string[];
    statCheck?: {
      stat: string;
      difficulty: number;
      result: number;
      success: boolean;
    };
    combat?: {
      enemies: string[];
      playerHealth: number;
      enemyHealth: Record<string, number>;
    };
  };
}) {
  const { sessionId, gameState, output } = args;

  const { error: updateErr } = await supabase
    .from('bg3_sessions')
    .update({ game_state: gameState, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (updateErr) throw updateErr;

  const { error: insertTurnErr } = await supabase.from('bg3_turns').insert({
    session_id: sessionId,
    narration: output.narration,
    choices: output.choices || null,
    stat_check: output.statCheck || null,
    combat: output.combat || null,
    created_at: new Date().toISOString(),
  });
  if (insertTurnErr) throw insertTurnErr;
}

export async function persistChapter(args: {
  sessionId: string;
  threadId: string;
  chapterId: string;
  title: string;
  content: string;
  summary: string;
  memo?: string;
}) {
  const { sessionId, threadId, chapterId, title, content, summary, memo } =
    args;
  try {
    const { error } = await supabase.from('bg3_chapters').insert({
      session_id: sessionId,
      thread_id: threadId,
      chapter_id: chapterId,
      title,
      content,
      summary,
      memo: memo || null,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (e) {
    // Non-fatal: log and continue so finalization doesn't break if table is missing
    console.warn('Failed to persist chapter to Supabase:', e);
  }
}
