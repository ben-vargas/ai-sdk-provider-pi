import { describe, expect, it, vi } from 'vitest';

import {
  mapPiToolCall,
  mapPiToolExecutionResult,
  validateAndMapToolChoice,
  validatePassedTools,
} from '../src/tool-mapper.js';

describe('tool-mapper', () => {
  it('maps Pi tool call to provider-executed AI SDK tool-call', () => {
    const mapped = mapPiToolCall({
      type: 'toolCall',
      id: 'call-1',
      name: 'read',
      arguments: { path: 'README.md' },
    });

    expect(mapped.providerExecuted).toBe(true);
    expect(mapped.input).toContain('README.md');
  });

  it('truncates oversized tool execution results', () => {
    const long = 'x'.repeat(1000);
    const mapped = mapPiToolExecutionResult(
      {
        toolCallId: 'c1',
        toolName: 'bash',
        result: { output: long },
        isError: false,
      },
      100,
    );

    expect(mapped.result).toMatchObject({ truncated: true, maxSize: 100 });
  });

  it('warns when tools/toolChoice are passed', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const toolWarnings = validatePassedTools(
      [{ type: 'function', name: 'x', inputSchema: { type: 'object', properties: {} } }],
      logger,
    );
    const choiceWarnings = validateAndMapToolChoice({ type: 'required' }, logger);

    expect(toolWarnings.length).toBe(1);
    expect(choiceWarnings.length).toBe(1);
    expect(logger.warn).toHaveBeenCalled();
  });
});
