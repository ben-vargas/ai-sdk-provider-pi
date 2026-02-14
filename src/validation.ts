import type { LanguageModelV3CallOptions } from '@ai-sdk/provider';
import { z } from 'zod';

import { DEFAULT_PROVIDER, UNSUPPORTED_CALL_OPTIONS } from './constants.js';
import type { Logger, PiSettings, ValidatedSettingsResult } from './types.js';

const settingsSchema = z
  .object({
    cwd: z.string().min(1).optional(),
    thinkingLevel: z.enum(['off', 'minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
    tools: z.enum(['coding', 'readOnly', 'all']).optional(),
    instructions: z.string().optional(),
    sessionId: z.string().min(1).optional(),
    sessionPersistence: z.enum(['memory', 'disk']).optional(),
    defaultProvider: z.string().min(1).optional(),
    maxToolResultSize: z.number().int().positive().optional(),
    agentDir: z.string().min(1).optional(),
    verbose: z.boolean().optional(),
    logger: z
      .union([
        z.literal(false),
        z.object({
          debug: z.function({ input: [z.string()], output: z.void() }),
          info: z.function({ input: [z.string()], output: z.void() }),
          warn: z.function({ input: [z.string()], output: z.void() }),
          error: z.function({ input: [z.string()], output: z.void() }),
        }),
      ])
      .optional(),
  })
  .strict();

export function validateSettings(settings: unknown): ValidatedSettingsResult {
  const parsed = settingsSchema.safeParse(settings);

  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || 'settings'}: ${issue.message}`,
      ),
      warnings: [],
    };
  }

  const value = parsed.data;
  const warnings: string[] = [];

  if (value.sessionPersistence === 'disk' && value.sessionId == null) {
    warnings.push(
      'sessionPersistence="disk" has no effect without sessionId; session continuity requires sessionId.',
    );
  }

  if (value.defaultProvider != null && value.defaultProvider.trim().length === 0) {
    warnings.push(
      `defaultProvider is empty. Expected provider/model format (e.g. ${DEFAULT_PROVIDER}/model-id).`,
    );
  }

  return {
    valid: true,
    errors: [],
    warnings,
  };
}

export function validateModelId(modelId: string): string | undefined {
  if (!modelId.includes('/')) {
    return `Model id "${modelId}" does not include provider prefix. Expected provider/model (example: anthropic/claude-sonnet-4).`;
  }

  const [provider, model] = splitModelId(modelId);
  if (provider.length === 0 || model.length === 0) {
    return `Model id "${modelId}" is invalid. Expected provider/model with both parts non-empty.`;
  }

  return undefined;
}

export function validateCallOptions(options: LanguageModelV3CallOptions, logger: Logger): string[] {
  const warnings: string[] = [];

  for (const option of UNSUPPORTED_CALL_OPTIONS) {
    if (options[option] !== undefined) {
      const warning = `Call option "${option}" is not supported by Pi and will be ignored.`;
      warnings.push(warning);
      logger.warn(warning);
    }
  }

  if (options.includeRawChunks === true) {
    const warning = 'Call option "includeRawChunks" is not supported by Pi and will be ignored.';
    warnings.push(warning);
    logger.warn(warning);
  }

  return warnings;
}

function splitModelId(modelId: string): [string, string] {
  const index = modelId.indexOf('/');
  if (index === -1) {
    return [modelId, ''];
  }

  return [modelId.slice(0, index), modelId.slice(index + 1)];
}

export function assertValidSettings(settings: PiSettings): void {
  const result = validateSettings(settings);
  if (!result.valid) {
    throw new Error(`Invalid Pi settings: ${result.errors.join('; ')}`);
  }
}
