export * from './dnd-5e';
export * from './prompt-templates';

import { DND_5E_SYSTEM_PROMPT } from './dnd-5e';

export function getRulesetPrompt(ruleset: string): string {
  if (ruleset === 'dnd-5e') {
    return DND_5E_SYSTEM_PROMPT;
  }
  return 'Use common-sense RPG rules for checks and combat.';
}

export function getCampaignSystemPrompt(
  campaignId: string
): string | undefined {
  // Extend if you want per-campaign extra prompting
  if (campaignId === 'baldurs-gate-3') {
    return "You are narrating Baldur's Gate 3. Emphasize dark, mature tone and companions.";
  }
  return undefined;
}
