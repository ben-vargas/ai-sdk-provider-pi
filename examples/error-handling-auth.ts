import { generateText } from 'ai';

import { createPi, isAuthenticationError, isTimeoutError } from '../src/index.js';

async function main() {
  const provider = createPi({
    defaultSettings: {
      cwd: process.cwd(),
    },
  });

  try {
    const result = await generateText({
      model: provider('anthropic/claude-sonnet-4'),
      prompt: 'Reply with one word: ready',
    });

    console.log('Success:', result.text.trim().length > 0 ? result.text : '(no text returned)');
    const warnings = result.warnings ?? [];
    if (warnings.length > 0) {
      console.log('Warnings:');
      for (const warning of warnings) {
        if ('details' in warning) {
          console.log(`- ${warning.type}: ${warning.details}`);
        } else {
          console.log(`- ${warning.type}`);
        }
      }
    }
  } catch (error) {
    if (isAuthenticationError(error)) {
      console.error(
        'Authentication error. Ensure Pi auth is configured for the selected provider/model.',
      );
      process.exit(2);
      return;
    }

    if (isTimeoutError(error)) {
      console.error('Timeout error. Retry or increase request timeout at the caller level.');
      process.exit(3);
      return;
    }

    console.error('Unhandled error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
