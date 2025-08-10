import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createInitialGameState } from './campaigns/index.js';
import type { GameState } from './types.js';

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

export async function getOrCreateSession(args: {
  threadId: string;
  userId: string;
  campaignId: string;
  playerName: string;
}): Promise<{ sessionId: string; gameState: GameState }> {
  const { threadId, userId, campaignId, playerName } = args;

  const supabase = getSupabaseClient();
  const { data: existing, error } = await supabase
    .from('bg3_sessions')
    .select('*')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }

  if (existing) {
    return {
      sessionId: existing.id,
      gameState: existing.game_state as GameState,
    };
  }

  const initial = createInitialGameState(campaignId, playerName);
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
  if (insertErr) {
    throw insertErr;
  }

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

  const supabase = getSupabaseClient();
  const { error: updateErr } = await supabase
    .from('bg3_sessions')
    .update({ game_state: gameState, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (updateErr) {
    throw updateErr;
  }

  const { error: insertTurnErr } = await supabase.from('bg3_turns').insert({
    session_id: sessionId,
    narration: output.narration,
    choices: output.choices || null,
    stat_check: output.statCheck || null,
    combat: output.combat || null,
    created_at: new Date().toISOString(),
  });
  if (insertTurnErr) {
    throw insertTurnErr;
  }
}
