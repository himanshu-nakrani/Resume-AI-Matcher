# UI Upgrade Sub-project 3a: Home + History + Compare Polish

**Date:** 2026-06-28
**Status:** Approved for implementation
**Parent spec:** [`2026-06-28-ui-upgrade-startup-grade-design.md`](2026-06-28-ui-upgrade-startup-grade-design.md)
**Direction:** Linear / Vercel aesthetic — dark-first, indigo accent, tight density

## Goal

Hand-polish three Tier-2 pages (Home, History, Compare) to apply the new design tokens and primitives. APIs and data flow stay; layout and chrome are reorganized for the new aesthetic.

## Scope

3 page files. ~2,000 lines touched. Total: 3 commits, 1 PR.

| Page | Current lines | Treatment |
|---|---|---|
| `pages/home.tsx` | 1006 | Restructure: 2-col layout, recent strip, collapsible job search |
| `pages/history.tsx` | 629 | Table-first redesign with mobile card fallback, bulk-select |
| `pages/compare.tsx` | 352 | Two-pane polish, keyword diff highlighting, score deltas |

Sub-project 3b will follow with Stats + Board + Brand.

---

## Home

### Current structure
Single vertical column. Sections in order: UserInformation card → ResumeInput card → TargetJob card → JobDescription card → JobSearch panel (always open) → Analyze button.

### New structure

```
┌────────────────────────────────────────────────────────────┐
│  H1: Optimize your resume                                  │
│  Subtitle: Paste your resume and a job to see your fit…    │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ User information     │  │ Target job           │        │
│  │ Resume input         │  │ Job description      │        │
│  │ (paste / file / URL) │  │ (paste / URL fetch)  │        │
│  └──────────────────────┘  └──────────────────────┘        │
│  ┌──────────────────────────────────────────────┐          │
│  │            [ Analyze ] (primary CTA)         │          │
│  └──────────────────────────────────────────────┘          │
├────────────────────────────────────────────────────────────┤
│  Recent analyses (horizontal scroll, 5 most recent)        │
│  ▸ Card · Card · Card · Card · Card                        │
├────────────────────────────────────────────────────────────┤
│  ▸ Find similar roles (collapsed by default)               │
│    (expands to existing job-search panel)                  │
└────────────────────────────────────────────────────────────┘
```

### Decisions

- **Two-column layout**: `md:grid-cols-2 gap-6`. Stacks below `md` (768px).
- **Recent analyses strip**: horizontal `flex overflow-x-auto gap-3`. Each card: ScoreCircle `size="sm"` + truncated title + company. Hidden when `analyses?.length === 0`. Limit to 5.
- **Job search collapsible**: native `<details>` with `<summary>` styled as a clickable strip. `open` is controlled state, defaults to `false`. Clicking summary toggles. Existing job-search panel UI mounts inside as-is.
- **Mobile primary CTA**: Below `md`, the Analyze button gets `fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface-1 p-4` so it's always reachable. Above `md`, it's in flow at the bottom of the form area.
- **Page header**: `H1` is `text-2xl` (24px) with `tracking-[-0.02em]`. Subtitle is `text-[13px] text-muted-foreground`.

### Component splits (optional)

If after the layout rewrite `home.tsx` exceeds 700 lines, extract these inner components to `pages/home/sections.tsx`:
- `UserInformationSection`
- `TargetJobSection`
- `RecentAnalysesStrip`
- `JobSearchSection`

If the file stays under 700 lines, leave it monolithic. Don't split for the sake of splitting.

### What stays unchanged

- All form logic (`useForm`, `zodResolver`, all mutation handlers).
- File upload handling, PDF parsing, LaTeX detection.
- The job-search panel's internals (only the wrapper is collapsible).
- `useCreateAnalysis` → navigation flow.
- `JobDetailModal` integration.

---

## History

### Current structure
Header → search input → status filter pill row → favorites toggle → saved-searches dropdown → CSV export button → vertical Card list of analyses → empty state.

### New structure

```
┌──────────────────────────────────────────────────────────────────┐
│  H1: Analyses · [Badge: 12 total]    [Saved searches ▾] [Export] │
├──────────────────────────────────────────────────────────────────┤
│  [ Search…                      ]  [● applied] [● interview] …  │
│                                              [☆ Favorites only]  │
├──────────────────────────────────────────────────────────────────┤
│  [☐] Title         Company       Fit  ATS  Status     Created  ⋯│
│  [☐] Senior FE     Stripe        87   78   Applied    2d ago   ⋯│
│  [☐] Backend Eng   Linear        92   85   Interview  5d ago   ⋯│
│  …                                                               │
└──────────────────────────────────────────────────────────────────┘

When 1+ row selected, sticky bar slides in at top:
┌──────────────────────────────────────────────────────────────────┐
│  N selected   [Delete N]   [Export N as CSV]   [Clear]           │
└──────────────────────────────────────────────────────────────────┘
```

### Decisions

- **Page header**: `H1 "Analyses"` + total count Badge (`<Badge variant="default" size="sm">{count} total</Badge>`). Right side: `<Button variant="ghost">Saved searches</Button>` (with dropdown) and `<Button variant="secondary">Export CSV</Button>`.
- **Filter bar**: single `<Card padding="sm">` containing inline filter row:
  - Search Input (`flex-1 min-w-0`)
  - Status filter pill row using new Badge soft variants (click toggles)
  - Favorites toggle (using existing FavoriteButton pattern; or new Toggle component if available)
- **Table view (desktop, ≥768px)**:
  - Native `<table>` with `<thead>` + `<tbody>`.
  - Header row: 32px tall, 11px uppercase muted labels (`text-[11px] uppercase tracking-wider text-subtle-foreground`).
  - Body row: 40px tall, hover `bg-surface-2`, click navigates to `/analysis/${id}`.
  - Columns: `Checkbox · Title · Company · Fit · ATS · Status · Created · Actions` (8 cols).
  - Score columns: just the colored number with mono+tabular-nums; the ring circle would be too large for table density.
  - Status column: `<Badge>` with semantic soft variant (success for offer, warning for interview, etc.).
  - Created column: `formatDistanceToNow(createdAt, { addSuffix: true })`.
  - Actions: 3-dot dropdown menu (`<DropdownMenu>` from shadcn) with Edit/Duplicate/Delete.
- **Card view (mobile, <768px)**:
  - Stacked Cards. Each card has the same fields in a vertical layout.
  - Checkbox in top-left of each card.
- **Bulk-select state**:
  - `Set<number>` of selected ids in state.
  - When `selectedIds.size > 0`, render a sticky action bar at top of viewport.
  - Auto-clear on filter change (when `filtered` results differ from prior list).
- **Tablet (768-1024px)**: hide the Created column (least important) to prevent cramping. Show as `title=""` hover text on the row.
- **Empty state**:
  - If no analyses ever exist: render `<Empty>` with "No analyses yet" + CTA "Create one" → `/`.
  - If no analyses match current filters: render `<Empty>` with "No matches" + "Clear filters" CTA.

### What stays unchanged

- All mutation handlers (delete, update, duplicate).
- CSV export logic — moved to a button in the page header, otherwise identical.
- Saved-searches localStorage logic — moved into the dropdown.
- `StatusPicker`, `FavoriteButton`, `InlineEdit` inner components — reused.

---

## Compare

### Current structure
Title row → two Select dropdowns to pick analyses → two side-by-side AnalysisColumn blocks with ScoreBar chips.

### New structure

```
┌──────────────────────────────────────────────────────────────────┐
│  H1: Compare analyses                                            │
│  Subtitle: Side-by-side diff of two resume analyses              │
├──────────────────────────────────────────────────────────────────┤
│  [Analysis A ▾]              [↔]               [Analysis B ▾]    │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐  ┌────────────────────────┐          │
│  │ Senior FE @ Stripe     │  │ Backend Eng @ Linear   │          │
│  │ Fit 87 ▲+5  ATS 78 ▼-3 │  │ Fit 92      ATS 75     │          │
│  │ ───────────────────    │  │ ───────────────────    │          │
│  │ Strengths …            │  │ Strengths …            │          │
│  │ Gaps …                 │  │ Gaps …                 │          │
│  │ Keywords (with diff)   │  │ Keywords (with diff)   │          │
│  └────────────────────────┘  └────────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

### Decisions

- **Selector bar**: two `<Select>` triggers side by side. Between them, a `<Button variant="ghost" size="icon-sm" aria-label="Swap">` with a swap icon (lucide `ArrowLeftRight`).
- **Sticky pane headers**: each AnalysisColumn's title + score row is `sticky top-0 z-10 bg-background border-b border-border` so they stay visible while scrolling the body.
- **Score delta chips**: next to each score, a small chip like `<Badge variant="success" size="sm">↑ +5</Badge>` (or warning/destructive for negative). Computed from the other column's score; shown only when both columns are populated.
- **Keyword diff** (the main visual polish):
  - Compute three sets: `shared = A ∩ B`, `aOnly = A \ B`, `bOnly = B \ A`.
  - In column A: shared keywords render with `<Badge variant="default">`, aOnly with `<Badge variant="success">` (you have these; B doesn't).
  - In column B: shared keywords render with default, bOnly with `<Badge variant="warning">`.
  - This makes the unique-to-each-column keywords pop visually.
- **Independent scroll, parallel layout**: each column scrolls independently (don't synchronize; cross-browser sticky-table issues). Sections appear in identical order in both columns so visual parallel-scan still works.

### What stays unchanged

- `ScoreBar` inner component for fit/ats visualization.
- `AnalysisColumn` inner component (props change to accept the diff sets).
- URL state (`?a=1&b=2`) for selected IDs.
- Data fetching via `useGetAnalysis`.

---

## Cross-cutting decisions

### Header pattern (used on all 3 pages)

```tsx
<header className="flex items-baseline justify-between gap-3 mb-6">
  <div>
    <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
    {subtitle && <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>}
  </div>
  <div className="flex items-center gap-2">{rightActions}</div>
</header>
```

Either:
- Inline this pattern at the top of each page, OR
- Extract to `components/page-header.tsx` if the second page makes it feel repetitive.

Don't extract on the first usage. Wait until the second usage to decide.

### Routes unchanged

`/` for Home, `/history` for History, `/compare` for Compare. No new routes.

### Sample-row "Sample · click to remove" badge (parent spec callout)

The seed-row in sub-project 1 was tagged with `tags: ["sample", "frontend"]`. In History's row rendering, when an analysis's tags contain `"sample"`, render an extra `<Badge variant="soft" size="sm">Sample</Badge>` next to the title. The badge is non-interactive — it's just an identifier. To remove the sample analysis, the user uses the existing row-actions menu (Delete). This satisfies the parent spec's "first-run experience" sub-bullet without adding bespoke delete UX.

---

## Non-goals

- Stats / Board / Brand rewrites — sub-project 3b.
- Analysis page tabbed restructure — sub-project 4.
- New routes or behavioral changes beyond what's listed.
- Server-side filter persistence (saved-searches stay localStorage-only).
- Cross-pane scroll sync on Compare.

## Risks

| Risk | Mitigation |
|---|---|
| History table cramped on tablets | Hide Created column below 1024px; show as `title` hover text on the row |
| Bulk-select state stale after filter change | Clear `selectedIds` whenever `filtered` length drops significantly |
| Home job-search collapse changes muscle memory | Acceptable; we're a young product, no large user base yet |
| Compare keyword diff confuses with too many badge colors | Use semantic soft tints (success/warning) which align with "your strength" / "their advantage"; stop at 2 colors |
| home.tsx gets too long after rewrite | Optional split into `pages/home/sections.tsx`. Only do it if file exceeds 700 lines |
| Mobile sticky Analyze button overlaps content | Pad bottom of form by `pb-20` on mobile to leave space |

## What "done" looks like

- 3 pages reorganized per the layouts above
- `pnpm typecheck` clean
- Mobile (375px), tablet (768px), desktop (1440px) widths all render without horizontal scroll or broken layout
- Sample analysis renders with the "Sample" badge in History
- Bulk-select bar appears/disappears correctly in History as rows are selected/filtered
- Keyword diff colors render correctly in Compare
- Job-search panel on Home stays collapsed by default
