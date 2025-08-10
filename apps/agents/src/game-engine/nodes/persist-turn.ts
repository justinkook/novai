import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { persistTurn } from '../persistence.js';
import type { GameEngineState } from '../state.js';
import type { GameState } from '../types.js';

export async function persistEngineTurnNode(
  state: GameEngineState,
  _config: LangGraphRunnableConfig
): Promise<Partial<GameEngineState>> {
  const threadId = state.threadId;
  const results = state.gameEngineResults;
  if (!threadId || !results) {
    // Pass-through unchanged
    return {};
  }
  try {
    await persistTurn({
      threadId,
      gameState: (results as unknown as { updatedGameState: GameState })
        .updatedGameState,
      output: {
        narration: results.narration,
        choices: results.choices,
        statCheck: results.statCheck,
        combat: results.combat,
      },
    });
  } catch {
    // no-op
  }
  // Pass-through unchanged
  return {};
}
