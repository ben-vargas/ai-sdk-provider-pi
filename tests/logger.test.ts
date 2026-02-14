import { describe, expect, it, vi } from 'vitest';

import { createVerboseLogger, getLogger } from '../src/logger.js';

describe('logger', () => {
  it('returns noop logger when disabled', () => {
    const logger = getLogger(false);

    expect(() => logger.debug('x')).not.toThrow();
    expect(() => logger.info('x')).not.toThrow();
    expect(() => logger.warn('x')).not.toThrow();
    expect(() => logger.error('x')).not.toThrow();
  });

  it('preserves method binding for custom logger', () => {
    const calls: string[] = [];
    const custom = {
      prefix: 'p',
      debug(this: { prefix: string }, message: string) {
        calls.push(`${this.prefix}:${message}`);
      },
      info(this: { prefix: string }, message: string) {
        calls.push(`${this.prefix}:${message}`);
      },
      warn(this: { prefix: string }, message: string) {
        calls.push(`${this.prefix}:${message}`);
      },
      error(this: { prefix: string }, message: string) {
        calls.push(`${this.prefix}:${message}`);
      },
    };

    const logger = getLogger(custom);
    logger.debug('debug');

    expect(calls).toContain('p:debug');
  });

  it('filters debug/info when verbose=false', () => {
    const raw = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const logger = createVerboseLogger(raw, false);
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(raw.debug).not.toHaveBeenCalled();
    expect(raw.info).not.toHaveBeenCalled();
    expect(raw.warn).toHaveBeenCalledWith('w');
    expect(raw.error).toHaveBeenCalledWith('e');
  });
});
