import { generateText, streamText } from 'ai';

import { createPi } from '../src/index.js';

function createTimeoutController(ms: number): AbortController & { clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Timeout after ${ms}ms`));
  }, ms);

  return Object.assign(controller, {
    clear: () => clearTimeout(timer),
  });
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'AbortError' || error.message.toLowerCase().includes('abort');
}

async function main() {
  const provider = createPi({
    defaultSettings: {
      cwd: process.cwd(),
    },
  });

  console.log('=== AbortSignal Example ===\n');

  console.log('1) generateText with timeout cancellation');
  const controller1 = createTimeoutController(2000);
  try {
    await generateText({
      model: provider('anthropic/claude-sonnet-4'),
      prompt: 'Write a long, detailed explanation of distributed systems in 20 paragraphs.',
      abortSignal: controller1.signal,
    });
    console.log('Request completed before timeout.');
  } catch (error) {
    if (isAbortError(error)) {
      console.log('Request aborted by timeout (expected in slower runs).');
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    controller1.clear();
  }

  console.log('\n2) Cancel streaming after partial output');
  const controller2 = createTimeoutController(30_000);
  try {
    const result = streamText({
      model: provider('anthropic/claude-sonnet-4'),
      prompt: 'Count from 1 to 50 and explain each number briefly.',
      abortSignal: controller2.signal,
    });

    let chars = 0;
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      chars += chunk.length;
      if (chars > 120) {
        controller2.abort(new Error('Stopped by client after partial output'));
        break;
      }
    }

    console.log('\nStream cancellation triggered.');
  } catch (error) {
    if (isAbortError(error)) {
      console.log('Stream aborted as expected.');
    } else {
      console.error('Unexpected streaming error:', error);
    }
  } finally {
    controller2.clear();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
