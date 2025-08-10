import type { BaseMessage } from '@langchain/core/messages';
import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type { ArtifactV3 } from '@workspace/shared/types';
import type { GameResponse } from './types.js';

export const GameEngineGraphAnnotation = Annotation.Root({
  /**
   * The chat history that feeds the engine.
   */
  ...MessagesAnnotation.spec,
  /**
   * Internal message stream used to carry engine follow-ups back to the parent graph.
   */
  _messages: Annotation<BaseMessage[], BaseMessage[]>({
    reducer: (state, update) => {
      const updates = Array.isArray(update) ? update : [update];
      return [...state, ...updates];
    },
    default: () => [],
  }),
  /**
   * The engine-generated artifact or narration args.
   */
  artifact: Annotation<ArtifactV3 | undefined>,
  /**
   * Structured extras emitted by the engine (choices, checks, etc.)
   */
  gameEngineResults: Annotation<GameResponse | undefined>,
  /**
   * The original thread ID to use to update the message state.
   */
  threadId: Annotation<string>,
  /**
   * Latest raw player input extracted from messages for persistence/analytics.
   */
  lastPlayerInput: Annotation<string | undefined>,
});

export type GameEngineState = typeof GameEngineGraphAnnotation.State;
