import { NoSuchModelError } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';

import { createPi } from '../src/pi-provider.js';

describe('pi-provider', () => {
  it('creates a callable provider and language models', () => {
    const provider = createPi();

    const modelViaCall = provider('anthropic/claude-sonnet-4');
    const modelViaMethod = provider.languageModel('anthropic/claude-sonnet-4');
    const modelViaChat = provider.chat('anthropic/claude-sonnet-4');

    expect(provider.specificationVersion).toBe('v3');
    expect(modelViaCall.specificationVersion).toBe('v3');
    expect(modelViaMethod.specificationVersion).toBe('v3');
    expect(modelViaChat.specificationVersion).toBe('v3');
  });

  it('throws for unsupported embedding/image models', () => {
    const provider = createPi();

    expect(() => provider.embeddingModel('x')).toThrowError(NoSuchModelError);
    expect(() => provider.imageModel('x')).toThrowError(NoSuchModelError);
  });

  it('validates default settings at construction', () => {
    expect(() =>
      createPi({
        defaultSettings: {
          maxToolResultSize: -1,
        },
      }),
    ).toThrow('Invalid default Pi settings');
  });
});
