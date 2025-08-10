import { v4 as uuidv4 } from 'uuid';
import type { Campaign, GameState } from '../types.js';
import { BG3_CAMPAIGN } from './bg3.js';

export const CAMPAIGNS: Record<string, Campaign> = {
  [BG3_CAMPAIGN.id]: BG3_CAMPAIGN,
};

export function getCampaign(campaignId: string): Campaign {
  const c = CAMPAIGNS[campaignId];
  if (!c) {
    throw new Error(`Unknown campaign: ${campaignId}`);
  }
  return c;
}

export function createInitialGameState(
  campaignId: string,
  playerName: string
): GameState {
  const campaign = getCampaign(campaignId);
  const startLocation =
    campaign.locations?.[0]?.id || campaign.locations?.[0]?.name || 'start';
  return {
    id: uuidv4(),
    campaignId,
    playerName,
    currentLocation: String(startLocation),
    companions: [],
    inventory: [],
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    } as unknown as Record<string, number>,
    choices: [],
    narrative: [
      {
        timestamp: new Date().toISOString(),
        content: campaign.intro,
        type: 'narration',
      },
    ],
  };
}
