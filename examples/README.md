# Examples

These scripts demonstrate common integration patterns for `ai-sdk-provider-pi`.

## Prerequisites

- Node.js `>=20`
- Pi authentication configured for your target model provider
- Install dependencies from repo root: `npm install`

Most examples use `anthropic/claude-sonnet-4` and run from repo root with `npx tsx`.

## Example Index

- `basic-usage.ts`
  - Small `generateText` call to verify the provider is working.

- `streaming.ts`
  - Basic `streamText` text-delta consumption.

- `streaming-events.ts`
  - Full event stream inspection (`text-delta`, `reasoning-delta`, `tool-call`, `tool-result`, `finish`).

- `tool-calling.ts`
  - Provider-executed tool lifecycle visibility and output logging.

- `session-management.ts`
  - Reusing a `sessionId` for continuity across calls.

- `memory-comparison.ts`
  - Side-by-side stateless calls vs memory-persisted session behavior.

- `generate-object-basic.ts`
  - `generateObject` best-effort flow with fallback JSON extraction and local schema validation.

- `image-analysis.ts`
  - Vision-style prompt using base64 image file input (`bull.webp` by default).

- `abort-signal.ts`
  - Cancellation examples for both `generateText` and `streamText`.

- `error-handling-auth.ts`
  - Classification handling for auth/timeout errors and warnings.

- `logging-custom-logger.ts`
  - Custom logger integration with `verbose` output.

## Quick Run Commands

```bash
npm run example:basic
npm run example:streaming
npm run example:object
npm run example:image
```

## Notes

- Image URL inputs are not supported by this provider; use base64/binary file parts.
- Structured output is best-effort (`supportsStructuredOutputs = false`).
- Some examples require tool access in the current working directory.
