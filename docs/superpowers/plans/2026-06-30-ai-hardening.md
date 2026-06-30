# AI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap every `chat.completions.create()` call in `artifacts/api-server` with a hardening helper that adds a 30s timeout, retries once on transient errors with 500ms backoff, classifies errors into a small fixed set of codes, and returns a structured `{ error: { code, message, retryable, retryAfterMs? } }` envelope.

**Architecture:** New `runAiCompletion` helper in `lib/integrations-openai-ai-server` + new `sendAiError`/`isAiError` helpers in `artifacts/api-server`. Sweep 6 `chat.completions.create` call sites in `routes/analyses.ts` to route through the wrapper and use the new error helpers.

**Tech Stack:** TypeScript, OpenAI SDK 6.x, Vitest (for 6 unit tests), Express 5.

**Spec:** [`docs/superpowers/specs/2026-06-30-ai-hardening-design.md`](../specs/2026-06-30-ai-hardening-design.md)

---

## Background for the implementing engineer

This is Phase 3 item 10 from a long-running improvements list. PR #19 (testing+CI) just merged, so:
- Vitest works across the workspace
- `pnpm test` runs the existing 14 tests
- CI runs `typecheck + test + build` on every PR

**Branch:** `feat/ai-hardening` (already checked out).

**Why this matters:** Today, any AI call that hits a timeout, rate limit, or upstream 5xx returns a raw `500 { error: "X failed" }`. Frontend can't distinguish "try again in 30s" from "your API key is wrong." With this change, the frontend gets a code + retryable flag and can render the right toast.

**Call sites (6 total)** in `artifacts/api-server/src/routes/analyses.ts`:

| Line | Route | Purpose |
|---|---|---|
| 198 | inside `validateLatex` helper, in `POST /analyses/:id/validate-latex` repair loop | LaTeX repair attempt |
| 360 | `POST /analyses` | Main analyze call |
| 851 | `POST /fetch-job` (Exa) | AI extract of job description from raw HTML text |
| 915 | `POST /analyses/:id/cover-letter` | Tailored cover letter generation |
| 962 | `POST /analyses/:id/linkedin-post` | LinkedIn post generation |
| 1026 | `POST /analyses/:id/rewrite-bullet` | Bullet rewriting |

(The spec's risk table listed 4 routes; we cover all 6. Lines may shift if other PRs have landed between spec and implementation — use grep `grep -n "chat\\.completions\\.create" artifacts/api-server/src/routes/analyses.ts` to re-locate.)

**OpenAI SDK 6.x classes used:** `APIError`, `APIConnectionError`, `APIConnectionTimeoutError`, `RateLimitError`, `AuthenticationError`, `PermissionDeniedError`, `BadRequestError`, `InternalServerError`. Verified exported from `openai` package root via `openai@6.35.0/index.d.ts`.

**OpenAI SDK timeout API:** `client.chat.completions.create(params, { timeout: ms })`. Documented in openai 4.x+; the second-positional options object accepts `timeout`, `maxRetries`, `signal`. We use it directly — no need for `AbortController`.

**Typecheck command (after every task):**
```bash
pnpm run typecheck
```
Every workspace `Done`.

**Test command:**
```bash
pnpm run test
```
Expected baseline (before this PR's tests): 14 passing. After this PR adds 6 tests, expect 20.

**Conventions:**
- Conventional commits
- Stay on `feat/ai-hardening`
- Don't change route handler logic except for the wrapped AI call + the catch block

---

## File Map

### Files to create

```
lib/integrations-openai-ai-server/src/run-completion.ts        — wrapper + types + classifier
lib/integrations-openai-ai-server/src/run-completion.test.ts   — 6 unit tests
artifacts/api-server/src/lib/send-ai-error.ts                  — Express response helper
```

### Files to modify

```
lib/integrations-openai-ai-server/src/index.ts                 — re-export new helpers
artifacts/api-server/src/routes/analyses.ts                    — convert 6 call sites
```

---

## Task 1: Implement `runAiCompletion` wrapper

**Files:**
- Create: `lib/integrations-openai-ai-server/src/run-completion.ts`
- Modify: `lib/integrations-openai-ai-server/src/index.ts`

### Step 1: Create the wrapper module

Create `lib/integrations-openai-ai-server/src/run-completion.ts`:

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
    (err as { code: string }).code.startsWith("AI_") &&
    "retryable" in err
  );
}

interface RunOptions {
  /** Per-attempt timeout in ms. Default 30000. */
  timeoutMs?: number;
  /** Number of retries on retryable errors. Default 1. Set to 0 to disable. */
  retries?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_BACKOFF_MS = 500;
const MISSING_KEY_SENTINEL = "missing-api-key";

/**
 * Wrap `client.chat.completions.create` with a timeout, one retry on
 * retryable errors, and structured AiError mapping.
 *
 * Pre-flight: if the client was constructed with the missing-key sentinel,
 * throws AI_CONFIG_MISSING without making a network call.
 */
export async function runAiCompletion(
  client: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  opts: RunOptions = {},
): Promise<OpenAI.Chat.ChatCompletion> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.retries ?? DEFAULT_RETRIES;

  // Pre-flight: missing key check (best-effort; falls through to a real call
  // if the accessor isn't available on this SDK version).
  const apiKey = (client as unknown as { apiKey?: string }).apiKey;
  if (!apiKey || apiKey === MISSING_KEY_SENTINEL) {
    throw makeAiError(
      "AI_CONFIG_MISSING",
      false,
      "DEEPSEEK_API_KEY is not configured on the server",
    );
  }

  let lastError: AiError | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.chat.completions.create(params, { timeout: timeoutMs });
    } catch (err) {
      const aiErr = classifyAiError(err);
      lastError = aiErr;
      if (attempt < maxRetries && aiErr.retryable) {
        const delay = aiErr.retryAfterMs ?? DEFAULT_BACKOFF_MS * (attempt + 1);
        await sleep(delay);
        continue;
      }
      throw aiErr;
    }
  }
  // Unreachable but TS doesn't know that.
  throw lastError ?? makeAiError("AI_UNKNOWN", true, "runAiCompletion: exhausted retries");
}

function makeAiError(
  code: AiErrorCode,
  retryable: boolean,
  message: string,
  retryAfterMs?: number,
  cause?: unknown,
): AiError {
  const err = new Error(message) as AiError;
  err.code = code;
  err.retryable = retryable;
  if (retryAfterMs != null) err.retryAfterMs = retryAfterMs;
  if (cause != null) err.cause = cause;
  return err;
}

function classifyAiError(err: unknown): AiError {
  // Already-classified errors (e.g. from pre-flight check or nested calls) pass through.
  if (isAiError(err)) return err;

  // OpenAI SDK class hierarchy. Order matters: more specific classes first.
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return makeAiError("AI_TIMEOUT", true, "AI service timed out", undefined, err);
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return makeAiError("AI_TIMEOUT", true, "AI service connection error", undefined, err);
  }
  if (err instanceof OpenAI.RateLimitError) {
    const retryAfterMs = parseRetryAfterMs(err);
    return makeAiError(
      "AI_RATE_LIMITED",
      true,
      "AI service rate-limited the request",
      retryAfterMs,
      err,
    );
  }
  if (err instanceof OpenAI.AuthenticationError) {
    return makeAiError("AI_AUTH_INVALID", false, "AI service rejected the API key", undefined, err);
  }
  if (err instanceof OpenAI.PermissionDeniedError) {
    return makeAiError(
      "AI_QUOTA_EXCEEDED",
      false,
      "AI service quota exceeded or permission denied",
      undefined,
      err,
    );
  }
  if (err instanceof OpenAI.BadRequestError) {
    return makeAiError("AI_BAD_REQUEST", false, "AI service rejected the request", undefined, err);
  }
  if (err instanceof OpenAI.APIError) {
    // Generic API error — likely a 5xx. Retryable.
    return makeAiError("AI_UNKNOWN", true, err.message || "AI service error", undefined, err);
  }

  // Anything else (e.g. native fetch errors, DNS failures) — treat as retryable unknown.
  const message = err instanceof Error ? err.message : "Unknown AI error";
  return makeAiError("AI_UNKNOWN", true, message, undefined, err);
}

function parseRetryAfterMs(err: OpenAI.RateLimitError): number | undefined {
  // The OpenAI SDK exposes response headers via err.headers when available.
  const headers = (err as unknown as { headers?: Record<string, string> | Headers }).headers;
  if (!headers) return undefined;
  const value = typeof (headers as Headers).get === "function"
    ? (headers as Headers).get("retry-after")
    : (headers as Record<string, string>)["retry-after"];
  if (!value) return undefined;
  // Retry-After can be seconds or an HTTP date. Handle seconds.
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds * 1000);
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### Step 2: Re-export from the package index

Modify `lib/integrations-openai-ai-server/src/index.ts`. Current content:

```ts
export { getAiClient, openai, DEEPSEEK_DEFAULT_BASE_URL } from "./client";
export { generateImageBuffer, editImages } from "./image";
export { batchProcess, batchProcessWithSSE, isRateLimitError, type BatchOptions } from "./batch";

// Re-export the OpenAI type so consumers can reach into its namespaced types
// (e.g. `OpenAI.Chat.ChatCompletionCreateParamsNonStreaming`) without taking
// a direct dependency on the `openai` package.
export type { default as OpenAI } from "openai";
```

Add the new exports:

```ts
export { getAiClient, openai, DEEPSEEK_DEFAULT_BASE_URL } from "./client";
export { generateImageBuffer, editImages } from "./image";
export { batchProcess, batchProcessWithSSE, isRateLimitError, type BatchOptions } from "./batch";
export {
  runAiCompletion,
  isAiError,
  type AiError,
  type AiErrorCode,
} from "./run-completion";

// Re-export the OpenAI type so consumers can reach into its namespaced types
// (e.g. `OpenAI.Chat.ChatCompletionCreateParamsNonStreaming`) without taking
// a direct dependency on the `openai` package.
export type { default as OpenAI } from "openai";
```

### Step 3: Typecheck

```bash
pnpm run typecheck
```

Every workspace `Done`. Common issue: `OpenAI.APIError` etc. might not be accessible via the namespace import. If errors mention "Property 'APIError' does not exist on type 'typeof OpenAI'", change the `instanceof` checks to use a named import:

```ts
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
```

Then `err instanceof APIConnectionTimeoutError` (without the `OpenAI.` prefix).

### Step 4: Commit

```bash
git add lib/integrations-openai-ai-server/src/run-completion.ts \
        lib/integrations-openai-ai-server/src/index.ts
git commit -m "feat(ai): runAiCompletion wrapper with timeout, retry, structured errors"
```

If `git status` shows stray modifications, do NOT include them.

### Step 5: Self-check

- `grep -c "^export" lib/integrations-openai-ai-server/src/run-completion.ts` ≥ 4 (AiErrorCode, AiError, isAiError, runAiCompletion)
- `grep -c "runAiCompletion" lib/integrations-openai-ai-server/src/index.ts` = 1
- Typecheck clean

---

## Task 2: Tests for `runAiCompletion`

**Files:**
- Create: `lib/integrations-openai-ai-server/src/run-completion.test.ts`

### Step 1: Write the test file

Create `lib/integrations-openai-ai-server/src/run-completion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import OpenAI, {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  RateLimitError,
} from "openai";
import { runAiCompletion, isAiError } from "./run-completion";

/**
 * Build a fake OpenAI client whose `chat.completions.create` is driven by
 * a queue of behaviors. Each call shifts the next behavior off the queue.
 */
function makeFakeClient(behaviors: Array<"success" | (() => never) | (() => Promise<never>)>, apiKey: string = "real-key") {
  const fake = {
    apiKey,
    chat: {
      completions: {
        create: async () => {
          const next = behaviors.shift();
          if (next === "success") {
            return {
              id: "chatcmpl-test",
              choices: [{ message: { content: "ok", role: "assistant" }, index: 0, finish_reason: "stop" }],
              created: 0,
              model: "test-model",
              object: "chat.completion",
            } as unknown as OpenAI.Chat.ChatCompletion;
          }
          if (typeof next === "function") {
            return next();
          }
          throw new Error("test setup: no behavior queued");
        },
      },
    },
  };
  return fake as unknown as OpenAI;
}

function buildApiError(ErrorClass: typeof APIError, status: number, message: string, headers?: Record<string, string>): APIError {
  // The OpenAI SDK's APIError constructor signature varies; use the static factory if needed.
  // Simpler: construct a plain object with Error prototype set to the class.
  const err = Object.create(ErrorClass.prototype) as APIError;
  Object.assign(err, {
    status,
    message,
    name: ErrorClass.name,
    headers: headers ?? {},
  });
  // Ensure instanceof works
  Object.setPrototypeOf(err, ErrorClass.prototype);
  return err;
}

const PARAMS = {
  model: "test-model",
  messages: [{ role: "user", content: "hello" }],
} as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;

describe("runAiCompletion", () => {
  it("returns the completion on first success", async () => {
    const client = makeFakeClient(["success"]);
    const result = await runAiCompletion(client, PARAMS);
    expect(result.choices[0]?.message?.content).toBe("ok");
  });

  it("throws AI_CONFIG_MISSING when apiKey is 'missing-api-key'", async () => {
    const client = makeFakeClient([], "missing-api-key");
    await expect(runAiCompletion(client, PARAMS)).rejects.toMatchObject({
      code: "AI_CONFIG_MISSING",
      retryable: false,
    });
  });

  it("retries once on APIConnectionError, then succeeds", async () => {
    const client = makeFakeClient([
      () => {
        const err = Object.create(APIConnectionError.prototype);
        Object.assign(err, { message: "connect ECONNRESET", name: "APIConnectionError" });
        throw err;
      },
      "success",
    ]);
    const result = await runAiCompletion(client, PARAMS, { retries: 1 });
    expect(result.choices[0]?.message?.content).toBe("ok");
  });

  it("throws AI_RATE_LIMITED with retryable: true after retries exhausted on 429", async () => {
    const fail = () => {
      throw buildApiError(RateLimitError, 429, "Too Many Requests");
    };
    const client = makeFakeClient([fail, fail]); // both attempts fail
    await expect(runAiCompletion(client, PARAMS, { retries: 1 })).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
      retryable: true,
    });
  });

  it("throws AI_AUTH_INVALID with retryable: false on 401", async () => {
    const client = makeFakeClient([
      () => {
        throw buildApiError(AuthenticationError, 401, "Invalid API key");
      },
    ]);
    await expect(runAiCompletion(client, PARAMS, { retries: 1 })).rejects.toMatchObject({
      code: "AI_AUTH_INVALID",
      retryable: false,
    });
  });

  it("throws AI_BAD_REQUEST with retryable: false on 400", async () => {
    const client = makeFakeClient([
      () => {
        throw buildApiError(BadRequestError, 400, "Bad request");
      },
    ]);
    await expect(runAiCompletion(client, PARAMS, { retries: 1 })).rejects.toMatchObject({
      code: "AI_BAD_REQUEST",
      retryable: false,
    });
  });

  it("isAiError narrows correctly", () => {
    const aiErr = Object.assign(new Error("x"), { code: "AI_UNKNOWN", retryable: true });
    expect(isAiError(aiErr)).toBe(true);
    expect(isAiError(new Error("regular"))).toBe(false);
    expect(isAiError(null)).toBe(false);
    expect(isAiError({ code: "OTHER" })).toBe(false);
  });
});
```

### Step 2: Run the tests

```bash
pnpm --filter @workspace/integrations-openai-ai-server run test
```

Expected: 7 tests pass.

If the package doesn't have a `test` script yet, add it to `lib/integrations-openai-ai-server/package.json` `scripts`:
```json
"test": "vitest run"
```

And add `vitest: catalog:` to `devDependencies` if missing, then `pnpm install`. Check with:
```bash
grep "\"test\"" lib/integrations-openai-ai-server/package.json
grep "\"vitest\"" lib/integrations-openai-ai-server/package.json
```

If a vitest config is needed for this workspace, create `lib/integrations-openai-ai-server/vitest.config.ts`:
```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "integrations-openai-ai-server",
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
```

And add this path to the root `vitest.workspace.ts`:
```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "lib/api-zod/vitest.config.ts",
  "lib/db/vitest.config.ts",
  "lib/integrations-openai-ai-server/vitest.config.ts",  // NEW
  "artifacts/api-server/vitest.config.ts",
  "artifacts/resume-matcher/vitest.config.ts",
]);
```

### Step 3: Run all tests from root to confirm no regressions

```bash
pnpm run test
```

Expected: 14 (existing) + 7 (new) = 21 passing. 4 workspaces if you didn't add the new vitest config; 5 workspaces if you did.

### Step 4: Typecheck

```bash
pnpm run typecheck
```
Every workspace `Done`.

### Step 5: Commit

```bash
git add lib/integrations-openai-ai-server/
git commit -m "test(ai): unit tests for runAiCompletion classification and retry"
```

If `vitest.workspace.ts` and the new vitest config were added, include them in the same commit.

If `git status` shows stray modifications, do NOT include them.

### Step 6: Self-check

- `grep -c "^  it(" lib/integrations-openai-ai-server/src/run-completion.test.ts` ≥ 7
- `pnpm run test` reports ≥ 21 passing

---

## Task 3: `sendAiError` Express response helper

**Files:**
- Create: `artifacts/api-server/src/lib/send-ai-error.ts`

### Step 1: Write the helper

Create `artifacts/api-server/src/lib/send-ai-error.ts`:

```ts
import type { Response } from "express";
import type { AiError, AiErrorCode } from "@workspace/integrations-openai-ai-server";

const HTTP_BY_CODE: Record<AiErrorCode, number> = {
  AI_TIMEOUT: 504,
  AI_RATE_LIMITED: 429,
  AI_AUTH_INVALID: 503,
  AI_QUOTA_EXCEEDED: 503,
  AI_BAD_REQUEST: 400,
  AI_CONFIG_MISSING: 503,
  AI_UNKNOWN: 502,
};

const FRIENDLY_BY_CODE: Record<AiErrorCode, string> = {
  AI_TIMEOUT: "The AI service took too long to respond. Try again.",
  AI_RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  AI_AUTH_INVALID: "AI service authentication failed. Contact the server admin.",
  AI_QUOTA_EXCEEDED: "AI service quota exceeded. Try again later.",
  AI_BAD_REQUEST: "The AI service rejected the request. Please try a different input.",
  AI_CONFIG_MISSING: "AI features are not configured on this server.",
  AI_UNKNOWN: "The AI service returned an unexpected error. Try again.",
};

/**
 * Translate an AiError into the wire envelope:
 *   { error: { code, message, retryable, retryAfterMs? } }
 *
 * `friendlyMessageOverride` lets callers customize the user-facing message
 * (e.g. "Cover letter generation failed") while preserving the structured code.
 */
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

### Step 2: Typecheck

```bash
pnpm run typecheck
```
Every workspace `Done`.

### Step 3: Commit

```bash
git add artifacts/api-server/src/lib/send-ai-error.ts
git commit -m "feat(api-server): sendAiError helper for structured AI error envelope"
```

If `git status` shows stray modifications, do NOT include them.

### Step 4: Self-check

- `grep -c "^export" artifacts/api-server/src/lib/send-ai-error.ts` = 1 (sendAiError)
- `grep -c "AI_TIMEOUT\\|AI_RATE_LIMITED\\|AI_AUTH_INVALID\\|AI_QUOTA_EXCEEDED\\|AI_BAD_REQUEST\\|AI_CONFIG_MISSING\\|AI_UNKNOWN" artifacts/api-server/src/lib/send-ai-error.ts` = 14 (each code appears once in HTTP_BY_CODE + once in FRIENDLY_BY_CODE)

---

## Task 4: Convert 6 AI call sites in routes/analyses.ts

**Files:**
- Modify: `artifacts/api-server/src/routes/analyses.ts`

### Step 1: Add imports

At the top of `artifacts/api-server/src/routes/analyses.ts`, find the existing import from `@workspace/integrations-openai-ai-server`:

```ts
import { getAiClient } from "@workspace/integrations-openai-ai-server";
```

Replace with:

```ts
import { getAiClient, runAiCompletion, isAiError } from "@workspace/integrations-openai-ai-server";
```

Then add a new import for `sendAiError`:

```ts
import { sendAiError } from "../lib/send-ai-error";
```

(Place it near the other `../lib/...` imports — typically just after the existing `from "../lib/logger"`, `from "../lib/ai-from-request"`, etc.)

### Step 2: Locate call sites

Re-find the AI call sites in case line numbers shifted:

```bash
grep -n "chat\\.completions\\.create" artifacts/api-server/src/routes/analyses.ts
```

Expected output: 6 lines, approximately at 198, 360, 851, 915, 962, 1026 (lines vary slightly).

### Step 3: Convert each call site — the pattern

For every `chat.completions.create({...})` call, the conversion is:

**Before:**
```ts
const completion = await someAiAccessor.chat.completions.create({
  model: "deepseek-chat",
  max_completion_tokens: 8192,
  messages: [{ role: "user", content: prompt }],
});
```

**After:**
```ts
const completion = await runAiCompletion(someAiAccessor, {
  model: "deepseek-chat",
  max_completion_tokens: 8192,
  messages: [{ role: "user", content: prompt }],
});
```

The accessor (`someAiAccessor`) is either `getAiFromRequest(req)` or a local `ai` variable from `getAiClient(...)`. The argument shape is identical.

### Step 4: Convert each catch block — the pattern

Find each `} catch (err) { ... res.status(500).json({ error: "X failed" }); }` block adjacent to the converted call.

**Before:**
```ts
} catch (err) {
  logger.error({ err }, "Cover letter generation failed");
  res.status(500).json({ error: "Cover letter generation failed" });
}
```

**After:**
```ts
} catch (err) {
  logger.error({ err }, "Cover letter generation failed");
  if (isAiError(err)) {
    sendAiError(res, err, "Cover letter generation failed");
  } else {
    res.status(500).json({ error: "Cover letter generation failed" });
  }
}
```

The non-AI fallback (`res.status(500)...`) handles DB errors, parsing errors, etc.

### Step 5: Specific call sites

For each of the 6 lines, apply both transformations (call site + nearest catch). The 6 spots:

#### Call site 1 — `validateLatex` repair loop (~line 198)

Inside `validateLatex` (top-level helper, not inside a route). The AI call is around line 198. There's no `try/catch` wrapping just this call — the function relies on its caller's try/catch.

Convert ONLY the call (Step 3 pattern). Don't add a try/catch here; the upstream caller (`POST /analyses/:id/validate-latex` route handler) will catch the AiError and call `sendAiError`. Verify the upstream handler is at line ~453 and that its catch block uses the Step 4 pattern.

#### Call site 2 — `POST /analyses` (~line 360)

Inside the main `POST /analyses` route handler. Wrapped in a try/catch (lines ~309-369 approximately).

Convert both:
- The `ai.chat.completions.create({...})` call → `runAiCompletion(ai, {...})`
- The route's catch block. Search for the catch block AFTER line 360 (probably around line 368 or later).

The current catch may have several `res.status(...)` branches (validation errors before the AI call have their own returns). The Step 4 wrap goes around the AI-related catch only.

#### Call site 3 — `POST /fetch-job` Exa extract (~line 851)

Convert the call (Step 3). Find the route's catch block (around line 875 from the grep output) and apply Step 4.

#### Call site 4 — `POST /analyses/:id/cover-letter` (~line 915)

Convert call + catch (around line 929-932).

#### Call site 5 — `POST /analyses/:id/linkedin-post` (~line 962)

Convert call + catch (around line 976-979).

#### Call site 6 — `POST /analyses/:id/rewrite-bullet` (~line 1026)

Convert call + catch (around line 1035).

### Step 6: Verify all 6 are converted

```bash
grep -c "chat\\.completions\\.create" artifacts/api-server/src/routes/analyses.ts
# Expected: 0 — all should now use runAiCompletion
```

```bash
grep -c "runAiCompletion" artifacts/api-server/src/routes/analyses.ts
# Expected: 6
```

```bash
grep -c "sendAiError" artifacts/api-server/src/routes/analyses.ts
# Expected: 5 (one per route catch block; validate-latex's caller might use it OR not — check whichever it is)
```

If the `sendAiError` count is less than 5, recheck each route's catch block.

### Step 7: Typecheck

```bash
pnpm run typecheck
```

Every workspace `Done`. Common issues:
- `isAiError` not imported → add to the imports
- Generic type mismatch in `runAiCompletion` second argument → ensure the params object is structurally an `OpenAI.Chat.ChatCompletionCreateParamsNonStreaming`. If TS complains, cast: `runAiCompletion(ai, params as Parameters<typeof runAiCompletion>[1])`.

### Step 8: Run existing tests to confirm no regressions

```bash
pnpm run test
```

Expected: 21 passing (14 existing + 7 from Task 2). None of the existing 9 api-server tests hit AI routes, so they should continue passing.

### Step 9: Commit

```bash
git add artifacts/api-server/src/routes/analyses.ts
git commit -m "refactor(api-server): route AI calls through runAiCompletion"
```

If `git status` shows stray modifications, do NOT include them.

### Step 10: Self-check

- `grep -c "chat\\.completions\\.create" artifacts/api-server/src/routes/analyses.ts` = 0
- `grep -c "runAiCompletion" artifacts/api-server/src/routes/analyses.ts` = 6
- `grep -c "sendAiError\\|isAiError" artifacts/api-server/src/routes/analyses.ts` ≥ 5
- `pnpm run test` passes 21

---

## Task 5: Final verification + push + open PR

**Files:** (verification only)

### Step 1: Run the full validation chain

```bash
pnpm run typecheck && pnpm run test && pnpm run build
```

All three must pass. The `pnpm run build` step ensures Vite + Tailwind + esbuild can produce production artifacts (this is what CI also runs).

### Step 2: Sanity grep

```bash
# Confirm no leftover direct AI calls
grep -nE "\\.chat\\.completions\\.create" artifacts/api-server/src/routes/analyses.ts
# Expected: empty

# Confirm hardened call sites
grep -nE "runAiCompletion" artifacts/api-server/src/routes/analyses.ts | wc -l
# Expected: 6
```

### Step 3: Push and open PR

```bash
git push -u origin feat/ai-hardening
gh pr create --base main --head feat/ai-hardening \
  --title "feat: AI call hardening (Phase 3 item 10)" \
  --body "$(cat <<'PRBODY'
## Summary

Phase 3 item 10 from the improvements list. Hardens every AI call in `artifacts/api-server` so the user gets a structured error envelope instead of a generic 500.

**Spec:** `docs/superpowers/specs/2026-06-30-ai-hardening-design.md`
**Plan:** `docs/superpowers/plans/2026-06-30-ai-hardening.md`

## What's new

- `runAiCompletion(client, params, opts?)` in `lib/integrations-openai-ai-server`: wraps `chat.completions.create` with 30s timeout, 1 retry on retryable errors with 500ms backoff, and structured `AiError` classification
- `isAiError`, `AiError`, `AiErrorCode` types exported from the same package
- `sendAiError(res, err, friendlyMessage?)` in `artifacts/api-server/src/lib`: translates `AiError` into wire envelope `{ error: { code, message, retryable, retryAfterMs? } }`
- 6 AI call sites in `routes/analyses.ts` converted to use both helpers

## Error taxonomy

| Code | HTTP | Retryable |
|---|---|---|
| `AI_TIMEOUT` | 504 | yes |
| `AI_RATE_LIMITED` | 429 | yes (with `retryAfterMs`) |
| `AI_AUTH_INVALID` | 503 | no |
| `AI_QUOTA_EXCEEDED` | 503 | no |
| `AI_BAD_REQUEST` | 400 | no |
| `AI_CONFIG_MISSING` | 503 | no |
| `AI_UNKNOWN` | 502 | yes |

## Tests (7 new, 21 total)

- Happy path: returns completion
- `AI_CONFIG_MISSING` pre-flight check
- Retry on `APIConnectionError` succeeds
- `AI_RATE_LIMITED` retryable after retries exhausted
- `AI_AUTH_INVALID` non-retryable
- `AI_BAD_REQUEST` non-retryable
- `isAiError` narrows correctly

## Test plan

- [x] `pnpm run typecheck` clean
- [x] `pnpm run test` reports 21/21 passing
- [x] `pnpm run build` succeeds
- [ ] CI gates pass on this PR

## What's NOT in this PR

- Frontend toast UX for specific error codes (works automatically via `error.message`)
- Caching of AI completions (Phase 3 item 14 in the original backlog)
- Streaming support
- AI cost/token tracking (Phase 3 item 11 — observability)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

### Step 4: Done

No further commit. 4 commits + 1 PR.

---

## Done

Repo has hardened AI calls. The user-facing error UX is structured, the server resists transient network blips, and timeouts no longer hang the connection.

Remaining items from the improvements list: 11 (observability), 12 (Drizzle migrations). Both independent of this PR.
