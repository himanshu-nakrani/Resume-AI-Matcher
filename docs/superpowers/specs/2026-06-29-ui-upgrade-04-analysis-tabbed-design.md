# UI Upgrade Sub-project 4: Analysis Page Tabbed Restructure

**Date:** 2026-06-29
**Status:** Approved for implementation
**Parent spec:** [`2026-06-28-ui-upgrade-startup-grade-design.md`](2026-06-28-ui-upgrade-startup-grade-design.md)
**Direction:** Linear / Vercel aesthetic — dark-first, indigo accent, tight density

## Goal

Restructure the single 1431-line `pages/analysis.tsx` into a folder of focused files with a tabbed interface — Overview, Cover Letter, LinkedIn, Pipeline, Notes — sharing a sticky header. Add URL state via `?tab=` so deep links preserve the active tab. No behavioral or API changes.

## Scope

- 1 file deleted: `pages/analysis.tsx`
- 7 files created under `pages/analysis/`
- `App.tsx` unchanged (Wouter resolves `@/pages/analysis` to the new folder's `index.tsx`)
- All data fetching, mutations, downloads, shares, favorites, etc. preserved

## File layout

```
artifacts/resume-matcher/src/pages/analysis/
├── index.tsx               — page shell: data fetch, sticky header, Tabs switcher, error/loading
├── overview-tab.tsx        — scores, strengths/gaps, improvements, ATS keywords, bullet rewriter, interview checklist, optimized LaTeX (when present)
├── cover-letter-tab.tsx    — tone selector, generate, display
├── linkedin-tab.tsx        — generate + display LinkedIn post
├── pipeline-tab.tsx        — JobTrackingSection (deadline, contact, portfolio, tags)
├── notes-tab.tsx           — NotesSection
└── shared.tsx              — small reusable components: BulletRewriter, InterviewChecklist, JobTrackingSection, ShareSection, NotesSection, TONE_OPTIONS, CHECKLIST_ITEMS
```

The Wouter route stays `/analysis/:id`. The existing `import { Analysis } from "@/pages/analysis"` in `App.tsx` resolves to `pages/analysis/index.tsx` automatically. **No App.tsx edit required.**

## Tab content map

| Tab | Slug | Contents |
|---|---|---|
| Overview | `overview` (default) | Optimized LaTeX card (when present) · Fit + ATS score circles · Strengths & Gaps grid · Resume Improvements · ATS Keywords · Bullet Rewriter · Interview Checklist |
| Cover Letter | `cover-letter` | Tone selector + Generate + Tailored Cover Letter display + Variation flow |
| LinkedIn | `linkedin` | Generate + LinkedIn Post display |
| Pipeline | `pipeline` | JobTrackingSection (deadline, contact, follow-up date, portfolio links, tags, version label, location, salary expectation) |
| Notes | `notes` | NotesSection (auto-saving notes) |

The sticky **header** always shows (across every tab): back link, title, company, time-ago, tracking chips (deadline, follow-up, sample badge when tags include `"sample"`), and the action row (Favorite, Share, Duplicate, Download PDF, Download LaTeX, Delete).

## Shell (`index.tsx`) responsibilities

- Read `id` from `useParams<{ id: string }>()`.
- Fetch via `useGetAnalysis(id, ...)`.
- Read active tab from `useSearch()` → `URLSearchParams(search).get("tab")` with default `"overview"`.
- Validate tab value against the known list; fall back to `"overview"` if unknown.
- Render loading skeleton (existing pattern).
- Render not-found state (existing pattern).
- Render sticky header (~50 lines).
- Wrap everything in a `<Tabs>` component so `TabsContent` children resolve correctly.

## URL state

- Param shape: `?tab=overview|cover-letter|linkedin|pipeline|notes`
- Default (no param): `"overview"`
- Update on tab click: `setLocation(\`/analysis/${id}?tab=${newTab}\`, { replace: true })` — `replace` prevents history pile-up.
- Browser back/forward navigates between tabs naturally because Wouter triggers a re-render on location change.

## Sticky header layout

```tsx
<Tabs value={activeTab} onValueChange={setTab}>
  <div className="sticky top-12 z-10 bg-background border-b border-border pb-3 mb-6 -mx-6 px-6">
    {/* back link, title, company, time, chips */}
    {/* action row */}
    <TabsList className="mt-4">
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="cover-letter">Cover Letter</TabsTrigger>
      <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
      <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
      <TabsTrigger value="notes">Notes</TabsTrigger>
    </TabsList>
  </div>

  <TabsContent value="overview"><OverviewTab analysis={analysis} id={id} /></TabsContent>
  {/* ... */}
</Tabs>
```

`top-12` aligns with the desktop topbar (48px). On mobile, the topbar is `bg-surface-1` and slightly different — verify the sticky offset still works.

## Per-tab API

Each tab receives:
```ts
interface TabProps {
  analysis: Analysis;  // the type from @workspace/api-client-react
  id: number;
}
```

Tabs that need mutations (`useGenerateCoverLetter`, `useGenerateLinkedinPost`, etc.) instantiate their own hooks. The shell does NOT thread mutations through props.

## `shared.tsx`

Holds small components used across tabs:
- `BulletRewriter` (used in Overview)
- `InterviewChecklist` (used in Overview)
- `JobTrackingSection` (used in Pipeline) — moved verbatim from current `analysis.tsx`
- `ShareSection` (used in sticky header in `index.tsx`)
- `NotesSection` (used in Notes tab)
- Constants: `TONE_OPTIONS`, `CHECKLIST_ITEMS`

If a section grows in `shared.tsx` past ~250 lines, its own file is fine — `shared.tsx` is just a starting point, not a hard contract.

## What's preserved verbatim

- All `data-testid` attributes on moved JSX
- All toast messages, button labels
- All download logic (`downloadOptimizedPdf`, `downloadTextFile`, `safeFileName`, `filenameFromDisposition`)
- All conditional rendering rules (e.g. Cover Letter regenerate-variation, Optimized LaTeX visibility)

## What changes

- The flat single-file structure becomes a folder
- Tabs replace top-to-bottom scroll of all sections
- Sticky header with action row
- URL `?tab=` deep-links work
- `Tabs` primitive (Linear underline) replaces the visual flow

## Non-goals

- New analysis features
- API/mutation/data-fetching changes
- Mobile-specific tab redesign (Radix Tabs handles overflow on `TabsList` via horizontal scroll if needed)
- Replacing the existing inner components (`BulletRewriter`, `InterviewChecklist`, etc.) — they move with current logic intact

## Risks

| Risk | Mitigation |
|---|---|
| `useSearch()` from wouter may behave differently than expected | Sanity-check import resolves at edit time; if missing, fall back to `window.location.search` + `popstate` listener |
| Sticky header `top-12` conflicts with mobile topbar (different bg/height) | Test mobile width during smoke test; adjust if collision |
| Tab switch loses scroll position in the previously open tab | Acceptable — each tab is its own scroll region |
| Existing tests (`data-testid="analysis-${id}"`, `data-testid="strength-${i}"`, etc.) break | Preserve every `data-testid` in moved JSX |
| Overview tab grows large after consolidating multiple sections | Extract Strengths/Gaps/Improvements/Keywords into a sub-component inside overview-tab.tsx if it exceeds 600 lines |
| Hooks instantiated per-tab (e.g. `useGenerateCoverLetter`) re-mount when tab changes | Acceptable — they're mutations, not subscriptions. Reset of in-flight state on tab switch is correct UX |
| `Tabs` wrapper must surround both TabsList and TabsContent | Structured exactly as shown in shell layout above |

## What "done" looks like

- `pages/analysis/` folder exists with 7 files (1 shell + 5 tabs + shared)
- `pages/analysis.tsx` is deleted
- `App.tsx` unchanged
- Visiting `/analysis/:id` defaults to Overview tab
- Clicking a different tab updates the URL `?tab=...`
- Browser back/forward toggles tabs
- Sticky header stays visible while scrolling within any tab
- All existing mutations, downloads, share, favorite, duplicate, delete still work
- All `data-testid` attributes preserved
- No file exceeds 700 lines
- `pnpm run typecheck` clean
