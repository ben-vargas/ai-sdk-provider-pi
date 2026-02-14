import { generateText } from 'ai';

import { createPi } from '../src/index.js';

const provider = createPi({
  defaultSettings: {
    cwd: process.cwd(),
    sessionId: 'demo-session',
    sessionPersistence: 'memory',
  },
});

const first = await generateText({
  model: provider('anthropic/claude-sonnet-4'),
  prompt: 'Reply with exactly this token: ORION. Do not use tools.',
});

console.log('first:', first.text.trim().length > 0 ? first.text : '(no text returned)');

const second = await generateText({
  model: provider('anthropic/claude-sonnet-4'),
  prompt: 'What token did I ask you to remember? Reply with token only.',
});

console.log('second:', second.text.trim().length > 0 ? second.text : '(no text returned)');
