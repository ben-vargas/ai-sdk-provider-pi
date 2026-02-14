export const DEFAULT_PROVIDER = 'anthropic';
export const DEFAULT_TOOL_SET = 'coding';
export const DEFAULT_SESSION_PERSISTENCE = 'memory';
export const DEFAULT_MAX_TOOL_RESULT_SIZE = 10_000;
export const DEFAULT_THINKING_LEVEL = 'medium';
export const PROVIDER_ID = 'pi';

export const UNSUPPORTED_CALL_OPTIONS = [
  'frequencyPenalty',
  'presencePenalty',
  'topP',
  'topK',
  'seed',
  'stopSequences',
] as const;
