import type { LanguageModelV3FinishReason } from '@ai-sdk/provider';
import type { StopReason } from '@mariozechner/pi-ai';

export function mapPiFinishReason(reason: StopReason | undefined): LanguageModelV3FinishReason {
  switch (reason) {
    case 'stop':
      return { unified: 'stop', raw: 'stop' };
    case 'length':
      return { unified: 'length', raw: 'length' };
    case 'toolUse':
      return { unified: 'tool-calls', raw: 'toolUse' };
    case 'error':
      return { unified: 'error', raw: 'error' };
    case 'aborted':
      return { unified: 'other', raw: 'aborted' };
    default:
      return { unified: 'other', raw: reason };
  }
}
