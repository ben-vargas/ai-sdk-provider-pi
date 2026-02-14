import { streamText } from 'ai';

import { createPi } from '../src/index.js';

const provider = createPi({
  defaultSettings: {
    cwd: process.cwd(),
    tools: 'all',
  },
});

const result = streamText({
  model: provider('anthropic/claude-sonnet-4'),
  prompt: 'List the files and explain the largest one.',
});

for await (const part of result.fullStream) {
  if (part.type === 'tool-call') {
    const input = typeof part.input === 'string' ? part.input : JSON.stringify(part.input);
    console.log(`tool-call ${part.toolName}(${input}) providerExecuted=${part.providerExecuted}`);
  }

  if (part.type === 'tool-result') {
    console.log(
      `tool-result ${part.toolName}`,
      typeof part.output === 'string' ? part.output : JSON.stringify(part.output, null, 2),
    );
  }
}
