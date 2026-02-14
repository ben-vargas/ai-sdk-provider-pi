import { LoadAPIKeyError } from '@ai-sdk/provider';
import { describe, expect, it, vi } from 'vitest';

import { PiLanguageModel } from '../src/pi-language-model.js';
import type { PiSessionManager } from '../src/pi-session-manager.js';

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

function createFakeSession() {
  const listeners = new Set<(event: any) => void>();
  const prompt = vi.fn(async (_text: string, _options: any) => {
    const baseAssistant = {
      role: 'assistant',
      content: [{ type: 'text', text: 'hello world' }],
      api: 'anthropic-messages',
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      usage,
      stopReason: 'stop',
      timestamp: Date.now(),
    };

    for (const listener of listeners) {
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'start',
          partial: baseAssistant,
        },
      });
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'text_start',
          contentIndex: 0,
          partial: baseAssistant,
        },
      });
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'text_delta',
          contentIndex: 0,
          delta: 'hello world',
          partial: baseAssistant,
        },
      });
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'text_end',
          contentIndex: 0,
          content: 'hello world',
          partial: baseAssistant,
        },
      });
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'done',
          reason: 'stop',
          message: baseAssistant,
        },
      });
      listener({ type: 'agent_end', messages: [baseAssistant] });
    }
  });

  return {
    prompt,
    subscribe: vi.fn((listener: (event: any) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    abort: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
}

async function readAll(stream: ReadableStream<any>) {
  const reader = stream.getReader();
  const parts: any[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    parts.push(value);
  }
  return parts;
}

function createFakeSessionWithTools() {
  const listeners = new Set<(event: any) => void>();
  const prompt = vi.fn(async (_text: string, _options: any) => {
    const baseAssistant = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me read that file.' },
        { type: 'toolCall', id: 'tc-1', name: 'read', arguments: { path: 'README.md' } },
      ],
      api: 'anthropic-messages',
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      usage,
      stopReason: 'toolUse',
      timestamp: Date.now(),
    };

    for (const listener of listeners) {
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: { type: 'start', partial: baseAssistant },
      });
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: { type: 'text_start', contentIndex: 0, partial: baseAssistant },
      });
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'text_delta',
          contentIndex: 0,
          delta: 'Let me read that file.',
          partial: baseAssistant,
        },
      });
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'text_end',
          contentIndex: 0,
          content: 'Let me read that file.',
          partial: baseAssistant,
        },
      });
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: { type: 'toolcall_start', contentIndex: 1, partial: baseAssistant },
      });
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'toolcall_delta',
          contentIndex: 1,
          delta: '{"path":"README.md"}',
          partial: baseAssistant,
        },
      });
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'toolcall_end',
          contentIndex: 1,
          partial: baseAssistant,
          toolCall: {
            type: 'toolCall',
            id: 'tc-1',
            name: 'read',
            arguments: { path: 'README.md' },
          },
        },
      });
      listener({
        type: 'tool_execution_end',
        toolCallId: 'tc-1',
        toolName: 'read',
        result: '# README\nHello',
        isError: false,
      });
      listener({
        type: 'message_update',
        message: baseAssistant,
        assistantMessageEvent: {
          type: 'done',
          reason: 'toolUse',
          message: { ...baseAssistant, stopReason: 'toolUse' },
        },
      });
      listener({ type: 'agent_end', messages: [baseAssistant] });
    }
  });

  return {
    prompt,
    subscribe: vi.fn((listener: (event: any) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    abort: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
}

function createFakeSessionWithToolExecutionAndFinalText() {
  const listeners = new Set<(event: any) => void>();
  const prompt = vi.fn(async () => {
    const withToolCall = {
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'tc-2', name: 'ls', arguments: { path: '.' } }],
      api: 'anthropic-messages',
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      usage,
      stopReason: 'toolUse',
      timestamp: Date.now(),
    };

    const finalAssistant = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Done. Largest file is package-lock.json.' }],
      api: 'anthropic-messages',
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      usage,
      stopReason: 'stop',
      timestamp: Date.now(),
    };

    for (const listener of listeners) {
      listener({
        type: 'message_update',
        message: withToolCall,
        assistantMessageEvent: { type: 'start', partial: withToolCall },
      });
      listener({
        type: 'message_update',
        message: withToolCall,
        assistantMessageEvent: {
          type: 'toolcall_start',
          contentIndex: 0,
          partial: withToolCall,
        },
      });
      listener({
        type: 'message_update',
        message: withToolCall,
        assistantMessageEvent: {
          type: 'toolcall_delta',
          contentIndex: 0,
          delta: '{"path":"."}',
          partial: withToolCall,
        },
      });
      listener({
        type: 'message_update',
        message: withToolCall,
        assistantMessageEvent: {
          type: 'toolcall_end',
          contentIndex: 0,
          toolCall: { type: 'toolCall', id: 'tc-2', name: 'ls', arguments: { path: '.' } },
          partial: withToolCall,
        },
      });
      listener({
        type: 'tool_execution_end',
        toolCallId: 'tc-2',
        toolName: 'ls',
        result: 'file-a\nfile-b',
        isError: false,
      });
      listener({
        type: 'message_update',
        message: finalAssistant,
        assistantMessageEvent: { type: 'done', reason: 'stop', message: finalAssistant },
      });
      listener({ type: 'agent_end', messages: [finalAssistant] });
    }
  });

  return {
    prompt,
    subscribe: vi.fn((listener: (event: any) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    abort: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
}

describe('pi-language-model', () => {
  it('calls session.prompt with expandPromptTemplates=false and source=rpc', async () => {
    const fakeSession = createFakeSession();
    const runWithSession = vi.fn(async (_modelId, _settings, _logger, run) => run(fakeSession));

    const model = new PiLanguageModel(
      'anthropic/claude-sonnet-4',
      { instructions: 'i' },
      { runWithSession } as unknown as PiSessionManager,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    );

    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    });

    expect(fakeSession.prompt).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        expandPromptTemplates: false,
        source: 'rpc',
      }),
    );
  });

  it('returns structured output compatibility warning + metadata', async () => {
    const fakeSession = createFakeSession();
    const runWithSession = vi.fn(async (_modelId, _settings, _logger, run) => run(fakeSession));

    const model = new PiLanguageModel(
      'anthropic/claude-sonnet-4',
      {},
      { runWithSession } as unknown as PiSessionManager,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    );

    const result = await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      responseFormat: {
        type: 'json',
        schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
      },
    });

    expect(result.providerMetadata).toEqual({ pi: { structuredOutputValidated: false } });
    expect(
      result.warnings.some(
        (w) =>
          'details' in w &&
          typeof w.details === 'string' &&
          w.details.includes('structured outputs'),
      ),
    ).toBe(true);
  });

  it('streams mapped parts', async () => {
    const fakeSession = createFakeSession();
    const runWithSession = vi.fn(async (_modelId, _settings, _logger, run) => run(fakeSession));

    const model = new PiLanguageModel(
      'anthropic/claude-sonnet-4',
      {},
      { runWithSession } as unknown as PiSessionManager,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    );

    const streamResult = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    });

    const parts = await readAll(streamResult.stream);

    expect(parts.some((p) => p.type === 'stream-start')).toBe(true);
    expect(parts.some((p) => p.type === 'text-delta')).toBe(true);
    expect(parts.some((p) => p.type === 'finish')).toBe(true);
  });

  it('streams tool-call lifecycle: input-start, input-delta, input-end, tool-call, tool-result, finish', async () => {
    const fakeSession = createFakeSessionWithTools();
    const runWithSession = vi.fn(async (_modelId, _settings, _logger, run) => run(fakeSession));

    const model = new PiLanguageModel(
      'anthropic/claude-sonnet-4',
      {},
      { runWithSession } as unknown as PiSessionManager,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    );

    const streamResult = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'read README' }] }],
    });

    const parts = await readAll(streamResult.stream);
    const types = parts.map((p) => p.type);

    expect(types).toContain('stream-start');
    expect(types).toContain('text-delta');
    expect(types).toContain('tool-input-start');
    expect(types).toContain('tool-input-delta');
    expect(types).toContain('tool-input-end');
    expect(types).toContain('tool-call');
    expect(types).toContain('tool-result');
    expect(types).toContain('finish');

    const toolCall = parts.find((p) => p.type === 'tool-call');
    expect(toolCall.toolCallId).toBe('tc-1');
    expect(toolCall.toolName).toBe('read');
    expect(toolCall.providerExecuted).toBe(true);

    const toolResult = parts.find((p) => p.type === 'tool-result');
    expect(toolResult.toolCallId).toBe('tc-1');
    expect(toolResult.toolName).toBe('read');
    expect(toolResult.isError).toBe(false);

    const finish = parts.find((p) => p.type === 'finish');
    expect(finish.finishReason.unified).toBe('tool-calls');
    expect(finish.finishReason.raw).toBe('toolUse');
  });

  it('wires abortSignal to session.abort()', async () => {
    const abortController = new AbortController();
    const listeners = new Set<(event: any) => void>();
    const fakeSession = {
      prompt: vi.fn(async () => {
        abortController.abort();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }),
      subscribe: vi.fn((listener: (event: any) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
      abort: vi.fn(async () => {}),
      dispose: vi.fn(),
    };

    const runWithSession = vi.fn(async (_modelId, _settings, _logger, run) => run(fakeSession));

    const model = new PiLanguageModel(
      'anthropic/claude-sonnet-4',
      {},
      { runWithSession } as unknown as PiSessionManager,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    );

    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      abortSignal: abortController.signal,
    });

    expect(fakeSession.abort).toHaveBeenCalled();
  });

  it('doGenerate uses mapPiFinishReason consistently with doStream', async () => {
    const fakeSession = createFakeSessionWithTools();
    const runWithSession = vi.fn(async (_modelId, _settings, _logger, run) => run(fakeSession));

    const model = new PiLanguageModel(
      'anthropic/claude-sonnet-4',
      {},
      { runWithSession } as unknown as PiSessionManager,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    );

    const result = await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'read README' }] }],
    });

    expect(result.finishReason).toEqual({ unified: 'tool-calls', raw: 'toolUse' });
  });

  it('maps doGenerate errors through mapPiError', async () => {
    const runWithSession = vi.fn(async () => {
      throw new Error('authentication failed');
    });

    const model = new PiLanguageModel(
      'anthropic/claude-sonnet-4',
      {},
      { runWithSession } as unknown as PiSessionManager,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    );

    await expect(
      model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      }),
    ).rejects.toSatisfy((error) => LoadAPIKeyError.isInstance(error));
  });

  it('emits matching tool-call content for observed tool results in doGenerate', async () => {
    const fakeSession = createFakeSessionWithToolExecutionAndFinalText();
    const runWithSession = vi.fn(async (_modelId, _settings, _logger, run) => run(fakeSession));

    const model = new PiLanguageModel(
      'anthropic/claude-sonnet-4',
      {},
      { runWithSession } as unknown as PiSessionManager,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    );

    const result = await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'summarize files' }] }],
    });

    const toolCall = result.content.find(
      (part): part is Extract<(typeof result.content)[number], { type: 'tool-call' }> =>
        part.type === 'tool-call' && part.toolCallId === 'tc-2',
    );
    const toolResult = result.content.find(
      (part): part is Extract<(typeof result.content)[number], { type: 'tool-result' }> =>
        part.type === 'tool-result' && part.toolCallId === 'tc-2',
    );

    expect(toolCall).toBeDefined();
    expect(toolResult).toBeDefined();
  });
});
