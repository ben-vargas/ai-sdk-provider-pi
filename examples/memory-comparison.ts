import { generateText } from 'ai';

import { createPi } from '../src/index.js';

const modelId = 'anthropic/claude-sonnet-4';

async function runStateless() {
  const provider = createPi({
    defaultSettings: {
      cwd: process.cwd(),
    },
  });

  const first = await generateText({
    model: provider(modelId),
    prompt: 'Remember this token for later: SAPPHIRE. Reply with token only.',
  });

  const second = await generateText({
    model: provider(modelId),
    prompt: 'What token did I ask you to remember earlier? Reply with token only.',
  });

  console.log('Stateless call 1:', first.text.trim().length > 0 ? first.text : '(no text returned)');
  console.log('Stateless call 2:', second.text.trim().length > 0 ? second.text : '(no text returned)');
}

async function runWithMemorySession() {
  const provider = createPi({
    defaultSettings: {
      cwd: process.cwd(),
      sessionId: 'memory-comparison-demo',
      sessionPersistence: 'memory',
    },
  });

  const first = await generateText({
    model: provider(modelId),
    prompt: 'Remember this token for later: EMERALD. Reply with token only.',
  });

  const second = await generateText({
    model: provider(modelId),
    prompt: 'What token did I ask you to remember earlier? Reply with token only.',
  });

  console.log('Memory call 1:', first.text.trim().length > 0 ? first.text : '(no text returned)');
  console.log('Memory call 2:', second.text.trim().length > 0 ? second.text : '(no text returned)');
}

console.log('=== Stateless (fresh session per call) ===');
await runStateless();

console.log('\n=== Memory Session (shared sessionId) ===');
await runWithMemorySession();
