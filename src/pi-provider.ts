import type { EmbeddingModelV3, ImageModelV3, LanguageModelV3, ProviderV3 } from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';

import {
  DEFAULT_MAX_TOOL_RESULT_SIZE,
  DEFAULT_SESSION_PERSISTENCE,
  DEFAULT_THINKING_LEVEL,
  DEFAULT_TOOL_SET,
} from './constants.js';
import { createVerboseLogger, getLogger } from './logger.js';
import { PiLanguageModel } from './pi-language-model.js';
import { PiSessionManager } from './pi-session-manager.js';
import type { Logger, PiModelId, PiProviderSettings, PiSettings } from './types.js';
import { validateModelId, validateSettings } from './validation.js';

export type { PiProviderSettings } from './types.js';

export interface PiProvider extends ProviderV3 {
  (modelId: PiModelId, settings?: PiSettings): LanguageModelV3;
  languageModel(modelId: PiModelId, settings?: PiSettings): LanguageModelV3;
  chat(modelId: PiModelId, settings?: PiSettings): LanguageModelV3;
  dispose(): Promise<void>;
}

export function createPi(options?: PiProviderSettings): PiProvider {
  const sessionManager = new PiSessionManager();

  const providerDefaults: PiSettings = {
    tools: DEFAULT_TOOL_SET,
    thinkingLevel: DEFAULT_THINKING_LEVEL,
    sessionPersistence: DEFAULT_SESSION_PERSISTENCE,
    maxToolResultSize: DEFAULT_MAX_TOOL_RESULT_SIZE,
  };

  const defaultSettings = options?.defaultSettings ?? {};
  const providerLogger = createLogger(defaultSettings);

  const initialValidation = validateSettings(defaultSettings);
  if (!initialValidation.valid) {
    throw new Error(`Invalid default Pi settings: ${initialValidation.errors.join('; ')}`);
  }

  for (const warning of initialValidation.warnings) {
    providerLogger.warn(warning);
  }

  const provider = ((modelId: PiModelId, settings?: PiSettings) => {
    return createModel(modelId, settings);
  }) as PiProvider;

  (provider as unknown as { specificationVersion: 'v3' }).specificationVersion = 'v3';

  provider.languageModel = (modelId: PiModelId, settings?: PiSettings): LanguageModelV3 => {
    return createModel(modelId, settings);
  };

  provider.chat = (modelId: PiModelId, settings?: PiSettings): LanguageModelV3 => {
    return createModel(modelId, settings);
  };

  provider.embeddingModel = (modelId: string): EmbeddingModelV3 => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'embeddingModel',
      message: 'Pi provider does not implement embedding models.',
    });
  };

  provider.imageModel = (modelId: string): ImageModelV3 => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'imageModel',
      message: 'Pi provider does not implement image generation models.',
    });
  };

  provider.dispose = async (): Promise<void> => {
    await sessionManager.dispose();
  };

  return provider;

  function createModel(modelId: PiModelId, settings?: PiSettings): LanguageModelV3 {
    const mergedSettings = {
      ...providerDefaults,
      ...defaultSettings,
      ...settings,
    } satisfies PiSettings;

    const logger = createLogger(mergedSettings);
    const validation = validateSettings(mergedSettings);

    if (!validation.valid) {
      throw new Error(`Invalid Pi settings: ${validation.errors.join('; ')}`);
    }

    for (const warning of validation.warnings) {
      logger.warn(warning);
    }

    const modelIdWarning = validateModelId(modelId);
    if (modelIdWarning != null) {
      logger.warn(modelIdWarning);
    }

    return new PiLanguageModel(modelId, mergedSettings, sessionManager, logger);
  }
}

export const pi: PiProvider = createPi();

function createLogger(settings: PiSettings): Logger {
  const logger = getLogger(settings.logger);
  return createVerboseLogger(logger, settings.verbose ?? false);
}
