import type { JSONSchema7, LanguageModelV3CallOptions, SharedV3Warning } from '@ai-sdk/provider';
import type { AgentSession } from '@mariozechner/pi-coding-agent';
import type { ImageContent } from '@mariozechner/pi-ai';

export type PiModelId = string & {};

export interface PiProviderSettings {
  defaultSettings?: PiSettings;
}

export interface PiSettings {
  cwd?: string;
  thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  tools?: 'coding' | 'readOnly' | 'all';
  instructions?: string;
  sessionId?: string;
  sessionPersistence?: 'memory' | 'disk';
  defaultProvider?: string;
  maxToolResultSize?: number;
  agentDir?: string;
  verbose?: boolean;
  logger?: Logger | false;
}

export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export interface MappedPiPrompt {
  text: string;
  images?: ImageContent[];
  instructionPreamble?: string;
  warnings: string[];
}

export interface StructuredOutputGuidance {
  schema?: JSONSchema7;
  name?: string;
  description?: string;
}

export interface PromptMappingOptions {
  prompt: LanguageModelV3CallOptions['prompt'];
  settings: PiSettings;
  responseFormat?: LanguageModelV3CallOptions['responseFormat'];
}

export interface SessionLease {
  session: AgentSession;
  sessionId?: string;
  ephemeral: boolean;
}

export interface ValidatedSettingsResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationWarnings {
  strings: string[];
  warnings: SharedV3Warning[];
}
