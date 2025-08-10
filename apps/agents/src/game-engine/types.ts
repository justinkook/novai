import { z } from 'zod';

export const GameStateSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  playerName: z.string(),
  currentLocation: z.string(),
  companions: z.array(z.string()),
  inventory: z.array(z.string()),
  stats: z.record(z.number()),
  choices: z.array(z.string()),
  narrative: z.array(
    z.object({
      timestamp: z.string(),
      content: z.string(),
      type: z.enum(['narration', 'choice', 'combat', 'stat-check']),
    })
  ),
  metadata: z.record(z.unknown()).optional(),
});

export type GameState = z.infer<typeof GameStateSchema>;

export const CampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  ruleset: z.string(),
  intro: z.string(),
  companions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      stats: z.record(z.number()).optional(),
    })
  ),
  locations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      connections: z.array(z.string()).optional(),
    })
  ),
  plot: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      requirements: z.array(z.string()).optional(),
    })
  ),
});

export type Campaign = z.infer<typeof CampaignSchema>;

export type GameResponse = {
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
};
