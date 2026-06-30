# AI Call Hardening

**Date:** 2026-06-30
**Status:** Approved for implementation
**Scope:** Phase 3 item 10 from the "improvements 1-12" list.

## Goal

Wrap every `chat.completions.create()` call in `artifacts/api-server` with a hardening helper that adds a 30-second timeout, retries once on transient errors with 500 ms backoff, classifies errors into a small fixed set of codes, and returns a structured `{ error: { code, message, retryable, retryAfterMs? } }` envelope. The current behavior of "raw 500 with a generic string message" goes away.

## Decisions

| Question | Decision |
|---|---|
| Timeout | 30 s per attempt |
| Retries | 1 retry on retryable errors, 500 ms backoff (or `Retry-After` value when present) |
| Error shape | Structured envelope: `{ error: { code, message, retryable, retryAfterMs? } }` |
| Caching | Out of scope (item 14, separate PR) |
| Helper location | `lib/integrations-openai-ai-server/src/run-completion.ts` |
| Frontend updates | None required (`error.message` field is present, so existing toast wiring still works) |

## Error code taxonomy

| Code | When | Retryable | HTTP |
|---|---|---|---|
| `AI_TIMEOUT` | Request exceeded 30 s, or `APIConnectionTimeoutError` | yes | 504 |
| `AI_RATE_LIMITED` | OpenAI `RateLimitError` (429) | yes (after `Retry-After`) | 429 |
| `AI_AUTH_INVALID` | `AuthenticationError` (401) — server has a bad key | no | 503 |
| `AI_QUOTA_EXCEEDED` | `PermissionDeniedError` (403) | no | 503 |
| `AI_BAD_REQUEST` | `BadRequestError` (400) — prompt issue | no | 400 |
| `AI_CONFIG_MISSING` | Detected before the call: `client.apiKey === "missing-api-key"` | no | 503 |
| `AI_UNKNOWN` | Anything else (incl. 5xx) | yes | 502 |

## New types and helper

`lib/integrations-openai-ai-server/src/run-completion.ts`:

```ts
import OpenAI from "openai";

export type AiErrorCode =
  | "AI_TIMEOUT"
  | "AI_RATE_LIMITED"
  | "AI_AUTH_INVALID"
  | "AI_QUOTA_EXCEEDED"
  | "AI_BAD_REQUEST"
  | "AI_CONFIG_MISSING"
  | "AI_UNKNOWN";

export interface AiError extends Error {
  code: AiErrorCode;
  retryable: boolean;
  retryAfterMs?: number;
  cause?: unknown;
}

export function isAiError(err: unknown): err is AiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    (err as { code: string }).code.startsWith("AI_")
  );
}

interface RunOptions {
  timeoutMs?: number;
  retries?: number;
}

export async function runAiCompletion(
  client: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  opts: RunOptions = {},
): Promise<OpenAI.Chat.ChatCompletion>;
```

`classifyAiError(err)` is internal and maps OpenAI SDK error classes / fetch errors to `AiError` instances.

## Pre-flight config check

Before any network call, `runAiCompletion` checks whether the client was created with the sentinel `"missing-api-key"` (which `getAiClient` uses as a fallback). If so, throws `AI_CONFIG_MISSING` immediately without making a request.

```ts
const apiKey = (client as unknown as { apiKey?: string }).apiKey;
if (!apiKey || apiKey === "missing-api-key") {
  throw makeAiError("AI_CONFIG_MISSING", false, "DEEPSEEK_API_KEY is not configured on the server");
}
```

If the `apiKey` accessor isn't stable on future openai SDK versions, this check no-ops (returns `undefined`) and we fall through to a real call which surfaces the auth error from the SDK. So the check is an optimization, not a load-bearing guarantee.

## Response helper

`artifacts/api-server/src/lib/send-ai-error.ts` translates an `AiError` into the wire envelope.

```ts
import type { Response } from "express";
import type { AiError } from "@workspace/integrations-openai-ai-server";

export function sendAiError(res: Response, err: AiError, friendlyMessageOverride?: string): void {
  const status = HTTP_BY_CODE[err.code] ?? 500;
  res.status(status).json({
    error: {
      code: err.code,
      message: friendlyMessageOverride ?? FRIENDLY_BY_CODE[err.code],
      retryable: err.retryable,
      ...(err.retryAfterMs != null ? { retryAfterMs: err.retryAfterMs } : {}),
    },
  });
}
```

`HTTP_BY_CODE` and `FRIENDLY_BY_CODE` are constants mapping each `AiErrorCode` to (HTTP status, user-facing string).

## Routes to convert

All in `artifacts/api-server/src/routes/analyses.ts`:

| Route | Approx line |
|---|---|
| `POST /analyses` | 305 (multi-stage AI call) |
| `POST /analyses/:id/validate-latex` | 453 |
| `POST /analyses/:id/cover-letter` | 883 |
| `POST /analyses/:id/linkedin-post` | 935 |

For each, the transformation is:
- Replace `ai.chat.completions.create({...})` with `runAiCompletion(ai, {...})`
- Replace `} catch (err) { logger.error(...); res.status(500).json({ error: "X failed" }); }` with:

```ts
} catch (err) {
  logger.error({ err }, "X failed");
  if (isAiError(err)) {
    sendAiError(res, err);
  } else {
    res.status(500).json({ error: "X failed" });
  }
}
```

Routes that DON'T call OpenAI (like `POST /fetch-job` which uses Exa) are untouched.

## Tests

New file: `lib/integrations-openai-ai-server/src/run-completion.test.ts`. Uses a mocked OpenAI client (no real network).

| Test | What |
|---|---|
| Returns the completion on first success | Happy path |
| Throws `AI_CONFIG_MISSING` when apiKey is "missing-api-key" | Pre-flight check fires |
| Retries once on `APIConnectionError`, then succeeds | Retry path |
| Throws `AI_RATE_LIMITED` with `retryable: true` after retries exhausted on 429 | Rate-limit mapping |
| Throws `AI_AUTH_INVALID` with `retryable: false` on 401 | Non-retryable mapping |
| Throws `AI_BAD_REQUEST` with `retryable: false` on 400 | Non-retryable mapping |

Mock strategy: a hand-rolled fake that returns either a `ChatCompletion` or throws an `OpenAI.APIError` subclass. No `vi.mock()` of the SDK module needed.

## Backward compatibility

Routes that don't use `runAiCompletion` still return `{ error: string }`. Frontend hooks that do `setError(err.message)` keep working because `error.message` is present in the new envelope too.

## Files affected

```
Create: lib/integrations-openai-ai-server/src/run-completion.ts
Create: lib/integrations-openai-ai-server/src/run-completion.test.ts
Modify: lib/integrations-openai-ai-server/src/index.ts (re-export)
Create: artifacts/api-server/src/lib/send-ai-error.ts
Modify: artifacts/api-server/src/routes/analyses.ts (4 routes; ~12-15 lines per route changed)
```

## Commits

3:
1. `feat(ai): runAiCompletion wrapper with timeout, retry, structured errors`
2. `feat(api-server): sendAiError helper and AI envelope`
3. `refactor(api-server): route AI calls through runAiCompletion`

## Non-goals

- Caching of completions
- Frontend toast UX for specific error codes (works automatically via `error.message`)
- Streaming
- Cost/token tracking (item 11)
- Migration of `batchProcess` in `lib/integrations-openai-ai-server/src/batch.ts` (used by validate-latex repair loop; deferred — item 10 phase 2 if needed)

## Risks

| Risk | Mitigation |
|---|---|
| `client.apiKey` accessor name changes in openai SDK | Best-effort check; falls back to making the call |
| `OpenAI.APIError` class names differ in our SDK version | Use `instanceof` against re-exported classes; default to `AI_UNKNOWN` retryable |
| Routes that compose multiple AI calls accumulate latency (30s × N) | Acceptable — most routes call once; create-analysis fires up to 3, total 90s worst-case |
| Retry doubles latency on transient errors | Acceptable; 500ms backoff is short |
| Existing api-server tests (PR #19) break | We only added 9 tests, none of which hit AI routes. Should be unaffected |

## What "done" looks like

- `runAiCompletion`, `isAiError`, `AiError`, `AiErrorCode` exported from `@workspace/integrations-openai-ai-server`
- `sendAiError` exists in `artifacts/api-server/src/lib`
- 4 AI-calling routes in `routes/analyses.ts` use the new helpers
- 6 unit tests pass for the wrapper
- All workspaces typecheck and existing tests still pass
- A timed-out AI call returns `504` with `{ error: { code: "AI_TIMEOUT", retryable: true } }` instead of hanging or returning a raw 500
