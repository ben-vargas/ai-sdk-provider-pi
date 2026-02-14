import { APICallError, LoadAPIKeyError } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';

import {
  isAbortError,
  isAuthenticationError,
  isRetryableError,
  isTimeoutError,
  mapPiError,
} from '../src/errors.js';

describe('errors', () => {
  it('classifies auth and timeout errors', () => {
    expect(isAuthenticationError(new Error('Missing API key'))).toBe(true);
    expect(isTimeoutError({ code: 'ETIMEDOUT', message: 'timed out' })).toBe(true);
    expect(isAbortError({ name: 'AbortError', message: 'aborted' })).toBe(true);
  });

  it('maps auth errors to LoadAPIKeyError', () => {
    const mapped = mapPiError(new Error('authentication failed'));
    expect(LoadAPIKeyError.isInstance(mapped)).toBe(true);
  });

  it('maps generic errors to APICallError', () => {
    const mapped = mapPiError(new Error('boom'));
    expect(APICallError.isInstance(mapped)).toBe(true);
  });

  it('keeps original timeout context in mapped timeout errors', () => {
    const mapped = mapPiError({
      code: 'ETIMEDOUT',
      message: 'socket timeout while reading response',
    });

    expect(APICallError.isInstance(mapped)).toBe(true);
    expect(mapped.message).toContain('socket timeout while reading response');
  });

  it('detects retryable status codes', () => {
    expect(isRetryableError({ statusCode: 500, message: 'server error' })).toBe(true);
    expect(isRetryableError({ statusCode: 401, message: 'unauthorized' })).toBe(false);
  });
});
