import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createInitialGameState } from './campaigns/index.js';
import type { GameState } from './types.js';

let cachedSupabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
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
};

export async function getOrCreateSession(args: {
  threadId: string;
  userId: string;
  campaignId: string;
  playerName: string;
}): Promise<{ threadId: string; gameState: GameState }> {
  const { threadId, userId, campaignId, playerName } = args;

  const supabase = getSupabaseClient();
  const { data: existing, error } = await supabase
    .from('game_sessions')
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
      threadId: existing.thread_id,
      gameState: existing.game_state as GameState,
    };
  }

  const initial = createInitialGameState(campaignId, playerName);
  const rngSeed = Math.floor(Math.random() * 2 ** 31);
  const { data: created, error: insertErr } = await supabase
    .from('game_sessions')
    .insert({
      id: threadId,
      user_id: userId,
      thread_id: threadId,
      campaign_id: campaignId,
      player_name: playerName,
      game_state: initial,
      rng_seed: rngSeed,
      last_turn_number: 0,
      mechanics_config: null,
    })
    .select()
    .single();
  if (insertErr) {
    throw insertErr;
  }

  return { threadId: created.thread_id, gameState: initial };
}

export async function persistTurn(args: {
  threadId: string;
  gameState: GameState;
  playerInput: string;
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
  const { threadId, gameState, output } = args;

  const supabase = getSupabaseClient();
  // Fetch current turn number to compute the next one
  const { data: sessionRow, error: getSessionErr } = await supabase
    .from('game_sessions')
    .select('last_turn_number')
    .eq('id', threadId)
    .single();

  if (getSessionErr) {
    throw getSessionErr;
  }
  const currentTurnNumber = Number(sessionRow?.last_turn_number || 0);
  const nextTurnNumber = currentTurnNumber + 1;

  // Update the session snapshot and bump the last_turn_number
  const { error: updateErr } = await supabase
    .from('game_sessions')
    .update({
      game_state: gameState,
      last_turn_number: nextTurnNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId);
  if (updateErr) {
    throw updateErr;
  }

  // Insert the turn event
  const { error: insertTurnErr } = await supabase.from('game_turns').insert({
    session_id: threadId,
    thread_id: threadId,
    turn_number: nextTurnNumber,
    player_input: args.playerInput,
    narration: output.narration,
    choices: output.choices || null,
    stat_check: output.statCheck || null,
    combat: output.combat || null,
    updated_game_state: gameState,
    created_at: new Date().toISOString(),
  });
  if (insertTurnErr) {
    throw insertTurnErr;
  }
}
