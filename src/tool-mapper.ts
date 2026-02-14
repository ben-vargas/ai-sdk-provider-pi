import type {
  JSONValue,
  LanguageModelV3CallOptions,
  LanguageModelV3ToolCall,
  LanguageModelV3ToolChoice,
  LanguageModelV3ToolResult,
} from '@ai-sdk/provider';
import type { ToolCall, ToolResultMessage } from '@mariozechner/pi-ai';

import { DEFAULT_MAX_TOOL_RESULT_SIZE } from './constants.js';
import type { Logger } from './types.js';

export function validateAndMapToolChoice(
  toolChoice: LanguageModelV3ToolChoice | undefined,
  logger: Logger,
): string[] {
  if (toolChoice == null) {
    return [];
  }

  const warnings: string[] = [];
  const warning = `toolChoice "${toolChoice.type}" is advisory only for Pi provider-executed tools.`;
  logger.warn(warning);
  warnings.push(warning);
  return warnings;
}

export function validatePassedTools(
  tools: LanguageModelV3CallOptions['tools'],
  logger: Logger,
): string[] {
  if (tools == null || tools.length === 0) {
    return [];
  }

  const warning =
    'AI SDK tools were passed to Pi, but Pi executes its own built-in tools. Passed tools are ignored.';
  logger.warn(warning);
  return [warning];
}

export function mapPiToolCall(toolCall: ToolCall): LanguageModelV3ToolCall {
  return {
    type: 'tool-call',
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    input: safeStringify(toolCall.arguments ?? {}),
    providerExecuted: true,
  };
}

export function mapPiToolResultMessage(
  toolResult: ToolResultMessage,
  maxToolResultSize = DEFAULT_MAX_TOOL_RESULT_SIZE,
): LanguageModelV3ToolResult {
  const outputText = toolResult.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');

  const payload: JSONValue = {
    text: outputText,
    details: toJsonValue(toolResult.details),
  };

  return {
    type: 'tool-result',
    toolCallId: toolResult.toolCallId,
    toolName: toolResult.toolName,
    result: truncateJsonValue(payload, maxToolResultSize),
    isError: toolResult.isError,
  };
}

export function mapPiToolExecutionResult(
  params: {
    toolCallId: string;
    toolName: string;
    result: unknown;
    isError: boolean;
  },
  maxToolResultSize = DEFAULT_MAX_TOOL_RESULT_SIZE,
): LanguageModelV3ToolResult {
  return {
    type: 'tool-result',
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    result: truncateJsonValue(toJsonValue(params.result), maxToolResultSize),
    isError: params.isError,
  };
}

function truncateJsonValue(value: JSONValue, maxSize: number): NonNullable<JSONValue> {
  const serialized = safeStringify(value);

  if (serialized.length <= maxSize) {
    return ensureNonNullJsonValue(value);
  }

  return {
    truncated: true,
    maxSize,
    preview: `${serialized.slice(0, maxSize)}...`,
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return String(value);
  }
}

function toJsonValue(value: unknown): JSONValue {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, JSONValue> = {};

    for (const [key, item] of Object.entries(record)) {
      out[key] = toJsonValue(item);
    }

    return out;
  }

  return String(value);
}

function ensureNonNullJsonValue(value: JSONValue): NonNullable<JSONValue> {
  return value === null ? { value: null } : value;
}
