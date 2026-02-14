import {
  APICallError,
  type JSONValue,
  LoadAPIKeyError,
  type JSONObject,
  getErrorMessage,
} from '@ai-sdk/provider';
import { isContextOverflow } from '@mariozechner/pi-ai';
import type { AssistantMessage } from '@mariozechner/pi-ai';

const PI_LOCAL_URL = 'pi://local';

export interface PiErrorMetadata {
  sessionId?: string;
  modelId?: string;
  isRetryable: boolean;
}

export function createAPICallError(error: unknown, metadata?: PiErrorMetadata): APICallError {
  const isRetryable = metadata?.isRetryable ?? isRetryableError(error);

  const data: JSONObject = {
    sessionId: metadata?.sessionId,
    modelId: metadata?.modelId,
  };

  return new APICallError({
    message: getErrorMessage(error),
    url: PI_LOCAL_URL,
    requestBodyValues: {},
    cause: error,
    isRetryable,
    data,
  });
}

export function createAuthenticationError(error: unknown): LoadAPIKeyError {
  return new LoadAPIKeyError({
    message: `Pi authentication error: ${getErrorMessage(error)}`,
  });
}

export function createTimeoutError(timeoutMs: number): APICallError {
  return new APICallError({
    message: `Pi request timed out after ${timeoutMs}ms`,
    url: PI_LOCAL_URL,
    requestBodyValues: {},
    isRetryable: true,
  });
}

export function isAuthenticationError(error: unknown): boolean {
  const message = getLowerMessage(error);
  return (
    message.includes('api key') ||
    message.includes('authentication') ||
    message.includes('credentials') ||
    message.includes('/login') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  );
}

export function isTimeoutError(error: unknown): boolean {
  if (hasNamedError(error, 'TimeoutError')) {
    return true;
  }

  const code = getObjectString(error, 'code');
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
    return true;
  }

  const message = getLowerMessage(error);
  return message.includes('timeout') || message.includes('timed out');
}

export function isAbortError(error: unknown): boolean {
  if (hasNamedError(error, 'AbortError')) {
    return true;
  }

  const message = getLowerMessage(error);
  return message.includes('aborted') || message.includes('cancelled') || message.includes('canceled');
}

export function isOutputLengthError(error: unknown): boolean {
  const assistantMessage = getAssistantMessage(error);
  if (assistantMessage != null) {
    return isContextOverflow(assistantMessage);
  }

  const message = getLowerMessage(error);
  return message.includes('context window') || message.includes('maximum context') || message.includes('max tokens');
}

export function isRetryableError(error: unknown): boolean {
  if (isAuthenticationError(error) || isAbortError(error)) {
    return false;
  }

  if (isTimeoutError(error)) {
    return true;
  }

  const statusCode = getStatusCode(error);
  if (statusCode === 429) {
    return true;
  }

  if (statusCode != null) {
    if (statusCode >= 500) {
      return true;
    }

    if (statusCode >= 400) {
      return false;
    }
  }

  const message = getLowerMessage(error);
  return (
    message.includes('rate limit') ||
    message.includes('temporarily unavailable') ||
    message.includes('connection reset') ||
    message.includes('econnreset')
  );
}

export function mapPiError(error: unknown, metadata?: PiErrorMetadata): Error {
  if (LoadAPIKeyError.isInstance(error) || APICallError.isInstance(error)) {
    return error;
  }

  if (isAuthenticationError(error)) {
    return createAuthenticationError(error);
  }

  if (isTimeoutError(error)) {
    return new APICallError({
      message: `Pi request timed out: ${getErrorMessage(error)}`,
      url: PI_LOCAL_URL,
      requestBodyValues: {},
      cause: error,
      isRetryable: true,
    });
  }

  if (isAbortError(error)) {
    return new APICallError({
      message: 'Pi request aborted',
      url: PI_LOCAL_URL,
      requestBodyValues: {},
      cause: error,
      isRetryable: false,
    });
  }

  if (isOutputLengthError(error)) {
    return new APICallError({
      message: `Pi output length/context overflow: ${getErrorMessage(error)}`,
      url: PI_LOCAL_URL,
      requestBodyValues: {},
      cause: error,
      isRetryable: false,
      data: {
        type: 'context-overflow' as JSONValue,
      },
    });
  }

  return createAPICallError(error, metadata);
}

function getLowerMessage(error: unknown): string {
  return getErrorMessage(error).toLowerCase();
}

function hasNamedError(error: unknown, name: string): boolean {
  return typeof error === 'object' && error != null && 'name' in error && (error as { name?: unknown }).name === name;
}

function getObjectString(error: unknown, key: string): string | undefined {
  if (typeof error !== 'object' || error == null || !(key in error)) {
    return undefined;
  }

  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error == null) {
    return undefined;
  }

  const statusCode = (error as Record<string, unknown>).statusCode;
  if (typeof statusCode === 'number') {
    return statusCode;
  }

  const status = (error as Record<string, unknown>).status;
  return typeof status === 'number' ? status : undefined;
}

function getAssistantMessage(error: unknown): AssistantMessage | undefined {
  if (isAssistantMessage(error)) {
    return error;
  }

  if (typeof error === 'object' && error != null && 'message' in error) {
    const nested = (error as Record<string, unknown>).message;
    if (isAssistantMessage(nested)) {
      return nested;
    }
  }

  return undefined;
}

function isAssistantMessage(value: unknown): value is AssistantMessage {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const candidate = value as Partial<AssistantMessage>;
  return candidate.role === 'assistant' && Array.isArray(candidate.content) && typeof candidate.stopReason === 'string';
}
