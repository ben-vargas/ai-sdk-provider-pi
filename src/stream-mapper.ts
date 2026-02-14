import type {
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
  SharedV3Warning,
} from '@ai-sdk/provider';
import type { AgentSessionEvent } from '@mariozechner/pi-coding-agent';
import type { AssistantMessage, Usage } from '@mariozechner/pi-ai';

import { mapPiFinishReason } from './map-pi-finish-reason.js';
import { mapPiToolCall, mapPiToolExecutionResult } from './tool-mapper.js';

export interface ToolStreamState {
  toolCallId: string;
  toolName: string;
  inputStarted: boolean;
  inputClosed: boolean;
  callEmitted: boolean;
}

export interface StreamMapperContext {
  toolState: Map<string, ToolStreamState>;
  maxToolResultSize: number;
  warnings: SharedV3Warning[];
  streamStarted: boolean;
}

export interface MappedStreamEvent {
  parts: LanguageModelV3StreamPart[];
  streamStarted: boolean;
}

export function mapPiEventToStreamParts(
  event: AgentSessionEvent,
  context: StreamMapperContext,
): MappedStreamEvent {
  const parts: LanguageModelV3StreamPart[] = [];
  let streamStarted = context.streamStarted;

  if (event.type === 'message_update') {
    const mapped = mapAssistantMessageEvent(event, context);
    parts.push(...mapped.parts);
    streamStarted = mapped.streamStarted;
  }

  if (event.type === 'tool_execution_end') {
    parts.push(
      mapPiToolExecutionResult(
        {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          result: event.result,
          isError: event.isError,
        },
        context.maxToolResultSize,
      ),
    );
  }

  return {
    parts,
    streamStarted,
  };
}

function mapAssistantMessageEvent(
  event: Extract<AgentSessionEvent, { type: 'message_update' }>,
  context: StreamMapperContext,
): MappedStreamEvent {
  const messageEvent = event.assistantMessageEvent;
  const parts: LanguageModelV3StreamPart[] = [];
  let streamStarted = context.streamStarted;

  switch (messageEvent.type) {
    case 'start': {
      if (!streamStarted) {
        parts.push({ type: 'stream-start', warnings: context.warnings });
        streamStarted = true;
      }

      parts.push({
        type: 'response-metadata',
        timestamp: new Date(messageEvent.partial.timestamp),
        modelId: messageEvent.partial.model,
      });
      break;
    }
    case 'text_start': {
      parts.push({ type: 'text-start', id: getTextPartId(messageEvent.contentIndex) });
      break;
    }
    case 'text_delta': {
      parts.push({
        type: 'text-delta',
        id: getTextPartId(messageEvent.contentIndex),
        delta: messageEvent.delta,
      });
      break;
    }
    case 'text_end': {
      parts.push({ type: 'text-end', id: getTextPartId(messageEvent.contentIndex) });
      break;
    }
    case 'thinking_start': {
      parts.push({ type: 'reasoning-start', id: getReasoningPartId(messageEvent.contentIndex) });
      break;
    }
    case 'thinking_delta': {
      parts.push({
        type: 'reasoning-delta',
        id: getReasoningPartId(messageEvent.contentIndex),
        delta: messageEvent.delta,
      });
      break;
    }
    case 'thinking_end': {
      parts.push({ type: 'reasoning-end', id: getReasoningPartId(messageEvent.contentIndex) });
      break;
    }
    case 'toolcall_start': {
      const toolCall = getToolCallFromPartial(messageEvent.partial, messageEvent.contentIndex);
      const toolCallId = toolCall?.id ?? getToolPartId(messageEvent.contentIndex);
      const toolName = toolCall?.name ?? 'unknown';
      context.toolState.set(getToolStateKey(messageEvent.contentIndex), {
        toolCallId,
        toolName,
        inputStarted: true,
        inputClosed: false,
        callEmitted: false,
      });

      parts.push({
        type: 'tool-input-start',
        id: toolCallId,
        toolName,
        providerExecuted: true,
      });
      break;
    }
    case 'toolcall_delta': {
      const state =
        context.toolState.get(getToolStateKey(messageEvent.contentIndex)) ??
        defaultToolState(messageEvent.contentIndex);

      parts.push({
        type: 'tool-input-delta',
        id: state.toolCallId,
        delta: messageEvent.delta,
      });
      break;
    }
    case 'toolcall_end': {
      const key = getToolStateKey(messageEvent.contentIndex);
      const existing = context.toolState.get(key) ?? defaultToolState(messageEvent.contentIndex);
      existing.toolCallId = messageEvent.toolCall.id;
      existing.toolName = messageEvent.toolCall.name;

      if (!existing.inputClosed) {
        parts.push({ type: 'tool-input-end', id: existing.toolCallId });
        existing.inputClosed = true;
      }

      if (!existing.callEmitted) {
        parts.push(mapPiToolCall(messageEvent.toolCall));
        existing.callEmitted = true;
      }

      context.toolState.set(key, existing);
      break;
    }
    case 'done': {
      parts.push({
        type: 'finish',
        usage: mapPiUsageToLanguageModelUsage(messageEvent.message.usage),
        finishReason: mapPiFinishReason(messageEvent.reason),
      });
      break;
    }
    case 'error': {
      const finishReason: LanguageModelV3FinishReason = mapPiFinishReason(messageEvent.reason);
      const usage = mapPiUsageToLanguageModelUsage(messageEvent.error.usage);
      parts.push({
        type: 'finish',
        finishReason,
        usage,
      });
      break;
    }
  }

  return {
    parts,
    streamStarted,
  };
}

function getToolCallFromPartial(message: AssistantMessage, contentIndex: number) {
  const part = message.content[contentIndex];
  if (part?.type !== 'toolCall') {
    return undefined;
  }

  return part;
}

export function mapPiUsageToLanguageModelUsage(usage: Usage | undefined): LanguageModelV3Usage {
  if (usage == null) {
    return {
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: undefined,
        text: undefined,
        reasoning: undefined,
      },
    };
  }

  const noCache = usage.cacheRead > 0 ? Math.max(usage.input - usage.cacheRead, 0) : usage.input;

  return {
    inputTokens: {
      total: usage.input,
      noCache,
      cacheRead: usage.cacheRead,
      cacheWrite: usage.cacheWrite,
    },
    outputTokens: {
      total: usage.output,
      text: usage.output,
      reasoning: undefined,
    },
    raw: {
      input: usage.input,
      output: usage.output,
      cacheRead: usage.cacheRead,
      cacheWrite: usage.cacheWrite,
      totalTokens: usage.totalTokens,
      cost: usage.cost,
    },
  };
}

function getTextPartId(contentIndex: number): string {
  return `text-${contentIndex}`;
}

function getReasoningPartId(contentIndex: number): string {
  return `reasoning-${contentIndex}`;
}

function getToolPartId(contentIndex: number): string {
  return `tool-${contentIndex}`;
}

function getToolStateKey(contentIndex: number): string {
  return `tool-state-${contentIndex}`;
}

function defaultToolState(contentIndex: number): ToolStreamState {
  return {
    toolCallId: getToolPartId(contentIndex),
    toolName: 'unknown',
    inputStarted: false,
    inputClosed: false,
    callEmitted: false,
  };
}
