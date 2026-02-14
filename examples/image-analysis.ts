import { readFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { streamText } from 'ai';

import { createPi } from '../src/index.js';

const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function toBase64AndMediaType(filePath: string): { base64: string; mediaType: string } {
  const ext = extname(filePath).toLowerCase();
  const mediaType = SUPPORTED_EXTENSIONS[ext];
  if (mediaType == null) {
    throw new Error(
      `Unsupported image extension "${ext}". Supported: ${Object.keys(SUPPORTED_EXTENSIONS).join(', ')}`,
    );
  }

  const contents = readFileSync(filePath);
  return {
    base64: contents.toString('base64'),
    mediaType,
  };
}

const provider = createPi({
  defaultSettings: {
    cwd: process.cwd(),
  },
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultImagePath = join(__dirname, 'bull.webp');
const filePath = process.argv[2] ?? defaultImagePath;

if (process.argv[2] == null) {
  console.log(`Using default image: ${defaultImagePath}`);
  console.log('Tip: pass a custom path: npx tsx examples/image-analysis.ts /path/to/image.png\n');
}

const { base64, mediaType } = toBase64AndMediaType(filePath);

const result = streamText({
  model: provider('anthropic/claude-sonnet-4'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Describe the mood and key visual elements in "${basename(filePath)}" in 2-3 sentences.`,
        },
        {
          type: 'file',
          data: base64,
          mediaType,
        },
      ],
    },
  ],
});

process.stdout.write('Assistant: ');
for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
process.stdout.write('\n');
