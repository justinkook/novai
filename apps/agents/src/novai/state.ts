import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type { GameState } from '@workspace/engine';

export const Bg3GraphAnnotation = Annotation.Root({
  // Conversation history
  ...MessagesAnnotation.spec,
  // Active BG3 session id (propagated between nodes)
  sessionId: Annotation<string | undefined>,
  // Whether to save the current artifact as a chapter entry
  saveChapter: Annotation<boolean | undefined>,
  // The evolving game state for the active session
  gameState: Annotation<GameState | undefined>,
  // Parsed output from the latest engine turn
  output: Annotation<
    | {
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
      }
    | undefined
  >,
});

export type Bg3GraphState = typeof Bg3GraphAnnotation.State;
