import type { SupabaseClient } from '@supabase/supabase-js';

export type SupportedMessage = {
  role?: string;
  getType?: () => string;
  _getType?: () => string;
  type?: string;
  kwargs?: { type?: string; content?: string };
  content?: string | Array<{ type: string; text?: string }>;
};

/**
 * Fast non-cryptographic 32-bit hash of a string. Produces a deterministic integer seed.
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * Small fast PRNG using a 32-bit seed. Returns a float in [0, 1).
 */
function mulberry32(a: number): () => number {
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollD20WithSeed(components: Array<string | number>): number {
  const seedBase = JSON.stringify(components);
  const seed = xmur3(seedBase)();
  const rand = mulberry32(seed)();
  return Math.floor(rand * 20) + 1;
}

export async function getSessionMeta(
  supabase: SupabaseClient,
  threadId: string
): Promise<{
  rngSeed: number;
  lastTurnNumber: number;
}> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('rng_seed,last_turn_number')
    .eq('id', threadId)
    .single();
  if (error) {
    throw error;
  }
  return {
    rngSeed: Number(
      (data as { rng_seed?: number | null; last_turn_number?: number | null })
        ?.rng_seed ?? 0
    ),
    lastTurnNumber: Number(
      (data as { rng_seed?: number | null; last_turn_number?: number | null })
        ?.last_turn_number ?? 0
    ),
  };
}

export async function computeStatCheckForNextTurn(args: {
  supabase: SupabaseClient;
  threadId: string;
  stat: string;
  difficulty: number;
}): Promise<{
  stat: string;
  difficulty: number;
  result: number;
  success: boolean;
  turnNumber: number;
}> {
  const { supabase, threadId, stat, difficulty } = args;
  const { rngSeed, lastTurnNumber } = await getSessionMeta(supabase, threadId);
  const nextTurnNumber = lastTurnNumber + 1;
  const result = rollD20WithSeed([
    rngSeed,
    nextTurnNumber,
    'stat',
    stat,
    difficulty,
  ]);
  const success = result >= difficulty;
  return { stat, difficulty, result, success, turnNumber: nextTurnNumber };
}

export const extractLatestUserText = (messages: unknown[]): string => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const raw = messages[i] as SupportedMessage;
    const type =
      raw?.getType?.() || raw?._getType?.() || raw?.type || raw?.kwargs?.type;
    if (type === 'human' || raw?.role === 'user') {
      if (Array.isArray(raw?.content) && raw?.content[0]?.type === 'text') {
        const first = raw.content[0] as { type: string; text?: string };
        return String(first?.text || '');
      }
      if (typeof raw?.content === 'string') {
        return raw.content;
      }
      if (typeof raw?.kwargs?.content === 'string') {
        return raw.kwargs.content;
      }
    }
  }
  return '';
};

export const normalizeModelContent = (content: unknown): string => {
  const raw = typeof content === 'string' ? content : String(content ?? '');
  return raw
    .replace(/\r\n/g, '\n') // normalize newlines
    .replace(/[ \t]+\n/g, '\n') // trim trailing whitespace at line ends
    .replace(/\n{3,}/g, '\n\n') // cap multiple blank lines to max 2
    .trim();
};
