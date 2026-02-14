import { describe, expect, it } from 'vitest';

import { mapPromptToPiMessage } from '../src/message-mapper.js';

describe('message-mapper', () => {
  it('builds instruction preamble from settings + system + json schema guidance', () => {
    const mapped = mapPromptToPiMessage({
      prompt: [
        { role: 'system', content: 'system instruction' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello' },
            {
              type: 'file',
              data: new Uint8Array([1, 2, 3]),
              mediaType: 'image/png',
            },
          ],
        },
      ],
      settings: {
        instructions: 'provider instructions',
      },
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
          },
          required: ['ok'],
        },
      },
    });

    expect(mapped.text).toBe('hello');
    expect(mapped.images).toHaveLength(1);
    expect(mapped.instructionPreamble).toContain('provider instructions');
    expect(mapped.instructionPreamble).toContain('system instruction');
    expect(mapped.instructionPreamble).toContain('JSON schema');
  });

  it('warns on unsupported URL image inputs', () => {
    const mapped = mapPromptToPiMessage({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: new URL('https://example.com/image.png'),
              mediaType: 'image/png',
            },
          ],
        },
      ],
      settings: {},
    });

    expect(mapped.images).toBeUndefined();
    expect(mapped.warnings.join('\n')).toContain('not supported');
  });
});
