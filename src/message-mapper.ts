import type { LanguageModelV3FilePart, LanguageModelV3Prompt } from '@ai-sdk/provider';
import type { ImageContent } from '@mariozechner/pi-ai';

import type { MappedPiPrompt, PromptMappingOptions, StructuredOutputGuidance } from './types.js';

export function mapPromptToPiMessage(options: PromptMappingOptions): MappedPiPrompt {
  const warnings: string[] = [];
  const systemParts = options.prompt
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0);

  const latestUser = getLatestUserMessage(options.prompt);
  const images: ImageContent[] = [];
  const textParts: string[] = [];

  if (latestUser != null) {
    for (const part of latestUser.content) {
      if (part.type === 'text') {
        textParts.push(part.text);
        continue;
      }

      if (part.type === 'file') {
        const mappedImage = mapImagePart(part, warnings);
        if (mappedImage != null) {
          images.push(mappedImage);
        }
      }
    }
  } else {
    warnings.push('No user message found in prompt. Sending an empty user prompt to Pi.');
  }

  const preamble = buildInstructionPreamble({
    instructions: options.settings.instructions,
    systemParts,
    responseFormat: options.responseFormat,
  });

  const mapped: MappedPiPrompt = {
    text: textParts.join('\n'),
    warnings,
  };

  if (preamble.length > 0) {
    mapped.instructionPreamble = preamble;
  }

  if (images.length > 0) {
    mapped.images = images;
  }

  return mapped;
}

function getLatestUserMessage(prompt: LanguageModelV3Prompt) {
  for (let i = prompt.length - 1; i >= 0; i -= 1) {
    const message = prompt[i];
    if (message != null && message.role === 'user') {
      return message;
    }
  }

  return undefined;
}

function mapImagePart(part: LanguageModelV3FilePart, warnings: string[]): ImageContent | undefined {
  if (!part.mediaType.startsWith('image/')) {
    warnings.push(
      `Unsupported file media type "${part.mediaType}". Only image/* is supported for Pi image input.`,
    );
    return undefined;
  }

  if (part.data instanceof URL) {
    warnings.push(
      `Image URL input (${part.data.toString()}) is not supported by Pi provider; use binary or base64 data.`,
    );
    return undefined;
  }

  const data =
    part.data instanceof Uint8Array ? Buffer.from(part.data).toString('base64') : part.data;

  return {
    type: 'image',
    data,
    mimeType: part.mediaType,
  };
}

function buildInstructionPreamble(options: {
  instructions: string | undefined;
  systemParts: string[];
  responseFormat?: PromptMappingOptions['responseFormat'];
}): string {
  const blocks: string[] = [];

  if (options.instructions != null && options.instructions.trim().length > 0) {
    blocks.push(options.instructions.trim());
  }

  if (options.systemParts.length > 0) {
    blocks.push(options.systemParts.join('\n\n'));
  }

  if (options.responseFormat?.type === 'json') {
    blocks.push(buildStructuredOutputGuidance(options.responseFormat));
  }

  return blocks.join('\n\n');
}

function buildStructuredOutputGuidance(guidance: StructuredOutputGuidance): string {
  const lines: string[] = [
    'Structured output requested: return valid JSON only and no markdown code fences.',
  ];

  if (guidance.name != null) {
    lines.push(`Output name: ${guidance.name}`);
  }

  if (guidance.description != null) {
    lines.push(`Output description: ${guidance.description}`);
  }

  if (guidance.schema != null) {
    lines.push(`JSON schema:\n${JSON.stringify(guidance.schema, null, 2)}`);
  }

  return lines.join('\n');
}
