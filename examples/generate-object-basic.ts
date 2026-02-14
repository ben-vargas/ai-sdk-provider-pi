import { generateObject, generateText } from 'ai';
import { z } from 'zod';

import { createPi } from '../src/index.js';

const schema = z.object({
  project: z.string(),
  status: z.enum(['green', 'yellow', 'red']),
  summary: z.string(),
});

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced?.[1] ?? trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  return body.slice(start, end + 1);
}

const provider = createPi({
  defaultSettings: {
    cwd: process.cwd(),
  },
});

const model = provider('anthropic/claude-sonnet-4');

try {
  const result = await generateObject({
    model,
    schema,
    prompt: 'Create a short project health report for this repository.',
  });

  console.log('Mode: native generateObject');
  console.log(JSON.stringify(result.object, null, 2));
} catch (error) {
  console.warn('Native generateObject failed, falling back to strict JSON prompting.');

  const fallback = await generateText({
    model,
    prompt:
      'Return only valid JSON with keys: project (string), status (green|yellow|red), summary (string). No markdown.',
  });

  const json = extractJsonObject(fallback.text);
  if (json == null) {
    throw new Error('Fallback did not return parseable JSON object.');
  }

  const parsed = schema.parse(JSON.parse(json));
  console.log('Mode: fallback generateText + local schema validation');
  console.log(JSON.stringify(parsed, null, 2));
}
