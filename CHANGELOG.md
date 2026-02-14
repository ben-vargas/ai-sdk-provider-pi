# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-02-14

Initial release of the AI SDK Provider for Pi.

### Added

- **AI SDK v6 provider** - Full `ProviderV3` / `LanguageModelV3` implementation for Pi coding agent
- **`createPi()` factory and default `pi` export** - Standard AI SDK provider pattern with three-layer settings merge (provider defaults, default settings, per-call settings)
- **`doGenerate()` and `doStream()`** - Non-streaming and streaming text generation with full Pi event mapping
- **Session management** - Fresh in-memory session per call by default; persistent sessions via `sessionId` with per-session serialization to prevent overlapping prompts
- **Model resolution** - `ModelRegistry.find()` first, `getModel()` fallback; `provider/model` ID format (e.g., `anthropic/claude-sonnet-4`)
- **Provider-executed tool streaming** - Full tool lifecycle emission (`tool-input-start`, `tool-input-delta`, `tool-input-end`, `tool-call`, `tool-result`) with `providerExecuted: true`
- **Extended thinking support** - `reasoning-start`, `reasoning-delta`, `reasoning-end` stream parts mapped from Pi thinking events
- **Best-effort structured output** - JSON schema guidance injected into instruction preamble with compatibility warnings and `structuredOutputValidated: false` metadata
- **Instruction preamble** - Combines `settings.instructions`, prompt system parts, and schema guidance
- **Abort signal support** - `AbortSignal` wired to `session.abort()` in both generate and stream paths
- **Error classification** - `mapPiError()` with classifiers for auth, timeout, abort, output-length, and retryable errors
- **Zod-based settings validation** - Hard errors for invalid settings, soft warnings for incompatibilities
- **Configurable logging** - Verbose mode, custom logger support, or silent operation via `logger: false`
- **Image input support** - Base64 file parts mapped to Pi `ImageContent` format
- **Unsupported parameter warnings** - `frequencyPenalty`, `presencePenalty`, `topP`, `topK`, `seed`, `stopSequences` emit compatibility warnings instead of failing
- **Call safety** - All provider calls use `expandPromptTemplates: false` and `source: 'rpc'`
- **Process exit cleanup** - Automatic session disposal on process exit
- **11 examples** - basic-usage, streaming, streaming-events, tool-calling, session-management, memory-comparison, generate-object-basic, image-analysis, abort-signal, error-handling-auth, logging-custom-logger
- **38 unit tests** across 10 test files covering all modules

### Dependencies (resolved 2026-02-14)

| Package | Version | Role |
| --- | --- | --- |
| `@ai-sdk/provider` | 3.0.8 | AI SDK v6 provider types |
| `@ai-sdk/provider-utils` | 4.0.15 | AI SDK v6 provider utilities |
| `@mariozechner/pi-coding-agent` | 0.52.12 | Pi agent session, tools, model registry |
| `@mariozechner/pi-ai` | 0.52.12 | Pi model resolution (`getModel`) |
| `@mariozechner/pi-agent-core` | 0.52.12 | Pi core types and events |
| `zod` | 4.3.6 | Runtime settings validation |
| `ai` | 6.0.86 | Dev — AI SDK (peer) |
| `typescript` | 5.9.3 | Dev — compiler |
| `vitest` | 4.0.18 | Dev — test runner |
| `@vitest/coverage-v8` | 4.0.18 | Dev — coverage reporter |
| `@types/node` | 25.2.3 | Dev — Node.js type definitions |
| `tsup` | 8.5.1 | Dev — bundler |
