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
  prompt: 'List the top-level files and summarize the largest one.',
});

for await (const part of result.fullStream) {
  switch (part.type) {
    case 'text-delta':
      process.stdout.write(part.text);
      break;
    case 'reasoning-delta':
      process.stdout.write(`\n[reasoning] ${part.text}`);
      break;
    case 'tool-call':
      console.log(`\n[tool-call] ${part.toolName} id=${part.toolCallId}`);
      break;
    case 'tool-result':
      console.log(`\n[tool-result] ${part.toolName} id=${part.toolCallId}`);
      break;
    case 'finish':
      console.log(`\n[finish] ${String(part.finishReason)}`);
      break;
    default:
      break;
  }
}

process.stdout.write('\n');
