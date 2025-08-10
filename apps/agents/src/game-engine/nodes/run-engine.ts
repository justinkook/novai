import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { getModelFromConfig } from '../../utils.js';
import { getCampaign } from '../campaigns/index.js';
import { getOrCreateSession } from '../persistence.js';
import {
  BG3_CAMPAIGN_GUARDRAILS,
  BG3_RULESET_PROMPT,
  DND_5E_COMBAT_PROMPT,
  DND_5E_STAT_CHECK_PROMPT,
  DND_5E_SYSTEM_PROMPT,
  GRRM_COMBAT_PROMPT,
  GRRM_POLITICS_STAT_CHECK_PROMPT,
  GRRM_POLITICS_SYSTEM_PROMPT,
  GRRM_STAT_CHECK_PROMPT,
  GRRM_SYSTEM_PROMPT,
} from '../prompts.js';
import type { GameEngineState } from '../state.js';
import type { GameState } from '../types.js';

type SupportedMessage = {
  role?: string;
  getType?: () => string;
  _getType?: () => string;
  type?: string;
  kwargs?: { type?: string; content?: string };
  content?: string | Array<{ type: string; text?: string }>;
};

function extractLatestUserText(messages: unknown[]): string {
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
}

export async function runEngineNode(
  state: GameEngineState,
  config: LangGraphRunnableConfig
): Promise<Partial<GameEngineState>> {
  const userId = config.configurable?.supabase_user_id as string | undefined;
  const threadId = config.configurable?.thread_id;
  const campaignId =
    (config.configurable?.campaign_id as string | undefined) ||
    'baldurs-gate-3';
  const playerName =
    (config.configurable?.player_name as string | undefined) || 'Traveler';

  if (!userId || !threadId) {
    return {};
  }

  const { gameState } = await getOrCreateSession({
    threadId,
    userId,
    campaignId,
    playerName,
  });

  const playerInput = extractLatestUserText(
    (state.messages || []) as unknown[]
  );

  const response = await processGameRequest({
    config,
    gameState,
    playerInput,
  });

  return {
    gameEngineResults: response,
    messages: [],
    threadId,
  };
}

function normalizeModelContent(content: unknown): string {
  return (typeof content === 'string' ? content : String(content ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
}

async function processGameRequest(args: {
  config: LangGraphRunnableConfig;
  gameState: GameState;
  playerInput: string;
}): Promise<{
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
  updatedGameState: GameState;
}> {
  const { config, gameState, playerInput } = args;
  const campaign = getCampaign(gameState.campaignId);

  const narrativeStyle =
    (config.configurable?.narrative_style as string | undefined) || undefined;
  const systemPrompt = await buildSystemPrompt(
    campaign,
    gameState,
    narrativeStyle
  );
  const userPrompt = buildUserPrompt(playerInput, gameState);
  const memory = gameState.narrative.map((n) => n.content).slice(-5);

  const model = await getModelFromConfig(config, { temperature: 0.7 });
  const response = await model.invoke([
    { role: 'system', content: systemPrompt },
    ...memory.map((m) => ({ role: 'user' as const, content: m })),
    { role: 'user', content: userPrompt },
  ]);

  const aiResponse = normalizeModelContent(response.content);
  const updatedGameState = updateGameState(gameState, playerInput, aiResponse);
  const struct = extractStructuredExtras(aiResponse);
  const choices = struct?.choices || extractChoices(aiResponse);
  const rawStatCheck = struct?.statCheck || extractStatCheck(aiResponse);
  const statCheck = ensureCompleteStatCheck(rawStatCheck);
  const combat = struct?.combat || extractCombat(aiResponse);

  return {
    narration: aiResponse,
    choices,
    statCheck,
    combat,
    updatedGameState,
  };
}

async function buildSystemPrompt(
  campaign: { name: string; description: string; ruleset?: string },
  gameState: GameState,
  style?: string
): Promise<string> {
  // Determine base system prompt by style/campaign
  let rulesetPrompt = BG3_RULESET_PROMPT;
  let mechanicsReference = '';
  let campaignExtra: string | undefined;

  const resolvedStyle =
    style || (gameState.campaignId === 'baldurs-gate-3' ? 'bg3' : 'default');
  switch (resolvedStyle) {
    case 'grrm':
      rulesetPrompt = GRRM_SYSTEM_PROMPT;
      mechanicsReference = `\nMECHANICS REFERENCE:\n${GRRM_COMBAT_PROMPT}\n${GRRM_STAT_CHECK_PROMPT}\n`;
      campaignExtra = undefined;
      break;
    case 'grrm_politics':
      rulesetPrompt = GRRM_POLITICS_SYSTEM_PROMPT;
      mechanicsReference = `\nMECHANICS REFERENCE:\n${GRRM_COMBAT_PROMPT}\n${GRRM_POLITICS_STAT_CHECK_PROMPT}\n`;
      campaignExtra = undefined;
      break;
    case 'bg3':
      rulesetPrompt = DND_5E_SYSTEM_PROMPT;
      mechanicsReference = `\nMECHANICS REFERENCE:\n${DND_5E_COMBAT_PROMPT}\n${DND_5E_STAT_CHECK_PROMPT}\n`;
      campaignExtra =
        "You are narrating Baldur's Gate 3. Emphasize dark, mature tone and companions.";
      break;
    default:
      rulesetPrompt = BG3_RULESET_PROMPT;
      mechanicsReference =
        campaign.ruleset === 'dnd-5e'
          ? `\nMECHANICS REFERENCE:\n${DND_5E_COMBAT_PROMPT}\n${DND_5E_STAT_CHECK_PROMPT}\n`
          : '';
      campaignExtra = undefined;
  }

  const companionList = (
    campaign as unknown as {
      companions: Array<{ name: string; description: string }>;
    }
  ).companions
    .map((c) => `${c.name} — ${c.description}`)
    .join('\n');
  const locationList = (
    campaign as unknown as {
      locations: Array<{ name: string; description: string }>;
    }
  ).locations
    .map((l) => `${l.name}: ${l.description}`)
    .slice(0, 8)
    .join('\n');
  const plotBeats = (
    campaign as unknown as {
      plot: Array<{ title: string; description: string }>;
    }
  ).plot
    .map((p) => `- ${p.title}: ${p.description}`)
    .slice(0, 8)
    .join('\n');

  return `You are a Dungeon Master narrating ${campaign.name} in D&D 5e style.

${rulesetPrompt}
${BG3_CAMPAIGN_GUARDRAILS}
${campaignExtra ? `\n${campaignExtra}\n` : ''}
${mechanicsReference}

CAMPAIGN CONTEXT:
- Campaign: ${campaign.name}
- Description: ${campaign.description}
- Current Location: ${gameState.currentLocation}
- Companions (available catalog):
${companionList}
- Known Locations (subset):
${locationList}
- Plot Outline (subset):
${plotBeats}
- Player Stats: ${JSON.stringify(gameState.stats)}

RULES:
- Handle stat checks, choices, companions, turn-based combat
- Never break character
- Use 2nd-person narration
- Provide 2-4 meaningful choices when appropriate
- Include stat checks when relevant (e.g., "Make a Strength check (DC 15)")
- Describe combat in turn-based format
- Maintain narrative consistency and immersion

OUTPUT FORMAT REQUIREMENTS:
- Write immersive narration and choices normally.
- At the very end of your message, append a single compact JSON object summarizing the turn, wrapped in <engine-struct>...</engine-struct> tags. Do not mention these tags in the narration.
- JSON shape (omit keys that don't apply): { "choices": string[], "statCheck": { "stat": string, "difficulty": number }, "combat": { "enemies": string[], "playerHealth": number, "enemyHealth": Record<string, number> } }
- Example: <engine-struct>{"choices":["Help the druids","Join the goblins"],"statCheck":{"stat":"Perception","difficulty":12}}</engine-struct>`;
}

function buildUserPrompt(playerInput: string, gameState: GameState): string {
  return `PLAYER INPUT: ${playerInput}

CURRENT GAME STATE:
- Location: ${gameState.currentLocation}
- Inventory: ${gameState.inventory.join(', ') || 'Empty'}
- Recent choices: ${gameState.choices.slice(-3).join(', ') || 'None'}

Respond as the Game Master, continuing the narrative based on the player's input.`;
}

function updateGameState(
  gameState: GameState,
  playerInput: string,
  aiResponse: string
): GameState {
  const timestamp = new Date().toISOString();
  return {
    ...gameState,
    narrative: [
      ...gameState.narrative,
      { timestamp, content: `Player: ${playerInput}`, type: 'choice' },
      { timestamp, content: aiResponse, type: 'narration' },
    ],
  };
}

function extractChoices(aiResponse: string): string[] | undefined {
  const choiceMatches = aiResponse.match(
    /(?:^|\n)(?:\d+\.|\*|-)\s*(.+?)(?=\n|$)/g
  );
  if (choiceMatches && choiceMatches.length > 0) {
    return choiceMatches.map((choice) =>
      choice.replace(/^(?:\d+\.|\*|-)\s*/, '').trim()
    );
  }
  return undefined;
}

function extractStructuredExtras(aiResponse: string):
  | {
      choices?: string[];
      statCheck?: {
        stat: string;
        difficulty: number;
        result?: number;
        success?: boolean;
      };
      combat?: {
        enemies: string[];
        playerHealth: number;
        enemyHealth: Record<string, number>;
      };
    }
  | undefined {
  const match = aiResponse.match(/<engine-struct>([\s\S]*?)<\/engine-struct>/i);
  if (!match?.[1]) return undefined;
  try {
    const json = JSON.parse(match[1].trim());
    const out: {
      choices?: string[];
      statCheck?: {
        stat: string;
        difficulty: number;
        result?: number;
        success?: boolean;
      };
      combat?: {
        enemies: string[];
        playerHealth: number;
        enemyHealth: Record<string, number>;
      };
    } = {};
    if (Array.isArray(json.choices)) {
      out.choices = json.choices.map((c: unknown) => String(c)).slice(0, 4);
    }
    if (json.statCheck && typeof json.statCheck === 'object') {
      const sc = json.statCheck as {
        stat?: unknown;
        difficulty?: unknown;
        result?: unknown;
        success?: unknown;
      };
      if (typeof sc.stat === 'string' && typeof sc.difficulty !== 'undefined') {
        out.statCheck = {
          stat: sc.stat,
          difficulty: Number(sc.difficulty),
          ...(typeof sc.result !== 'undefined'
            ? { result: Number(sc.result) }
            : {}),
          ...(typeof sc.success !== 'undefined'
            ? { success: Boolean(sc.success) }
            : {}),
        } as any;
      }
    }
    if (json.combat && typeof json.combat === 'object') {
      const cb = json.combat as {
        enemies?: unknown;
        playerHealth?: unknown;
        enemyHealth?: unknown;
      };
      out.combat = {
        enemies: Array.isArray(cb.enemies)
          ? cb.enemies.map((e: unknown) => String(e))
          : [],
        playerHealth: Number(cb.playerHealth ?? 0),
        enemyHealth: (cb.enemyHealth as Record<string, number>) || {},
      };
    }
    return out;
  } catch {
    return undefined;
  }
}

function ensureCompleteStatCheck(input?: {
  stat: string;
  difficulty: number;
  result?: number;
  success?: boolean;
}):
  | {
      stat: string;
      difficulty: number;
      result: number;
      success: boolean;
    }
  | undefined {
  if (!input) return undefined;
  const rolled =
    typeof input.result === 'number'
      ? input.result
      : Math.floor(Math.random() * 20) + 1;
  const succeeded =
    typeof input.success === 'boolean'
      ? input.success
      : rolled >= input.difficulty;
  return {
    stat: input.stat,
    difficulty: input.difficulty,
    result: rolled,
    success: succeeded,
  };
}

function extractStatCheck(aiResponse: string):
  | {
      stat: string;
      difficulty: number;
      result: number;
      success: boolean;
    }
  | undefined {
  const statCheckMatch = aiResponse.match(/Make a (\w+) check \(DC (\d+)\)/i);
  if (statCheckMatch?.[1] && statCheckMatch[2]) {
    const stat = statCheckMatch[1];
    const difficulty = parseInt(statCheckMatch[2]);
    const result = Math.floor(Math.random() * 20) + 1;
    return { stat, difficulty, result, success: result >= difficulty };
  }
  return undefined;
}

function extractCombat(aiResponse: string):
  | {
      enemies: string[];
      playerHealth: number;
      enemyHealth: Record<string, number>;
    }
  | undefined {
  if (
    aiResponse.toLowerCase().includes('combat') ||
    aiResponse.toLowerCase().includes('battle')
  ) {
    return {
      enemies: ['Unknown enemy'],
      playerHealth: 100,
      enemyHealth: { 'Unknown enemy': 50 },
    };
  }
  return undefined;
}
