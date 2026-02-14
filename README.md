<p align="center">
  <a href="https://www.npmjs.com/package/ai-sdk-provider-pi"><img src="https://img.shields.io/npm/v/ai-sdk-provider-pi?color=00A79E" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/ai-sdk-provider-pi"><img src="https://img.shields.io/npm/dy/ai-sdk-provider-pi.svg?color=00A79E" alt="npm downloads" /></a>
  <a href="https://nodejs.org/en/about/releases/"><img src="https://img.shields.io/badge/node-%3E%3D20-00A79E" alt="Node.js >= 20" /></a>
  <img src="https://img.shields.io/badge/AI%20SDK-v6-00A79E" alt="AI SDK v6" />
  <a href="https://www.npmjs.com/package/ai-sdk-provider-pi"><img src="https://img.shields.io/npm/l/ai-sdk-provider-pi?color=00A79E" alt="License: MIT" /></a>
</p>

# AI SDK Provider for Pi

A community provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs) that enables using AI models through [Pi](https://github.com/mariozechner/pi) (`@mariozechner/pi-coding-agent`). Pi is a minimal, extensible terminal coding agent with built-in tools for reading, writing, editing files, and executing shell commands.

This provider wraps Pi's coding-agent runtime as a `LanguageModelV3`, enabling standard AI SDK usage (`generateText`, `streamText`, `generateObject`) with Pi's provider/model registry, tool execution loop, and session semantics.

## Version Compatibility

| Provider Version | AI SDK Version | NPM Tag  | Status |
| ---------------- | -------------- | -------- | ------ |
| 0.x              | v6             | `latest` | Active |

```bash
npm install ai-sdk-provider-pi ai@^6.0.0
```

## Feature Support

| Feature                  | Support       | Notes                                                 |
| ------------------------ | ------------- | ----------------------------------------------------- |
| Text generation          | Full          | `generateText()`, `streamText()`                      |
| Streaming                | Full          | Real-time event streaming via `session.subscribe()`   |
| Tool observation         | Full          | Provider-executed tools with full lifecycle streaming |
| Extended thinking        | Full          | `reasoning-start/delta/end` stream parts              |
| Abort/cancellation       | Full          | `AbortSignal` wired to `session.abort()`              |
| Session management       | Full          | Fresh per call or persistent via `sessionId`          |
| Image input (base64)     | Full          | `Uint8Array` or base64 string file parts              |
| Structured output (JSON) | Best-effort   | Schema guidance in prompt; not provider-enforced      |
| Configurable logging     | Full          | Verbose mode, custom logger, or silent                |
| Image input (URL)        | Not supported | Use binary/base64 data instead                        |
| Embedding models         | Not supported | `NoSuchModelError`                                    |
| Image generation models  | Not supported | `NoSuchModelError`                                    |
| topP/topK                | Not supported | Warnings emitted, values ignored                      |

## Installation

### 1. Configure Pi authentication

Ensure Pi auth is configured for the provider you want to use. Authenticate with Pi tooling (e.g., via `@mariozechner/pi-ai` login flows) and/or configure Pi model/provider settings in your Pi config.

### 2. Install the provider

```bash
npm install ai-sdk-provider-pi ai
```

## Quick Start

```ts
import { generateText } from 'ai';
import { createPi } from 'ai-sdk-provider-pi';

const provider = createPi({
  defaultSettings: {
    cwd: process.cwd(),
    tools: 'coding',
  },
});

const result = await generateText({
  model: provider('anthropic/claude-sonnet-4'),
  prompt: 'Reply with a single sentence confirming this provider is running.',
});

console.log(result.text);
```

## Streaming

```ts
import { streamText } from 'ai';
import { createPi } from 'ai-sdk-provider-pi';

const provider = createPi({
  defaultSettings: { cwd: process.cwd(), tools: 'all' },
});

const result = streamText({
  model: provider('anthropic/claude-sonnet-4'),
  prompt: 'List top-level files and summarize the largest one.',
});

for await (const part of result.fullStream) {
  if (part.type === 'text-delta') process.stdout.write(part.text);
  if (part.type === 'tool-call') console.log(`\n[tool-call] ${part.toolName}`);
  if (part.type === 'tool-result') console.log(`\n[tool-result] ${part.toolName}`);
}
```

## Structured Output (`generateObject`)

Structured output is supported as a compatibility mode (best-effort), not strict provider-level schema enforcement:

- `supportsStructuredOutputs = false`
- JSON schema guidance is injected into the instruction preamble
- Compatibility warnings are emitted
- Provider metadata includes `structuredOutputValidated: false`

Use `generateObject` when convenient, and for strict workflows keep a fallback path that validates parsed JSON locally.

See `examples/generate-object-basic.ts`.

## Image Inputs

Image analysis is supported through AI SDK message parts by passing base64 file data with `mediaType`.

- Supported input payloads are base64-backed file parts (not remote image URL passthrough)
- Example: `examples/image-analysis.ts`
- Sample image included: `examples/bull.webp`

## API

### `createPi(options?)`

Creates a provider instance.

```ts
import { createPi } from 'ai-sdk-provider-pi';

const provider = createPi({
  defaultSettings: {
    cwd: process.cwd(),
    tools: 'coding',
  },
});
```

### `pi`

Default provider instance:

```ts
import { pi } from 'ai-sdk-provider-pi';
```

### `PiSettings`

| Setting              | Type                                                           | Default         | Description                                           |
| -------------------- | -------------------------------------------------------------- | --------------- | ----------------------------------------------------- |
| `cwd`                | `string`                                                       | `process.cwd()` | Working directory for Pi                              |
| `thinkingLevel`      | `'off' \| 'minimal' \| 'low' \| 'medium' \| 'high' \| 'xhigh'` | `'medium'`      | Reasoning effort level                                |
| `tools`              | `'coding' \| 'readOnly' \| 'all'`                              | `'coding'`      | Which Pi built-in tools to enable                     |
| `instructions`       | `string`                                                       | —               | Custom instruction preamble prepended to every prompt |
| `sessionId`          | `string`                                                       | —               | Enable session continuity across calls                |
| `sessionPersistence` | `'memory' \| 'disk'`                                           | `'memory'`      | Session storage mode (requires `sessionId`)           |
| `defaultProvider`    | `string`                                                       | —               | Fallback provider when model ID omits prefix          |
| `maxToolResultSize`  | `number`                                                       | `10000`         | Truncation limit for tool results                     |
| `agentDir`           | `string`                                                       | —               | Pi config directory                                   |
| `verbose`            | `boolean`                                                      | `false`         | Enable debug/info log output                          |
| `logger`             | `Logger \| false`                                              | console         | Custom logger or `false` to disable all logging       |

### `dispose()`

Call `dispose()` on the provider to clean up all cached sessions:

```ts
const provider = createPi();

// ... use the provider ...

await provider.dispose();
```

Sessions are also automatically cleaned up on process exit.

## Model Selection

Models are specified in `provider/model` format:

```ts
provider('anthropic/claude-sonnet-4');
provider('openai/gpt-4o');
provider('google/gemini-2.5-pro');
```

Resolution order: `ModelRegistry.find(provider, modelId)` first, then `getModel(provider, modelId)` fallback. If the model ID omits the provider prefix, `defaultProvider` is required or an error is thrown.

## Session Management

By default, each `doGenerate`/`doStream` call creates a fresh in-memory session. For session continuity across calls, pass a `sessionId`:

```ts
const model = provider('anthropic/claude-sonnet-4', {
  sessionId: 'my-session',
});

// First call creates the session
await generateText({ model, prompt: 'Remember: my name is Alice.' });

// Second call reuses the same session
const result = await generateText({ model, prompt: 'What is my name?' });
```

Concurrent requests sharing the same `sessionId` are automatically serialized — only one prompt runs at a time per session.

## Error Handling

The provider classifies Pi errors into AI SDK error types. Error utilities are exported for use in application code:

```ts
import {
  mapPiError,
  isAuthenticationError,
  isTimeoutError,
  isAbortError,
} from 'ai-sdk-provider-pi';

try {
  const result = await generateText({ model, prompt: '...' });
} catch (error) {
  if (isAuthenticationError(error)) {
    console.error('Check your Pi provider credentials');
  } else if (isTimeoutError(error)) {
    console.error('Request timed out');
  } else if (isAbortError(error)) {
    console.error('Request was cancelled');
  }
}
```

Retryable errors (timeouts, 429/5xx) are marked with `isRetryable: true`. Auth and abort errors are not retryable.

## Core Behavior

- Provider calls use `session.prompt(..., { expandPromptTemplates: false, source: 'rpc' })`
- Per-`sessionId` serialization prevents overlapping prompts on the same session
- Instruction preamble combines `settings.instructions`, prompt system parts, and JSON schema guidance (when requested)
- Pi tools are provider-executed; stream emits tool lifecycle events with `providerExecuted: true`

## Limitations

- Language model only; embedding/image-generation models are not implemented (`NoSuchModelError`)
- Structured outputs are best-effort (not provider-enforced)
- `tools: 'all'` currently maps to an explicit built-in tool list; new Pi built-ins may require a provider update

See also:

- `docs/LIMITATIONS.md`
- `docs/TROUBLESHOOTING.md`

## Examples

Run curated examples from repo root:

```bash
npm run example:basic
npm run example:streaming
npm run example:events
npm run example:tools
npm run example:session
npm run example:memory
npm run example:object
npm run example:image
npm run example:abort
npm run example:auth
npm run example:logging
```

Example details and prerequisites are documented in `examples/README.md`.

## Development

```bash
npm run ci
npm run build
npm run typecheck
npm test
```

## Disclaimer

**This is an unofficial community provider** and is not affiliated with or endorsed by the Pi project or Vercel. By using this provider:

- You understand that your data will be sent to the configured model provider's servers through Pi's agent runtime
- You acknowledge this software is provided "as is" without warranties of any kind

Please ensure you have appropriate permissions and comply with all applicable terms when using this provider.

## License

MIT
