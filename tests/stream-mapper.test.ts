import { describe, expect, it } from 'vitest';

import { mapPiEventToStreamParts } from '../src/stream-mapper.js';

const usage = {
  input: 10,
  output: 5,
  cacheRead: 1,
  cacheWrite: 0,
  totalTokens: 15,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
};

const baseAssistant = {
  role: 'assistant' as const,
  content: [],
  api: 'anthropic-messages' as const,
  provider: 'anthropic',
  model: 'claude-sonnet-4',
  usage,
  stopReason: 'stop' as const,
  timestamp: Date.now(),
};

describe('stream-mapper', () => {
  it('maps start event to stream-start + response metadata', () => {
    const context = {
      toolState: new Map(),
      maxToolResultSize: 1000,
      warnings: [{ type: 'compatibility' as const, feature: 'pi-provider', details: 'x' }],
      streamStarted: false,
    };

    const mapped = mapPiEventToStreamParts(
      {
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'start',
          partial: baseAssistant,
        },
      },
      context,
    );

    expect(mapped.parts[0]).toMatchObject({ type: 'stream-start' });
    expect(mapped.parts[1]).toMatchObject({ type: 'response-metadata', modelId: 'claude-sonnet-4' });
  });

  it('maps tool call lifecycle', () => {
    const context = {
      toolState: new Map(),
      maxToolResultSize: 1000,
      warnings: [],
      streamStarted: true,
    };

    const start = mapPiEventToStreamParts(
      {
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'toolcall_start',
          contentIndex: 0,
          partial: {
            ...baseAssistant,
            content: [{ type: 'toolCall', id: 't1', name: 'read', arguments: {} }],
          },
        },
      },
      context,
    );

    const delta = mapPiEventToStreamParts(
      {
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'toolcall_delta',
          contentIndex: 0,
          delta: '{"path":',
          partial: baseAssistant,
        },
      },
      context,
    );

    const end = mapPiEventToStreamParts(
      {
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'toolcall_end',
          contentIndex: 0,
          partial: baseAssistant,
          toolCall: { type: 'toolCall', id: 't1', name: 'read', arguments: { path: 'a' } },
        },
      },
      context,
    );

    expect(start.parts[0]).toMatchObject({ type: 'tool-input-start', id: 't1' });
    expect(delta.parts[0]).toMatchObject({ type: 'tool-input-delta', id: 't1' });
    expect(end.parts[0]).toMatchObject({ type: 'tool-input-end', id: 't1' });
    expect(end.parts[1]).toMatchObject({ type: 'tool-call', toolCallId: 't1', providerExecuted: true });
  });

  it('maps done event to finish', () => {
    const context = {
      toolState: new Map(),
      maxToolResultSize: 1000,
      warnings: [],
      streamStarted: true,
    };

    const mapped = mapPiEventToStreamParts(
      {
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'done',
          reason: 'toolUse',
          message: {
            ...baseAssistant,
            stopReason: 'toolUse',
          },
        },
      },
      context,
    );

    expect(mapped.parts[0]).toMatchObject({
      type: 'finish',
      finishReason: { unified: 'tool-calls', raw: 'toolUse' },
    });
  });
});
