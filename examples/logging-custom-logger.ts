import { streamText } from 'ai';

import { createPi } from '../src/index.js';
import type { Logger } from '../src/index.js';

const logger: Logger = {
  debug: (message) => console.log(`[DEBUG ${new Date().toISOString()}] ${message}`),
  info: (message) => console.log(`[INFO  ${new Date().toISOString()}] ${message}`),
  warn: (message) => console.warn(`[WARN  ${new Date().toISOString()}] ${message}`),
  error: (message) => console.error(`[ERROR ${new Date().toISOString()}] ${message}`),
};

async function main() {
  const provider = createPi({
    defaultSettings: {
      cwd: process.cwd(),
      logger,
      verbose: true,
    },
  });

  const result = streamText({
    model: provider('anthropic/claude-sonnet-4'),
    prompt: 'Say hello in one short sentence.',
  });

  for await (const text of result.textStream) {
    process.stdout.write(text);
  }

  process.stdout.write('\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
