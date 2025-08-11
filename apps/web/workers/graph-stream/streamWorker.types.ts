import type { ALL_MODEL_NAMES } from '@workspace/shared/models';
import type { CustomModelConfig, GraphInput } from '@workspace/shared/types';

export interface StreamWorkerMessage {
  type: 'chunk' | 'done' | 'error';
  data?: string;
  error?: string;
}

export interface StreamConfig {
  threadId: string;
  assistantId: string;
  assistantName?: string;
  input: GraphInput;
  modelName: ALL_MODEL_NAMES;
  modelConfigs: Record<string, CustomModelConfig>;
}
