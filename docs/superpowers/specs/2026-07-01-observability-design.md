# Observability

**Date:** 2026-07-01
**Status:** Approved for implementation
**Scope:** Phase 3 item 11 from the "improvements 1-12" list.

## Goal

Add a Prometheus `/api/metrics` endpoint via `prom-client`, instrument HTTP requests + AI token usage, and add a request-ID middleware that correlates client and server logs. Existing pino logging stays; this layer is additive.

## Decisions

| Question | Decision |
|---|---|
| Metrics library | `prom-client` (Node-standard Prometheus client) |
| AI cost tracking | Counter only: `ai_tokens_total{model, route, outcome}` |
| HTTP metrics | `http_requests_total` counter + `http_request_duration_seconds` histogram + prom-client default Node.js metrics |
| Request-ID | Accept `X-Request-Id` header from client; generate UUID if absent; echo in response header; thread through pino |
| Metrics endpoint auth | None in this PR (deployment-time concern; document) |
| OpenTelemetry / tracing | Out of scope |
| Frontend RUM | Out of scope |

## Architecture

Three independent additions, all in `artifacts/api-server`:

1. **Metrics module + middleware + `/api/metrics` route** — standalone HTTP observability via `prom-client`.
2. **Request-ID middleware** — `X-Request-Id` header propagation, mounted before `pinoHttp`.
3. **AI token recorder hook** — a callback in `lib/integrations-openai-ai-server` that the api-server registers at startup. Lets the leaf library notify metrics without taking a dep on api-server.

## Metric definitions

### HTTP

- `http_requests_total{method, route, status}` (counter)
- `http_request_duration_seconds{method, route}` (histogram) — buckets `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]`

`route` is the Express route pattern (e.g. `/api/analyses/:id`), not the literal URL. Unmatched paths get label value `"unmatched"`.

### AI

- `ai_tokens_total{model, route, outcome}` (counter) — increments by `usage.total_tokens` on each `runAiCompletion` resolution
  - `outcome`: `"success"` or `"error"` (coarse — keeps cardinality small; the structured `AiError` codes from PR #20 still surface in logs)
  - `route`: Express pattern passed via the new `RunOptions.route` field

### Default Node.js

`prom-client`'s `collectDefaultMetrics()` adds:
- `nodejs_eventloop_lag_seconds`
- `nodejs_heap_size_total_bytes` / `_used_bytes`
- `process_cpu_seconds_total`
- `process_resident_memory_bytes`
- `nodejs_active_handles_total`
- and others

## Modules

### `lib/integrations-openai-ai-server/src/run-completion.ts` (modify)

Add an optional `route` to `RunOptions`. Add module-level `tokenRecorder` callback + `setAiTokenRecorder(fn)` export + internal `recordAiTokens(event)` helper. Call `recordAiTokens` after successful completion (with `usage.total_tokens`) and inside the catch (with `tokens: 0`, `outcome: "error"`).

The callback is wrapped in a try/catch internally so a faulty metrics path can never crash an AI call.

### `lib/integrations-openai-ai-server/src/index.ts` (modify)

Re-export `setAiTokenRecorder`.

### `artifacts/api-server/src/lib/metrics.ts` (new)

```ts
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
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

### `artifacts/api-server/src/middlewares/metrics-middleware.ts` (new)

Records duration on `res.on("finish")`. Uses `req.route?.path` for the route label, falling back to `"unmatched"`. Prefixes with `/api` since this router is mounted at `/api`.

### `artifacts/api-server/src/middlewares/request-id.ts` (new)

- Reads `X-Request-Id` (case-insensitive via Express's `req.headers`)
- If present and `0 < length <= 200`, uses it; otherwise `randomUUID()` from `node:crypto`
- Assigns to `(req as any).id` and `res.setHeader("X-Request-Id", id)`
- Mounted BEFORE `pinoHttp` so `pino-http`'s `genReqId` picks it up

### `artifacts/api-server/src/routes/metrics.ts` (new)

Single `GET /metrics` handler. Returns `registry.metrics()` with `Content-Type: registry.contentType`.

### `artifacts/api-server/src/app.ts` (modify)

Mount order:
1. `requestIdMiddleware`
2. `pinoHttp(...)` (existing)
3. `cors(...)` (existing)
4. `express.json()`, `express.urlencoded()` (existing)
5. `metricsMiddleware` (new — observes all `/api/*` requests including `/api/metrics` itself)
6. `app.use("/api", router)` (existing)

### `artifacts/api-server/src/routes/index.ts` (modify)

Add `router.use("/", metricsRoute)` or include the `/metrics` handler directly so it's served at `/api/metrics`.

### `artifacts/api-server/src/index.ts` (modify)

Before `app.listen`, register the token recorder:

```ts
import { setAiTokenRecorder } from "@workspace/integrations-openai-ai-server";
import { aiTokensTotal } from "./lib/metrics";

setAiTokenRecorder(({ model, route, outcome, tokens }) => {
  aiTokensTotal.inc({ model, route, outcome }, tokens);
});
```

### `artifacts/api-server/src/routes/analyses.ts` (modify)

Pass `route: "..."` to each of the 6 `runAiCompletion` calls. The route strings are the Express patterns:
- `/analyses/:id/validate-latex` (line ~198 — inside the helper, passed in from the handler)
- `/analyses` (line ~360)
- `/fetch-job` (line ~851)
- `/analyses/:id/cover-letter` (line ~915)
- `/analyses/:id/linkedin-post` (line ~962)
- `/analyses/:id/rewrite-bullet` (line ~1026)

For the validate-latex helper, take a `route` parameter and pass it through.

## Tests (5 new, 26 total)

In `lib/integrations-openai-ai-server/src/run-completion.test.ts` (2 new tests):
- `runAiCompletion` calls registered token recorder with `outcome: "success"` and `tokens` from `usage.total_tokens` on success
- `runAiCompletion` calls registered token recorder with `outcome: "error"` and `tokens: 0` on classified failure

In `artifacts/api-server/src/lib/metrics.test.ts` (3 new tests):
- `httpRequestsTotal` counter increments on a real Express request
- `httpRequestDurationSeconds` observes a non-zero duration
- `GET /api/metrics` returns Prometheus text format with the expected metric names

## Backward compatibility

- `pino-http`'s existing `req.id` continues to work — request-id middleware just provides a stable source for it.
- The `runAiCompletion` signature gains an optional `route` field. Existing callers that don't pass it still work (label defaults to `"unknown"`).
- All existing tests pass without modification.

## Files affected

Net 5 new files, 6 modified.

```
Create: artifacts/api-server/src/lib/metrics.ts
Create: artifacts/api-server/src/lib/metrics.test.ts
Create: artifacts/api-server/src/middlewares/metrics-middleware.ts
Create: artifacts/api-server/src/middlewares/request-id.ts
Create: artifacts/api-server/src/routes/metrics.ts
Modify: artifacts/api-server/src/app.ts
Modify: artifacts/api-server/src/index.ts
Modify: artifacts/api-server/src/routes/index.ts
Modify: artifacts/api-server/src/routes/analyses.ts
Modify: artifacts/api-server/package.json (add prom-client)
Modify: lib/integrations-openai-ai-server/src/run-completion.ts (recorder hook + route opt)
Modify: lib/integrations-openai-ai-server/src/run-completion.test.ts (2 new tests)
Modify: lib/integrations-openai-ai-server/src/index.ts (re-export setAiTokenRecorder)
```

## Commits

5:
1. `feat(ai): token recorder hook in runAiCompletion`
2. `chore(deps): add prom-client to api-server`
3. `feat(api-server): metrics module, middleware, /api/metrics route`
4. `feat(api-server): X-Request-Id middleware`
5. `refactor(api-server): pass route to AI calls and register token recorder`

## Non-goals

- Auth / IP allowlist for `/api/metrics` (deployment concern; documented)
- Prometheus scrape config or Grafana provisioning
- OpenTelemetry tracing
- Frontend RUM
- Per-AI-route latency histogram (deferred; can add as a one-liner follow-up)
- AI cost-in-USD conversion (rates change; compute in Grafana)
- Drizzle migrations (item 12)

## Risks

| Risk | Mitigation |
|---|---|
| `req.route?.path` is `undefined` for 404s / unmatched paths | Fallback to `"unmatched"` keeps cardinality bounded |
| Token recorder callback throws and crashes the AI call | `recordAiTokens` wraps the invocation in try/catch |
| `/api/metrics` exposed without auth | Document as deployment-time concern. Don't expose this URL in user-facing places |
| pino-http auto-`genReqId` overrides our middleware's value | Mount request-ID middleware BEFORE pino-http; pino-http defaults to using `req.id` if already set |
| `prom-client` Node version mismatch | `prom-client@15.x` supports Node ≥18; we're on 22 |
| Default histogram buckets too coarse for AI calls | Acceptable for HTTP-level histogram. Per-AI histogram is a non-goal here |

## What "done" looks like

- `GET /api/metrics` returns valid Prometheus text format
- Every response includes `X-Request-Id` header (echoes client value or generated UUID)
- Every pino log line carries the request ID
- 26 tests pass (21 existing + 5 new)
- `pnpm typecheck`, `pnpm test`, `pnpm build` all green
- `runAiCompletion` signature still backward-compatible (`route` is optional)
