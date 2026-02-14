# Troubleshooting

## Authentication Errors

Symptoms:

- `LoadAPIKeyError`
- model not available in Pi session startup

Checks:

- Confirm Pi auth is configured for the provider you are using.
- Confirm the model ID is valid and available to your account.
- Try listing or validating models through Pi tooling first.

## Model ID Errors

Symptoms:

- error about missing provider prefix
- `NoSuchModelError`

Checks:

- Use `provider/model` format, for example `anthropic/claude-sonnet-4`.
- If omitting provider prefix intentionally, set `defaultProvider`.
- Verify provider/model exists in `ModelRegistry`; fallback to `getModel` still requires a valid model.

## Session Confusion (State Not Preserved)

Symptoms:

- second call does not remember first call context

Checks:

- Set `sessionId` for continuity.
- Set `sessionPersistence: 'memory'` or `'disk'` with the same `sessionId`.
- Without `sessionId`, each call gets a fresh in-memory session by design.

## Structured Output Problems

Symptoms:

- `generateObject` fails intermittently
- JSON parse failures from text output

Checks:

- Treat structured output as best-effort with Pi.
- Add a fallback path: `generateText` + local JSON extraction + schema validation.
- Keep schemas concise and ensure prompt asks for JSON-only output.

## Tool Output Is Missing or Truncated

Symptoms:

- expected tool detail not fully visible

Checks:

- Increase `maxToolResultSize` in settings.
- Use streaming (`fullStream`) to inspect tool lifecycle and results.

## Cancellation Behavior

Symptoms:

- request appears to run after client cancel

Checks:

- Pass `abortSignal` in AI SDK call options.
- The provider wires abort to `session.abort()`, but downstream model/provider latency can affect responsiveness.
