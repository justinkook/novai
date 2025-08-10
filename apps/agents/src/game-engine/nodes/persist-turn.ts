import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { persistTurn } from '../persistence.js';
import type { GameEngineState } from '../state.js';
import type { GameState } from '../types.js';

export async function persistEngineTurnNode(
  state: GameEngineState,
  _config: LangGraphRunnableConfig
): Promise<Partial<GameEngineState>> {
  const sessionId = (state as Record<string, unknown>)?.sessionId as
    | string
    | undefined;
  const results = state.gameEngineResults;
  if (!sessionId || !results) {
    // Pass-through unchanged
    return {};
  }
  try {
    await persistTurn({
      sessionId,
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
