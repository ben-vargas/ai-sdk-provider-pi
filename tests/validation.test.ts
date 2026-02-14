import { describe, expect, it, vi } from 'vitest';

import { validateCallOptions, validateModelId, validateSettings } from '../src/validation.js';

describe('validation', () => {
  it('accepts valid settings', () => {
    const result = validateSettings({
      tools: 'coding',
      thinkingLevel: 'medium',
      maxToolResultSize: 100,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid settings', () => {
    const result = validateSettings({
      maxToolResultSize: -1,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('warns for model id without provider prefix', () => {
    expect(validateModelId('claude-sonnet')).toContain('Expected provider/model');
  });

  it('reports unsupported call options as warnings', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const warnings = validateCallOptions(
      {
        prompt: [{ role: 'system', content: 'x' }],
        topP: 0.9,
        seed: 5,
      },
      logger,
    );

    expect(warnings.join('\n')).toContain('topP');
    expect(warnings.join('\n')).toContain('seed');
    expect(logger.warn).toHaveBeenCalled();
  });
});
