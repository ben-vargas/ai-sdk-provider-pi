import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3GenerateResult,
  LanguageModelV3ResponseMetadata,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3ToolCall,
  SharedV3Warning,
} from '@ai-sdk/provider';
import type { AgentSession, AgentSessionEvent } from '@mariozechner/pi-coding-agent';
import type { AssistantMessage } from '@mariozechner/pi-ai';

import { DEFAULT_MAX_TOOL_RESULT_SIZE, PROVIDER_ID } from './constants.js';
import { mapPiError } from './errors.js';
import { mapPiFinishReason } from './map-pi-finish-reason.js';
import { mapPromptToPiMessage } from './message-mapper.js';
import { PiSessionManager } from './pi-session-manager.js';
import {
  mapPiEventToStreamParts,
  mapPiUsageToLanguageModelUsage,
  type StreamMapperContext,
} from './stream-mapper.js';
import {
  mapPiToolCall,
  mapPiToolExecutionResult,
  validateAndMapToolChoice,
  validatePassedTools,
} from './tool-mapper.js';
import type { Logger, PiModelId, PiSettings } from './types.js';
import { validateCallOptions } from './validation.js';

export class PiLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;

  readonly provider = PROVIDER_ID;

  readonly modelId: string;

  readonly defaultObjectGenerationMode = undefined;

  readonly supportsImageUrls = false;

  readonly supportsStructuredOutputs = false;

  readonly supportedUrls = {};

  constructor(
    modelId: PiModelId,
    private readonly settings: PiSettings,
    private readonly sessionManager: PiSessionManager,
    private readonly logger: Logger,
  ) {
    this.modelId = modelId;
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const warningStrings = this.collectWarnings(options);

    const mappedPrompt = mapPromptToPiMessage({
      prompt: options.prompt,
      settings: this.settings,
      responseFormat: options.responseFormat,
    });

    warningStrings.push(...mappedPrompt.warnings);

    const promptText = prependInstructionPreamble(mappedPrompt.instructionPreamble, mappedPrompt.text);
    const maxToolResultSize = this.settings.maxToolResultSize ?? DEFAULT_MAX_TOOL_RESULT_SIZE;

    let finalAssistantMessage: AssistantMessage | undefined;
    const toolResults: LanguageModelV3Content[] = [];
    const observedToolCalls = new Map<string, LanguageModelV3ToolCall>();
    let responseMetadata: LanguageModelV3ResponseMetadata | undefined;

    try {
      await this.sessionManager.runWithSession(this.modelId as PiModelId, this.settings, this.logger, async (session) => {
        let unsubscribe: (() => void) | undefined;
        const abortCleanup = this.attachAbort(session, options.abortSignal);

        try {
          unsubscribe = session.subscribe((event) => {
            if (
              event.type !== 'message_update' &&
              event.type !== 'tool_execution_end' &&
              event.type !== 'message_end'
            ) {
              return;
            }

            if (event.type === 'tool_execution_end') {
              toolResults.push(
                mapPiToolExecutionResult(
                  {
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    result: event.result,
                    isError: event.isError,
                  },
                  maxToolResultSize,
                ),
              );
              return;
            }

            if (event.type === 'message_end') {
              if (isAssistantMessage(event.message)) {
                finalAssistantMessage = event.message;
              }
              return;
            }

            const assistantEvent = event.assistantMessageEvent;

            if (assistantEvent.type === 'start') {
              responseMetadata = {
                timestamp: new Date(assistantEvent.partial.timestamp),
                modelId: assistantEvent.partial.model,
              };
            }

            if (assistantEvent.type === 'toolcall_end') {
              observedToolCalls.set(assistantEvent.toolCall.id, mapPiToolCall(assistantEvent.toolCall));
              return;
            }

            if (assistantEvent.type === 'done') {
              finalAssistantMessage = assistantEvent.message;
              return;
            }

            if (assistantEvent.type === 'error') {
              finalAssistantMessage = assistantEvent.error;
            }
          });

          await session.prompt(promptText, {
            expandPromptTemplates: false,
            source: 'rpc',
            ...(mappedPrompt.images != null ? { images: mappedPrompt.images } : {}),
          });
        } finally {
          unsubscribe?.();
          abortCleanup();
        }
      });
    } catch (error) {
      throw mapPiError(error);
    }

    const content = mapAssistantMessageContent(finalAssistantMessage);
    const contentToolCallIds = new Set(
      content
        .filter((part): part is LanguageModelV3ToolCall => part.type === 'tool-call')
        .map((part) => part.toolCallId),
    );

    for (const [toolCallId, toolCall] of observedToolCalls.entries()) {
      if (!contentToolCallIds.has(toolCallId)) {
        content.push(toolCall);
      }
    }

    content.push(...toolResults);

    const structuredOutputMetadata = this.getStructuredOutputMetadata(options, content, warningStrings);

    const result: LanguageModelV3GenerateResult = {
      content,
      finishReason: mapPiFinishReason(finalAssistantMessage?.stopReason),
      usage: mapPiUsageToLanguageModelUsage(finalAssistantMessage?.usage),
      warnings: toWarnings(warningStrings),
    };

    if (responseMetadata != null) {
      result.response = responseMetadata;
    }

    if (structuredOutputMetadata != null) {
      result.providerMetadata = structuredOutputMetadata;
    }

    return result;
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const warningStrings = this.collectWarnings(options);

    const mappedPrompt = mapPromptToPiMessage({
      prompt: options.prompt,
      settings: this.settings,
      responseFormat: options.responseFormat,
    });

    warningStrings.push(...mappedPrompt.warnings);

    const warnings = toWarnings(warningStrings);
    const promptText = prependInstructionPreamble(mappedPrompt.instructionPreamble, mappedPrompt.text);
    const maxToolResultSize = this.settings.maxToolResultSize ?? DEFAULT_MAX_TOOL_RESULT_SIZE;
    const jsonRequested = options.responseFormat?.type === 'json';

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      start: async (controller) => {
        let streamClosed = false;
        let streamedText = '';

        const closeStream = () => {
          if (!streamClosed) {
            streamClosed = true;
            controller.close();
          }
        };

        const enqueue = (part: LanguageModelV3StreamPart) => {
          if (!streamClosed) {
            controller.enqueue(part);
          }
        };

        try {
          await this.sessionManager.runWithSession(
            this.modelId as PiModelId,
            this.settings,
            this.logger,
            async (session) => {
              const context: StreamMapperContext = {
                toolState: new Map(),
                maxToolResultSize,
                warnings,
                streamStarted: false,
              };

              const unsubscribe = session.subscribe((event) => {
                const mapped = mapPiEventToStreamParts(event, context);
                context.streamStarted = mapped.streamStarted;

                for (const part of mapped.parts) {
                  if (part.type === 'text-delta') {
                    streamedText += part.delta;
                  }

                  if (jsonRequested && part.type === 'finish') {
                    part.providerMetadata = {
                      pi: {
                        structuredOutputValidated: false,
                      },
                    };
                  }

                  enqueue(part);
                }

                if (event.type === 'agent_end') {
                  closeStream();
                }
              });

              const abortCleanup = this.attachAbort(session, options.abortSignal, closeStream);

              try {
                await session.prompt(promptText, {
                  expandPromptTemplates: false,
                  source: 'rpc',
                  ...(mappedPrompt.images != null ? { images: mappedPrompt.images } : {}),
                });

                if (jsonRequested && !isValidJson(streamedText)) {
                  this.logger.warn('Pi structured-output request completed with non-JSON text output.');
                }

                closeStream();
              } finally {
                unsubscribe();
                abortCleanup();
              }
            },
          );
        } catch (error) {
          enqueue({
            type: 'error',
            error: mapPiError(error),
          });
          closeStream();
        }
      },
    });

    return { stream };
  }

  private collectWarnings(options: LanguageModelV3CallOptions): string[] {
    const warnings = validateCallOptions(options, this.logger);
    warnings.push(...validatePassedTools(options.tools, this.logger));
    warnings.push(...validateAndMapToolChoice(options.toolChoice, this.logger));

    if (options.responseFormat?.type === 'json') {
      warnings.push(
        'Pi does not natively enforce structured outputs. JSON output is best-effort and may not validate against schema.',
      );
    }

    return warnings;
  }

  private getStructuredOutputMetadata(
    options: LanguageModelV3CallOptions,
    content: LanguageModelV3Content[],
    warningStrings: string[],
  ) {
    if (options.responseFormat?.type !== 'json') {
      return undefined;
    }

    const generatedText = content
      .filter((part): part is Extract<LanguageModelV3Content, { type: 'text' }> => part.type === 'text')
      .map((part) => part.text)
      .join('');

    if (!isValidJson(generatedText)) {
      warningStrings.push('Pi returned non-JSON text while JSON response format was requested.');
    }

    return {
      pi: {
        structuredOutputValidated: false,
      },
    };
  }

  private attachAbort(
    session: AgentSession,
    abortSignal?: AbortSignal,
    onAbort?: () => void,
  ): () => void {
    if (abortSignal == null) {
      return () => {};
    }

    const abortListener = () => {
      onAbort?.();
      void session.abort();
    };

    if (abortSignal.aborted) {
      abortListener();
      return () => {};
    }

    abortSignal.addEventListener('abort', abortListener, { once: true });

    return () => {
      abortSignal.removeEventListener('abort', abortListener);
    };
  }
}

function prependInstructionPreamble(instructionPreamble: string | undefined, text: string): string {
  if (instructionPreamble == null || instructionPreamble.trim().length === 0) {
    return text;
  }

  if (text.trim().length === 0) {
    return instructionPreamble;
  }

  return `${instructionPreamble}\n\n${text}`;
}

function mapAssistantMessageContent(message: AssistantMessage | undefined): LanguageModelV3Content[] {
  if (message == null) {
    return [];
  }

  const content: LanguageModelV3Content[] = [];

  for (const part of message.content) {
    if (part.type === 'text') {
      content.push({
        type: 'text',
        text: part.text,
      });
      continue;
    }

    if (part.type === 'thinking') {
      content.push({
        type: 'reasoning',
        text: part.thinking,
      });
      continue;
    }

    if (part.type === 'toolCall') {
      content.push(mapPiToolCall(part));
    }
  }

  return content;
}

function isAssistantMessage(value: unknown): value is AssistantMessage {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const candidate = value as Partial<AssistantMessage>;
  return (
    candidate.role === 'assistant' &&
    Array.isArray(candidate.content) &&
    typeof candidate.stopReason === 'string'
  );
}

function isValidJson(text: string): boolean {
  const candidate = text.trim();
  if (candidate.length === 0) {
    return false;
  }

  try {
    JSON.parse(candidate);
    return true;
  } catch {
    return false;
  }
}

function toWarnings(warningStrings: string[]): SharedV3Warning[] {
  return warningStrings.map((details) => ({
    type: 'compatibility',
    feature: 'pi-provider',
    details,
  }));
}
