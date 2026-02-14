import { generateText } from 'ai';

import { createPi } from '../src/index.js';

const provider = createPi({
  defaultSettings: {
    cwd: process.cwd(),
    tools: 'coding',
  },
});

const result = await generateText({
  model: provider('anthropic/claude-sonnet-4'),
  prompt: 'Reply with a single sentence confirming this Pi AI SDK provider is running.',
});

console.log(result.text.trim().length > 0 ? result.text : '(no text returned)');
