# Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Prometheus `/api/metrics` endpoint, instrument HTTP requests and AI token usage, and add an `X-Request-Id` middleware that threads through pino logs.

**Architecture:** Three additive pieces — a `prom-client` registry + middleware + route in api-server, a recorder-callback hook in `runAiCompletion` (no new lib→api dep), and a request-ID middleware mounted before pino-http. 5 new tests on top of the existing 21. No existing functionality changes.

**Tech Stack:** `prom-client` (Prometheus Node client), Express 5, pino + pino-http, Vitest + supertest, OpenAI SDK 6.x.

**Spec:** [`docs/superpowers/specs/2026-07-01-observability-design.md`](../specs/2026-07-01-observability-design.md)

---

## Background for the implementing engineer

PRs #19 (testing+CI) and #20 (AI hardening) are merged. So:
- `pnpm run test` runs 21 tests across 5 workspaces
- `runAiCompletion(client, params, opts)` in `@workspace/integrations-openai-ai-server` is the canonical AI call wrapper — all 6 sites in `routes/analyses.ts` already go through it
- pino-http already injects `req.id` (random UUID per request) into log lines
- CI runs on every PR

**Branch:** `feat/observability` (already checked out).

**Why this matters:** Right now there's no way to see "how many tokens did we burn today" or "p95 cover-letter latency" without scraping logs. Production-readiness requires a `/metrics` endpoint that Grafana / Datadog / OTel collectors can scrape.

**Confirmed via grep before writing this plan:**
- 6 `runAiCompletion` call sites in `routes/analyses.ts` at lines 199, 361, 860, 928, 979, 1047.
- `routes/index.ts` aggregates health, job-search, saved-jobs, search-alerts, analyses routers.
- `validateAndCorrectLatexForPdf(req, inputLatex, context)` is the helper holding the line-199 AI call; we'll extend its signature with a `route` parameter passed by the caller.

**Typecheck (after every task):**
```bash
pnpm run typecheck
```
Every workspace `Done`.

**Test command:**
```bash
pnpm run test
```
Baseline: 21 passing. After Tasks 1 + 4 add 5 tests, expect 26.

**Conventions:**
- Conventional commits
- Stay on `feat/observability`
- Each task → one commit (5 commits total before the verify task)

---

## File Map

### Files to create

```
artifacts/api-server/src/lib/metrics.ts              — prom-client Registry + 3 metrics
artifacts/api-server/src/lib/metrics.test.ts         — 3 tests (counter, histogram, /metrics endpoint)
artifacts/api-server/src/middlewares/metrics.ts      — HTTP request-observation middleware
artifacts/api-server/src/middlewares/request-id.ts   — X-Request-Id middleware
artifacts/api-server/src/routes/metrics.ts           — Express route serving /metrics
```

### Files to modify

```
artifacts/api-server/package.json                    — add prom-client
artifacts/api-server/src/app.ts                      — wire middlewares
artifacts/api-server/src/index.ts                    — register AI token recorder before app.listen
artifacts/api-server/src/routes/index.ts             — mount /metrics route
artifacts/api-server/src/routes/analyses.ts          — pass `route` to 6 runAiCompletion calls
lib/integrations-openai-ai-server/src/run-completion.ts       — add recorder hook + route opt
lib/integrations-openai-ai-server/src/run-completion.test.ts  — 2 new tests
lib/integrations-openai-ai-server/src/index.ts                — re-export setAiTokenRecorder
```

---

## Task 1: AI token recorder hook in runAiCompletion

**Files:**
- Modify: `lib/integrations-openai-ai-server/src/run-completion.ts`
- Modify: `lib/integrations-openai-ai-server/src/run-completion.test.ts`
- Modify: `lib/integrations-openai-ai-server/src/index.ts`

### Step 1: Add route opt + recorder hook to run-completion.ts

The file currently has a `RunOptions` interface with `timeoutMs` + `retries`. Add `route`. Also add a module-level recorder callback + setter + internal helper.

Read the file at `lib/integrations-openai-ai-server/src/run-completion.ts`. Find the `interface RunOptions` block (around line 36). Replace with:

```ts
interface RunOptions {
  /** Per-attempt timeout in ms. Default 30000. */
  timeoutMs?: number;
  /** Number of retries on retryable errors. Default 1. Set to 0 to disable. */
  retries?: number;
  /** Express route pattern (e.g. "/analyses/:id/cover-letter"). Used as a metrics label. */
  route?: string;
}
```

Just BEFORE the `interface RunOptions` block (i.e. after the existing `isAiError` function ends), add:

```ts
export type AiTokenEvent = {
  model: string;
  route: string;
  outcome: "success" | "error";
  tokens: number;
};

export type AiTokenRecorder = (event: AiTokenEvent) => void;

let tokenRecorder: AiTokenRecorder | null = null;

/**
 * Register a callback that receives a token-usage event after every
 * runAiCompletion call (success or classified failure). Pass `null` to
 * unregister. The recorder is wrapped in a try/catch internally — a thrown
 * exception from the recorder cannot crash the AI call.
 */
export function setAiTokenRecorder(fn: AiTokenRecorder | null): void {
  tokenRecorder = fn;
}

function recordAiTokens(event: AiTokenEvent): void {
  if (tokenRecorder) {
    try {
      tokenRecorder(event);
    } catch {
      /* swallow — metrics failures never crash AI calls */
    }
  }
}
```

### Step 2: Call recordAiTokens in the success and error paths

Find the `runAiCompletion` body's for-loop (currently around line 67-82). The body looks roughly like:

```ts
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
```

Replace the entire loop body with:

```ts
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    const completion = await client.chat.completions.create(params, { timeout: timeoutMs });
    recordAiTokens({
      model: params.model,
      route: opts.route ?? "unknown",
      outcome: "success",
      tokens: completion.usage?.total_tokens ?? 0,
    });
    return completion;
  } catch (err) {
    const aiErr = classifyAiError(err);
    lastError = aiErr;
    if (attempt < maxRetries && aiErr.retryable) {
      const delay = aiErr.retryAfterMs ?? DEFAULT_BACKOFF_MS * (attempt + 1);
      await sleep(delay);
      continue;
    }
    recordAiTokens({
      model: params.model,
      route: opts.route ?? "unknown",
      outcome: "error",
      tokens: 0,
    });
    throw aiErr;
  }
}
```

`params.model` is typed `string` by the OpenAI SDK so no cast needed.

### Step 3: Re-export from index

Modify `lib/integrations-openai-ai-server/src/index.ts`. Find the line:

```ts
export {
  runAiCompletion,
  isAiError,
  type AiError,
  type AiErrorCode,
} from "./run-completion";
```

Replace with:

```ts
export {
  runAiCompletion,
  isAiError,
  setAiTokenRecorder,
  type AiError,
  type AiErrorCode,
  type AiTokenEvent,
  type AiTokenRecorder,
} from "./run-completion";
```

### Step 4: Add 2 tests

Open `lib/integrations-openai-ai-server/src/run-completion.test.ts`. At the end of the file (after the existing `isAiError narrows correctly` test, INSIDE the existing `describe("runAiCompletion", ...)` block), add 2 tests:

```ts
  it("calls the registered token recorder with outcome=success on success", async () => {
    const events: Array<{ model: string; route: string; outcome: string; tokens: number }> = [];
    setAiTokenRecorder((e) => events.push(e));
    try {
      const client = makeFakeClient(["success"]);
      // Inject usage into the fake; current makeFakeClient returns no usage.
      // Override via behavior — easier: assert that tokens defaults to 0.
      await runAiCompletion(client, PARAMS, { route: "/test/route" });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        model: "test-model",
        route: "/test/route",
        outcome: "success",
      });
      // The fake doesn't include `usage`, so tokens default to 0.
      expect(events[0]?.tokens).toBe(0);
    } finally {
      setAiTokenRecorder(null);
    }
  });

  it("calls the registered token recorder with outcome=error after classified failure", async () => {
    const events: Array<{ outcome: string; tokens: number }> = [];
    setAiTokenRecorder((e) => events.push(e));
    try {
      const client = makeFakeClient([
        () => {
          throw buildApiError(AuthenticationError, 401, "Invalid API key");
        },
      ]);
      await expect(runAiCompletion(client, PARAMS, { retries: 0, route: "/test/route" })).rejects.toMatchObject({
        code: "AI_AUTH_INVALID",
      });
      expect(events).toHaveLength(1);
      expect(events[0]?.outcome).toBe("error");
      expect(events[0]?.tokens).toBe(0);
    } finally {
      setAiTokenRecorder(null);
    }
  });
```

Add `setAiTokenRecorder` to the existing import at the top of the file:

```ts
import { runAiCompletion, isAiError, setAiTokenRecorder } from "./run-completion";
```

### Step 5: Run tests

```bash
pnpm --filter @workspace/integrations-openai-ai-server run test
```

Expected: 9 tests passing (7 existing + 2 new).

If the new tests fail:
- "events.length is 0" — recordAiTokens didn't fire. Check that `tokenRecorder` is set and that the success path reaches the recorder call.
- "tokens is undefined" — `params.model` access path is wrong. Check the TS interface for `OpenAI.Chat.ChatCompletionCreateParamsNonStreaming.model`.

### Step 6: Typecheck

```bash
pnpm run typecheck
```
Every workspace `Done`.

### Step 7: Commit

```bash
git add lib/integrations-openai-ai-server/src/run-completion.ts \
        lib/integrations-openai-ai-server/src/run-completion.test.ts \
        lib/integrations-openai-ai-server/src/index.ts
git commit -m "feat(ai): token recorder hook in runAiCompletion"
```

If `git status` shows stray modifications, do NOT include them.

### Self-review

- `grep -c "setAiTokenRecorder" lib/integrations-openai-ai-server/src/run-completion.ts` ≥ 2 (export + internal use)
- `grep -c "recordAiTokens" lib/integrations-openai-ai-server/src/run-completion.ts` ≥ 3 (definition + 2 call sites)
- `grep -c "setAiTokenRecorder" lib/integrations-openai-ai-server/src/index.ts` = 1
- `pnpm --filter @workspace/integrations-openai-ai-server run test` reports 9 passing

---

## Task 2: Add prom-client dependency

**Files:**
- Modify: `artifacts/api-server/package.json`

### Step 1: Add the dep

Edit `artifacts/api-server/package.json`. In `dependencies`, add (alphabetically):

```json
"prom-client": "^15.1.3"
```

### Step 2: Install

```bash
pnpm install
```

Expected: prom-client added. ~50KB transitively.

### Step 3: Verify

```bash
grep "prom-client" artifacts/api-server/package.json
ls node_modules/.pnpm/prom-client@*/node_modules/prom-client/package.json
```

Both should match.

### Step 4: Typecheck

```bash
pnpm run typecheck
```
Every workspace `Done`.

### Step 5: Commit

```bash
git add artifacts/api-server/package.json pnpm-lock.yaml
git commit -m "chore(deps): add prom-client to api-server"
```

If `git status` shows stray modifications, do NOT include them.

---

## Task 3: Metrics module + middleware + /api/metrics route

**Files:**
- Create: `artifacts/api-server/src/lib/metrics.ts`
- Create: `artifacts/api-server/src/middlewares/metrics.ts`
- Create: `artifacts/api-server/src/routes/metrics.ts`

### Step 1: Create the metrics module

Create `artifacts/api-server/src/lib/metrics.ts` with EXACTLY this content:

```ts
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

/**
 * Single Registry holds all metrics. Tests can reset state with
 * `registry.resetMetrics()` (does not affect default Node metrics).
 */
export const registry = new Registry();

// Default Node.js process metrics (CPU, memory, event-loop lag, GC, handles).
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests, labeled by method, route, status",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const aiTokensTotal = new Counter({
  name: "ai_tokens_total",
  help: "Total AI tokens consumed, labeled by model, route, outcome",
  labelNames: ["model", "route", "outcome"] as const,
  registers: [registry],
});
```

### Step 2: Create the HTTP middleware

Create `artifacts/api-server/src/middlewares/metrics.ts`:

```ts
import type { Request, Response, NextFunction } from "express";
import { httpRequestsTotal, httpRequestDurationSeconds } from "../lib/metrics";

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    // Express populates req.route only AFTER a route handler matches.
    // Fall back to "unmatched" to keep label cardinality bounded.
    const routePath = (req.route?.path as string | undefined) ?? "unmatched";
    // The api router is mounted at /api, so prefix to make full path explicit.
    const route = routePath === "unmatched" ? "unmatched" : `/api${routePath}`;
    const method = req.method;
    const status = String(res.statusCode);

    httpRequestsTotal.inc({ method, route, status });

    const durationNs = Number(process.hrtime.bigint() - start);
    httpRequestDurationSeconds.observe({ method, route }, durationNs / 1e9);
  });

  next();
}
```

### Step 3: Create the metrics route

Create `artifacts/api-server/src/routes/metrics.ts`:

```ts
import { Router, type IRouter } from "express";
import { registry } from "../lib/metrics";

const router: IRouter = Router();

router.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

export default router;
```

### Step 4: Mount the route in routes/index.ts

Edit `artifacts/api-server/src/routes/index.ts`. Current content:

```ts
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analysesRouter from "./analyses";
import jobSearchRouter from "./job-search";
import savedJobsRouter from "./saved-jobs";
import searchAlertsRouter from "./search-alerts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(jobSearchRouter);
router.use(savedJobsRouter);
router.use(searchAlertsRouter);
router.use(analysesRouter);

export default router;
```

Add the metrics router. Final:

```ts
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analysesRouter from "./analyses";
import jobSearchRouter from "./job-search";
import savedJobsRouter from "./saved-jobs";
import searchAlertsRouter from "./search-alerts";
import metricsRouter from "./metrics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(metricsRouter);
router.use(jobSearchRouter);
router.use(savedJobsRouter);
router.use(searchAlertsRouter);
router.use(analysesRouter);

export default router;
```

### Step 5: Mount the middleware in app.ts

Edit `artifacts/api-server/src/app.ts`. After `app.use(express.urlencoded({ extended: true }))` (around line 34) and BEFORE `app.use("/api", router)`, insert:

```ts
app.use("/api", metricsMiddleware);
```

Wait — that mounts the middleware ONLY for `/api/*` paths AND positions it before the router. Add the import at the top:

```ts
import { metricsMiddleware } from "./middlewares/metrics";
```

Final structure of `app.ts`:

```ts
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { metricsMiddleware } from "./middlewares/metrics";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    allowedHeaders: ["Content-Type", "Authorization", "X-DeepSeek-Api-Key"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Observe all /api/* requests for metrics.
app.use("/api", metricsMiddleware);

app.use("/api", router);

export default app;
```

### Step 6: Typecheck

```bash
pnpm run typecheck
```
Every workspace `Done`.

Common issues:
- `req.route` may not be on the Express `Request` type. It is, but if TS complains, the cast in `metricsMiddleware` already handles it: `(req.route?.path as string | undefined)`.

### Step 7: Smoke test

Start the api-server in the background:

```bash
pnpm --filter @workspace/api-server run dev &
sleep 4
curl -s http://localhost:8080/api/healthz
curl -s http://localhost:8080/api/metrics | head -20
kill %1
```

The healthz call increments the counter. The metrics call returns prom text format. You should see:
- `process_*` metrics (default Node)
- `nodejs_*` metrics (default Node)
- `http_requests_total{method="GET",route="/api/healthz",status="200"} 1`

If the api-server doesn't start because of a missing env var (e.g. PORT defaults to 8080), check `index.ts` and adjust the curl URL.

If the metrics endpoint returns empty, check:
- Was the middleware mounted before the router?
- Did the healthz request actually hit a matched route?

### Step 8: Commit

```bash
git add artifacts/api-server/src/lib/metrics.ts \
        artifacts/api-server/src/middlewares/metrics.ts \
        artifacts/api-server/src/routes/metrics.ts \
        artifacts/api-server/src/routes/index.ts \
        artifacts/api-server/src/app.ts
git commit -m "feat(api-server): metrics module, middleware, /api/metrics route"
```

If `git status` shows stray modifications, do NOT include them.

### Self-review

- `curl http://localhost:8080/api/metrics` returns prom text (see Step 7)
- `grep -c "registry\\|registers: \\[registry\\]" artifacts/api-server/src/lib/metrics.ts` ≥ 4 (registry + 3 metrics)

---

## Task 4: Request-ID middleware + metrics tests

**Files:**
- Create: `artifacts/api-server/src/middlewares/request-id.ts`
- Create: `artifacts/api-server/src/lib/metrics.test.ts`
- Modify: `artifacts/api-server/src/app.ts` (mount request-id middleware first)

### Step 1: Create the request-id middleware

Create `artifacts/api-server/src/middlewares/request-id.ts`:

```ts
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

const HEADER = "x-request-id";
const MAX_LENGTH = 200;

/**
 * Read X-Request-Id from the incoming request; if absent or unreasonable
 * (empty / too long), generate a UUID. Always echo in the response header.
 *
 * Mount this BEFORE pino-http so the pino-http genReqId picks up the
 * already-set req.id.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[HEADER];
  const candidate =
    typeof incoming === "string" && incoming.length > 0 && incoming.length <= MAX_LENGTH
      ? incoming
      : null;
  const id = candidate ?? randomUUID();

  (req as Request & { id: string }).id = id;
  res.setHeader("X-Request-Id", id);

  next();
}
```

### Step 2: Mount it in app.ts BEFORE pino-http

Edit `artifacts/api-server/src/app.ts`. The current order is:

```ts
app.use(pinoHttp({...}));
app.use(cors({...}));
app.use(express.json());
app.use(express.urlencoded({...}));
app.use("/api", metricsMiddleware);
app.use("/api", router);
```

Add the request-id middleware as the FIRST `app.use(...)`. New order:

```ts
import { requestIdMiddleware } from "./middlewares/request-id";

// ... existing imports ...

app.use(requestIdMiddleware);
app.use(pinoHttp({...}));
app.use(cors({...}));
app.use(express.json());
app.use(express.urlencoded({...}));
app.use("/api", metricsMiddleware);
app.use("/api", router);
```

### Step 3: Create the metrics tests

Create `artifacts/api-server/src/lib/metrics.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import {
  registry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from "./metrics";

describe("metrics", () => {
  beforeEach(() => {
    // Reset custom metric values between tests (does NOT reset default Node metrics).
    httpRequestsTotal.reset();
    httpRequestDurationSeconds.reset();
  });

  it("increments http_requests_total on a matched request", async () => {
    await request(app).get("/api/healthz").expect(200);
    const metric = await httpRequestsTotal.get();
    const matched = metric.values.find(
      (v) => v.labels.method === "GET" && v.labels.route === "/api/healthz" && v.labels.status === "200",
    );
    expect(matched).toBeDefined();
    expect(matched?.value).toBe(1);
  });

  it("observes http_request_duration_seconds on a matched request", async () => {
    await request(app).get("/api/healthz").expect(200);
    const metric = await httpRequestDurationSeconds.get();
    const matched = metric.values.find(
      (v) => v.metricName === "http_request_duration_seconds_count" &&
        v.labels.method === "GET" &&
        v.labels.route === "/api/healthz",
    );
    expect(matched).toBeDefined();
    expect(matched?.value).toBeGreaterThanOrEqual(1);
  });

  it("returns Prometheus text format at GET /api/metrics", async () => {
    await request(app).get("/api/healthz"); // populate some data first
    const response = await request(app).get("/api/metrics");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("# HELP http_requests_total");
    expect(response.text).toContain("# TYPE http_requests_total counter");
    expect(response.text).toContain("# HELP ai_tokens_total");
    // Default Node metric also present.
    expect(response.text).toContain("process_cpu_seconds_total");
  });
});
```

### Step 4: Run all tests

```bash
pnpm run test
```

Expected: 26 tests passing (21 existing + 2 from Task 1 + 3 from this task).

Possible issues:
- The api-server test setup file (`src/test/setup.ts`) calls `beforeAll` to apply DB schema. The new tests trigger api routes that import `@workspace/db` indirectly. Should still work since the setup file is loaded by Vitest before any test module.
- `httpRequestsTotal.reset()` resets a single counter; default Node metrics persist. That's fine — the tests only assert on http_* and the metrics endpoint content.
- The histogram test checks the `*_count` family of values. If `prom-client` exposes the bucket counts differently (`_bucket`, `_sum`, `_count`), adjust the predicate.

### Step 5: Typecheck

```bash
pnpm run typecheck
```
Every workspace `Done`.

### Step 6: Commit

```bash
git add artifacts/api-server/src/middlewares/request-id.ts \
        artifacts/api-server/src/lib/metrics.test.ts \
        artifacts/api-server/src/app.ts
git commit -m "feat(api-server): X-Request-Id middleware and metrics tests"
```

If `git status` shows stray modifications, do NOT include them.

### Self-review

- `grep -c "X-Request-Id\\|x-request-id" artifacts/api-server/src/middlewares/request-id.ts` ≥ 2
- `grep -c "requestIdMiddleware" artifacts/api-server/src/app.ts` ≥ 2 (import + use)
- `pnpm run test` reports 26 passing
- `git diff --stat HEAD~1 HEAD` shows 3 files

---

## Task 5: Pass route to AI calls + register token recorder

**Files:**
- Modify: `artifacts/api-server/src/routes/analyses.ts`
- Modify: `artifacts/api-server/src/index.ts`

### Step 1: Pass `route` to 6 AI call sites

Edit `artifacts/api-server/src/routes/analyses.ts`. Find each `runAiCompletion(...)` call and add the third opts argument with `route`.

Current call sites (from grep):

```
Line 199:   const completion = await runAiCompletion(getAiFromRequest(req), { ... });
Line 361:   const completion = await runAiCompletion(ai, { ... });
Line 860:   const completion = await runAiCompletion(getAiFromRequest(req), { ... });
Line 928:   const completion = await runAiCompletion(getAiFromRequest(req), { ... });
Line 979:   const completion = await runAiCompletion(getAiFromRequest(req), { ... });
Line 1047:  const completion = await runAiCompletion(getAiFromRequest(req), { ... });
```

The line-199 call lives in helper `validateAndCorrectLatexForPdf(req, inputLatex, context)`. We need to thread the route through. Update the helper signature to accept a `route` parameter:

Find the function signature (around line 180):

```ts
async function validateAndCorrectLatexForPdf(
  req: Request,
  inputLatex: string,
  context: { jobTitle: string; companyName: string | null },
) {
```

Change to:

```ts
async function validateAndCorrectLatexForPdf(
  req: Request,
  inputLatex: string,
  context: { jobTitle: string; companyName: string | null },
  route: string,
) {
```

Find every call site of `validateAndCorrectLatexForPdf` (grep `grep -n "validateAndCorrectLatexForPdf" artifacts/api-server/src/routes/analyses.ts`). For each call, add the route string. The grep showed one call site around the `/analyses/:id/resume.pdf` route handler:

```ts
const correctedLatex = await validateAndCorrectLatexForPdf(req, latex, {
  jobTitle: analysis.jobTitle,
  companyName: analysis.companyName,
});
```

Change to:

```ts
const correctedLatex = await validateAndCorrectLatexForPdf(req, latex, {
  jobTitle: analysis.jobTitle,
  companyName: analysis.companyName,
}, "/analyses/:id/resume.pdf");
```

Then in `validateAndCorrectLatexForPdf`'s body, update the `runAiCompletion` call (line 199):

```ts
const completion = await runAiCompletion(getAiFromRequest(req), {
  model: "deepseek-chat",
  max_completion_tokens: 8192,
  messages: [{ role: "user", content: prompt }],
}, { route });
```

For the remaining 5 sites, each is inside a route handler. Add the third argument with the route pattern:

| Line | Route pattern |
|---|---|
| 361 | `/analyses` |
| 860 | `/fetch-job` |
| 928 | `/analyses/:id/cover-letter` |
| 979 | `/analyses/:id/linkedin-post` |
| 1047 | `/analyses/:id/rewrite-bullet` |

For each, the pattern is:

**Before:**
```ts
const completion = await runAiCompletion(getAiFromRequest(req), {
  model: "deepseek-chat",
  max_completion_tokens: 8192,
  messages: [{ role: "user", content: prompt }],
});
```

**After:**
```ts
const completion = await runAiCompletion(getAiFromRequest(req), {
  model: "deepseek-chat",
  max_completion_tokens: 8192,
  messages: [{ role: "user", content: prompt }],
}, { route: "/analyses/:id/cover-letter" });  // <-- use the right route per site
```

For the line-361 site (uses `ai` accessor instead of `getAiFromRequest(req)`):

```ts
const completion = await runAiCompletion(ai, {
  model: "deepseek-chat",
  max_completion_tokens: 8192,
  messages: [{ role: "user", content: prompt }],
}, { route: "/analyses" });
```

### Step 2: Register the AI token recorder in index.ts

Edit `artifacts/api-server/src/index.ts`. Current content:

```ts
import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { seedSampleAnalysisIfEmpty } from "./lib/seed-sample-analysis";

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedSampleAnalysisIfEmpty();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
```

Add the recorder registration after the imports and before `app.listen`. Final:

```ts
import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { seedSampleAnalysisIfEmpty } from "./lib/seed-sample-analysis";
import { setAiTokenRecorder } from "@workspace/integrations-openai-ai-server";
import { aiTokensTotal } from "./lib/metrics";

setAiTokenRecorder(({ model, route, outcome, tokens }) => {
  aiTokensTotal.inc({ model, route, outcome }, tokens);
});

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedSampleAnalysisIfEmpty();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
```

### Step 3: Verify all 6 call sites have route

```bash
grep -c "runAiCompletion" artifacts/api-server/src/routes/analyses.ts
```
Expected: 6.

```bash
grep -c "route:" artifacts/api-server/src/routes/analyses.ts
```
Expected: at least 6 (one per AI call; route appears in the third arg).

### Step 4: Typecheck

```bash
pnpm run typecheck
```
Every workspace `Done`.

### Step 5: Run all tests

```bash
pnpm run test
```

Expected: 26 passing. None of the tests run AI routes (we don't have AI API keys in CI), so adding `route` to call sites doesn't break anything.

### Step 6: Commit

```bash
git add artifacts/api-server/src/routes/analyses.ts artifacts/api-server/src/index.ts
git commit -m "refactor(api-server): pass route to AI calls and register token recorder"
```

If `git status` shows stray modifications, do NOT include them.

### Self-review

- `grep -c "runAiCompletion" artifacts/api-server/src/routes/analyses.ts` = 6
- `grep -c "{ route:" artifacts/api-server/src/routes/analyses.ts` = 6
- `grep -c "setAiTokenRecorder" artifacts/api-server/src/index.ts` = 2 (import + invocation)
- Tests still pass: 26 total

---

## Task 6: Final verification + push + open PR

**Files:** (verification only)

### Step 1: Full validation chain

```bash
pnpm run typecheck && pnpm run test && pnpm run build
```

All three must pass.

### Step 2: Sanity grep

```bash
# All 6 AI calls now carry a route
grep -cE "runAiCompletion\\(.+\\{" artifacts/api-server/src/routes/analyses.ts
# Expected: 6 (every call opens with a `{`)

# Metrics file structure
grep -lE "registry|httpRequestsTotal|aiTokensTotal" artifacts/api-server/src/lib/metrics.ts
# Expected: present

# Request-ID middleware mounted first
grep -nE "requestIdMiddleware|pinoHttp" artifacts/api-server/src/app.ts | head -10
# Expected: requestIdMiddleware line comes BEFORE pinoHttp
```

### Step 3: End-to-end smoke (optional but useful)

```bash
pnpm --filter @workspace/api-server run dev &
sleep 4

# Hit the API a few times to populate metrics
curl -s http://localhost:8080/api/healthz
curl -s http://localhost:8080/api/healthz
curl -s http://localhost:8080/api/healthz

# Confirm /api/metrics
curl -s http://localhost:8080/api/metrics | grep -E "http_requests_total|ai_tokens_total|nodejs_eventloop"

# Confirm X-Request-Id echoes
curl -s -i http://localhost:8080/api/healthz | grep -i "x-request-id"

# Confirm provided X-Request-Id is honored
curl -s -i -H "X-Request-Id: my-test-id-123" http://localhost:8080/api/healthz | grep -i "x-request-id"
# Should echo "my-test-id-123"

kill %1
```

### Step 4: Push and open PR

```bash
git push -u origin feat/observability
gh pr create --base main --head feat/observability \
  --title "feat: observability — /api/metrics, AI token counter, X-Request-Id" \
  --body "$(cat <<'PRBODY'
## Summary

Phase 3 item 11 from the improvements list. Adds production-ready observability:

- **`GET /api/metrics`** Prometheus endpoint via prom-client (default Node metrics + custom HTTP and AI counters/histograms)
- **`ai_tokens_total{model, route, outcome}`** counter wired into `runAiCompletion` via a recorder callback
- **`X-Request-Id`** middleware: accepts client header or generates a UUID, echoes in response, threads through pino logs

**Spec:** `docs/superpowers/specs/2026-07-01-observability-design.md`
**Plan:** `docs/superpowers/plans/2026-07-01-observability.md`

## What's new

| Metric | Type | Labels |
|---|---|---|
| `http_requests_total` | counter | method, route, status |
| `http_request_duration_seconds` | histogram | method, route |
| `ai_tokens_total` | counter | model, route, outcome |
| `process_*`, `nodejs_*` | various | (default Node metrics) |

## Architecture

- `lib/integrations-openai-ai-server` exposes a `setAiTokenRecorder(fn)` hook. The api-server registers the recorder once at startup; the leaf library never depends on api-server.
- `routes/analyses.ts` passes a stable `route` pattern to every `runAiCompletion` call to keep label cardinality bounded.

## Tests (5 new, 26 total)

- 2 tests for the token recorder hook (success + error outcomes)
- 3 tests for `/api/metrics` (counter increment, histogram observation, response format)

## Test plan

- [x] `pnpm run typecheck` clean
- [x] `pnpm run test` reports 26/26 passing
- [x] `pnpm run build` succeeds
- [x] Manual smoke: `curl /api/metrics` returns Prometheus text format
- [x] Manual smoke: `X-Request-Id` echoes provided value
- [ ] CI gates pass on this PR

## What's NOT in this PR

- Auth / IP allowlist for `/api/metrics` (deployment-time concern)
- OpenTelemetry tracing
- Frontend RUM
- AI cost-in-USD conversion (rates change; compute in Grafana)
- Drizzle migrations (item 12, separate PR)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

### Step 5: Done

No further commit. 5 commits + 1 PR.

---

## Done

Repo has `/api/metrics`, AI token tracking, and request-ID correlation. Next remaining: item 12 (Drizzle migrations).
