import { streamText } from 'ai';

import { createPi } from '../src/index.js';

const provider = createPi({
  defaultSettings: {
    cwd: process.cwd(),
  },
});

const result = streamText({
  model: provider('anthropic/claude-sonnet-4'),
  prompt: 'Explain what changed in this repository.',
});

for await (const part of result.fullStream) {
  if (part.type === 'text-delta') {
    process.stdout.write(part.text);
  }
}

process.stdout.write('\n');
