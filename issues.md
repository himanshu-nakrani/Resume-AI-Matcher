# Code Review Issues

Repository: `/Users/himanshu/Git/Resume-AI-Matcher`
Review date: 2026-05-23
Scope: TypeScript/React frontend, Express API server, shared API/client libraries. Ignored generated build output, node_modules, and git internals except where generated source is imported by the app.

## Summary

Found 6 high-confidence issues:

- 4 High severity
- 2 Medium severity

Also verified that the current typecheck fails:

```text
pnpm run typecheck
# fails with TS2308 duplicate export errors in lib/api-zod/src/index.ts
```

---

## 1. High — Typecheck/build is broken by ambiguous barrel re-exports

Evidence:

- `lib/api-zod/src/index.ts:1` exports everything from `./generated/api`.
- `lib/api-zod/src/index.ts:2` exports everything from `./generated/types`.
- `pnpm run typecheck` fails with TS2308 duplicate exports for:
  - `CreateAnalysisBody`
  - `GenerateCoverLetterBody`
  - `MarkNotificationReadParams`
  - `PredictOfferResponse`
  - `RewriteBulletBody`
  - `RewriteBulletResponse`
  - `UpdateAnalysisBody`

Impact:

The monorepo cannot pass TypeScript checks, which blocks CI/builds and makes generated API exports unreliable for consumers.

Suggested fix:

Replace wildcard re-exports with explicit named exports, or namespace one side. For example:

```ts
export * as ApiSchemas from "./generated/api";
export * as ApiTypes from "./generated/types";
```

Alternatively, update the code generator or barrel file so duplicate names are exported from only one generated module.

---

## 2. High — Browser-supplied DeepSeek API keys are accepted and used by the server

Evidence:

- `artifacts/api-server/src/app.ts:29-31` enables CORS and explicitly allows `X-DeepSeek-Api-Key`.
- `artifacts/api-server/src/lib/ai-from-request.ts:5-7` reads `req.get("x-deepseek-api-key")` and creates the AI client from it.
- `artifacts/api-server/src/lib/ai-from-request.ts:11-14` also resolves the API key from request body/header for create flows.
- `lib/api-client-react/src/custom-fetch.ts` contains client plumbing that attaches `X-DeepSeek-Api-Key` to API requests when configured.

Impact:

User/provider secrets traverse browser JavaScript, frontend storage, HTTP requests, server infrastructure, logs/proxies, and any browser extensions running in the origin. Combined with permissive CORS defaults, any origin can attempt to call the API with this custom header. This increases key leakage risk and makes abuse/rate limiting/accountability difficult.

Suggested fix:

Do not accept third-party AI provider keys from browsers. Prefer:

- server-side credentials stored in environment variables or a secret manager,
- authenticated backend endpoints that proxy AI usage,
- strict origin allowlisting if cross-origin access is required,
- user-owned keys stored encrypted server-side only after authentication.

Remove `X-DeepSeek-Api-Key` from public CORS/client plumbing unless there is a deliberate, documented threat model for it.

---

## 3. High — DeepSeek API key is persisted in browser localStorage

Evidence:

- `artifacts/resume-matcher/src/pages/user.tsx:32` initializes the API key from `localStorage`.
- `artifacts/resume-matcher/src/pages/user.tsx:37` writes the API key to `localStorage`.
- `artifacts/resume-matcher/src/pages/user.tsx:112-114` tells users the key is stored in the browser and sent to the API.

Impact:

`localStorage` is readable by any injected script/XSS, compromised frontend dependency, or sufficiently privileged browser extension running on the origin. A stolen DeepSeek API key can incur cost and expose user data sent to the provider.

Suggested fix:

Avoid storing provider keys in `localStorage`. Prefer one of these approaches:

- server-side encrypted storage tied to authenticated users,
- session-only in-memory key entry with clear user warnings,
- backend-owned provider credentials with per-user authorization/rate limits.

If client-side storage is temporarily retained, add a strict CSP, dependency hardening, clear warnings, and a key deletion/rotation flow.

---

## 4. High — Server-side fetch of user-provided URLs enables SSRF/internal network access

Evidence:

- `artifacts/api-server/src/routes/job-search.ts:49` reads `jobUrl` from the request body.
- `artifacts/api-server/src/routes/job-search.ts:63-69` passes `jobUrl` directly to server-side `fetch`.
- `artifacts/api-server/src/routes/analyses.ts:880-890` reads `url` from the request body and directly fetches it.
- `lib/api-zod/src/generated/api.ts` validates the fetch-job body as a string URL field, but the reviewed flow does not show host/IP/scheme restrictions before fetch.

Impact:

An attacker can make the backend request internal services or metadata endpoints, such as localhost admin panels, RFC1918/private IPs, link-local services, cloud metadata IPs, or redirected internal hosts. This can leak internal data or abuse the backend network position.

Suggested fix:

Before every server-side fetch of user-provided URLs:

- require `http:` or `https:` only,
- reject `localhost`, loopback, private, link-local, multicast, and reserved IP ranges,
- resolve DNS and validate the resulting IPs,
- block redirects to disallowed hosts/IPs,
- set tight timeouts and response body size limits,
- consider an allowlist of known job-board domains.

---

## 5. Medium — Job detail modal makes a guaranteed-failing pre-screen call before loading details

Evidence:

- `artifacts/resume-matcher/src/components/job-detail-modal.tsx:34-38` posts `{ jobUrl: hit.url, resumeText: "" }` to `/api/job-search/pre-screen`.
- `artifacts/api-server/src/routes/job-search.ts:50-52` rejects missing/short `resumeText` with HTTP 400 when under 50 characters.
- `artifacts/resume-matcher/src/components/job-detail-modal.tsx:39-43` throws on a non-OK pre-screen response before the browser fetch of `hit.url` runs.

Impact:

Opening job details will usually show “Could not load job details...” instead of fetching/displaying the job description, because the prerequisite API call is intentionally invalid.

Suggested fix:

Separate detail loading from pre-screening:

- remove the pre-screen call from the detail-loading path,
- pass real resume text only when match scoring is actually requested,
- or add a dedicated job-description fetch endpoint that does not require `resumeText`.

---

## 6. Medium — Browser directly fetches third-party job URLs

Evidence:

- `artifacts/resume-matcher/src/components/job-detail-modal.tsx:42` calls `fetch(hit.url, { signal: AbortSignal.timeout(10000) })` from the browser.

Impact:

This will often fail due to CORS, leaks the user’s browser/IP context to third-party job sites merely by opening details, and creates inconsistent behavior compared with the backend URL-import extraction flow.

Suggested fix:

Route job-description fetching through the backend URL-import endpoint after adding SSRF protections from issue 4. Alternatively, do not auto-fetch third-party pages; only open them through explicit user actions such as “Open original”.

---

## Notes

- React’s normal text rendering escapes user-provided strings, and no obvious user-controlled `dangerouslySetInnerHTML` sink was found in the reviewed application paths. The one `dangerouslySetInnerHTML` occurrence in `artifacts/resume-matcher/src/components/ui/chart.tsx` appears to generate CSS from static theme values.
- No automated tests were found in the review path. The main verification run was `pnpm run typecheck`, which currently fails because of issue 1.
