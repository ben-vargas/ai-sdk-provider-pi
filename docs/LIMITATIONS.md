# Limitations

This provider targets AI SDK v6 `LanguageModelV3` with Pi as the execution runtime.

## Current Limits

- Language model only:
  - `embeddingModel()` and `imageModel()` are not implemented and throw `NoSuchModelError`.

- Structured outputs are best-effort:
  - `supportsStructuredOutputs = false`
  - JSON schema guidance is injected into the prompt preamble
  - output may still be invalid JSON for a requested schema
  - provider metadata reports `structuredOutputValidated: false`

- Image URL passthrough is not supported:
  - use binary/base64 file data for image inputs

- `tools: 'all'` is an explicit built-in tool list:
  - if Pi adds new built-ins upstream, this provider must be updated to include them

- Unsupported AI SDK call options are ignored with warnings:
  - `frequencyPenalty`, `presencePenalty`, `topP`, `topK`, `seed`, `stopSequences`, `includeRawChunks`

## Runtime Scope

- Node.js only (`>=20`)
- Pi auth and model registry setup are external prerequisites
