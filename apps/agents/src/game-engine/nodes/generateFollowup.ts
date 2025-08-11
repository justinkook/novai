import { AIMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type {
  GameEngineGraphAnnotation,
  GameEngineGraphReturnType,
} from '../state.js';

/**
 * Generate a followup AI chat message that summarizes mechanics like choices,
 * stat checks, and combat from gameEngineResults. This message is for chat, not canvas.
 */
export const generateFollowup = async (
  state: typeof GameEngineGraphAnnotation.State,
  _config: LangGraphRunnableConfig
): Promise<GameEngineGraphReturnType> => {
  const results = state.gameEngineResults;
  const parts: string[] = [];

  if (results?.narration) {
    parts.push(`Narration:\n${results.narration}`);
  }

  if (results?.choices?.length) {
    parts.push(
      `Choices: ${results.choices
        .slice(0, 3)
        .map((c, i) => `${i + 1}. ${c}`)
        .join('  ')}`
    );
  }

  if (results?.statCheck) {
    parts.push(
      `Stat Check: ${results.statCheck.stat} (DC ${results.statCheck.difficulty}) — Result ${results.statCheck.result} — ${results.statCheck.success ? 'Success' : 'Fail'}`
    );
  }

  if (results?.combat) {
    parts.push(
      `Combat: Enemies ${results.combat.enemies.join(', ')} | PlayerHealth ${results.combat.playerHealth} | EnemyHealth ${JSON.stringify(
        results.combat.enemyHealth
      )}`
    );
  }

  const text = parts.length
    ? parts.join('\n\n')
    : 'Your move. Describe your action or ask for details.';

  const response = new AIMessage({ content: text });

  return {
    messages: [response],
    _messages: [response],
  };
};
