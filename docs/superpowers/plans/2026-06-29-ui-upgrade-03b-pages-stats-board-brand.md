# UI Upgrade Sub-project 3b: Stats + Board + Brand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish Stats, Board, and Brand pages — tighter headers, token-driven chart colors, KPI tile redesign, Kanban polish, horizontal keyword bars. APIs unchanged.

**Architecture:** Single PR, three commits (one per page). Each rewrite preserves all data fetching, mutations, drag handlers, chart libraries — only the JSX layout and styling change.

**Tech Stack:** React 19, Tailwind 4, shadcn/ui primitives (rebuilt in sub-project 2), Recharts, TanStack Query.

**Parent spec:** `docs/superpowers/specs/2026-06-28-ui-upgrade-startup-grade-design.md`
**Sub-project spec:** `docs/superpowers/specs/2026-06-29-ui-upgrade-03b-pages-stats-board-brand-design.md`

---

## Background

Follows sub-projects 1 (tokens), 2 (primitives), and 3a (Home/History/Compare). Repo is on a clean-typecheck state.

**Branch:** `ui/sub-project-3b-pages` (checked out).

**Typecheck (after every task):**
```bash
pnpm run typecheck
```
Every workspace must end with `Done`.

**Constraints:**
- Stay on `ui/sub-project-3b-pages`.
- Edit only the page files specified.
- No API changes anywhere.
- No new dependencies.
- Conventional commits.

---

## Shared header pattern (used in all 3 tasks)

```tsx
<header className="flex items-baseline justify-between gap-3 mb-6">
  <div>
    <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
    {subtitle && <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>}
  </div>
  <div className="flex items-center gap-2">{/* right actions */}</div>
</header>
```

---

## Task 1: Stats page

**Files:**
- Modify: `artifacts/resume-matcher/src/pages/stats.tsx`

### Step 1: Replace `StatCard` inner component

Find the existing `StatCard` function (around line 36-65). Replace it with this token-driven version:

```tsx
function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  highlight,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card
      padding="sm"
      className={cn(
        "transition-colors",
        highlight && "border-accent/50",
      )}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">{title}</p>
            <p className="font-mono tabular-nums text-[24px] font-semibold mt-1.5 leading-none">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

Add `cn` import from `@/lib/utils` if missing.

### Step 2: Update color constants

Replace `SCORE_BUCKETS` (around line 67):
```tsx
const SCORE_BUCKETS = [
  { label: "0–20", min: 0, max: 20, color: "hsl(var(--destructive))" },
  { label: "21–40", min: 21, max: 40, color: "hsl(var(--destructive))" },
  { label: "41–60", min: 41, max: 60, color: "hsl(var(--warning))" },
  { label: "61–80", min: 61, max: 80, color: "hsl(var(--warning))" },
  { label: "81–100", min: 81, max: 100, color: "hsl(var(--success))" },
];
```

Replace `STATUS_COLORS` (around line 75):
```tsx
const STATUS_COLORS: Record<string, string> = {
  not_applied: "hsl(var(--muted-foreground))",
  applied: "hsl(var(--info))",
  got_interview: "hsl(var(--warning))",
  got_online_exam: "hsl(var(--accent))",
  selected: "hsl(var(--success))",
  rejected: "hsl(var(--destructive))",
};
```

### Step 3: Replace `getFitColor` helper

Find `getFitColor` inside `Stats()` (around line 105) and replace:
```ts
const getFitColor = (score: number) => {
  if (score >= 80) return "hsl(var(--success))";
  if (score >= 60) return "hsl(var(--warning))";
  return "hsl(var(--destructive))";
};
```

### Step 4: Replace the page header

Find the existing header block (around lines 274-288) and replace with:

```tsx
<header className="flex items-baseline justify-between gap-3 mb-6">
  <div>
    <h1 className="text-2xl font-semibold tracking-[-0.02em]">Stats</h1>
    <p className="text-[13px] text-muted-foreground mt-1">Aggregate insights across all your analyses.</p>
  </div>
  <div className="flex items-center gap-2">
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocation("/compare")}
    >
      <GitCompareArrows className="w-3.5 h-3.5 mr-1.5" />
      Compare
    </Button>
  </div>
</header>
```

### Step 5: Replace the empty state

Find the empty-state block (around lines 299-304, the `border-dashed` div). Replace with:

```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <TrendingUp />
    </EmptyMedia>
    <EmptyTitle>No data yet</EmptyTitle>
    <EmptyDescription>
      Run analyses to see aggregate stats here.
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button onClick={() => setLocation("/")}>
      Start a new analysis
    </Button>
  </EmptyContent>
</Empty>
```

Add imports if missing:
```ts
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
```

### Step 6: Update chart theming

Recharts components in this file use hard-coded hex colors and fixed sizes. Sweep through every `<CartesianGrid>`, `<XAxis>`, `<YAxis>`, `<Tooltip>`, `<Bar>`, `<Line>`, `<Pie>`, etc. and apply:

- `<CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />` → replace with `<CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />`
- `<XAxis ... tick={{ fontSize: 10, fill: '#888' }}>` → `<XAxis ... tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}>`
- `<YAxis ...>` same fix
- `<Tooltip contentStyle={{...}}>` → `<Tooltip contentStyle={{ backgroundColor: 'hsl(var(--surface-3))', border: '1px solid hsl(var(--border-strong))', borderRadius: '6px', fontSize: '12px', color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }} />`
- Any literal `stroke="#22c55e"` / `fill="#22c55e"` etc.: replace with `hsl(var(--success))` (etc., matching the score-to-color logic).

Use grep to find them:
```bash
grep -n "#[0-9a-fA-F]\\{3,8\\}" artifacts/resume-matcher/src/pages/stats.tsx
```
Each match needs review.

### Step 7: Reduce skeleton sizes

Find skeletons in the loading state (around line 290). Change `h-28 rounded-xl` → `h-20 rounded-md` and `h-64 rounded-xl` → `h-64 rounded-md`.

### Step 8: Typecheck

```bash
pnpm run typecheck
```

### Step 9: Commit

```bash
git add artifacts/resume-matcher/src/pages/stats.tsx
git commit -m "feat(stats): tighter header, mono KPI tiles, token-driven chart theming"
```

---

## Task 2: Board page

**Files:**
- Modify: `artifacts/resume-matcher/src/pages/board.tsx`

### Step 1: Replace the page header

Find the existing header (around lines 168-196). Replace with:

```tsx
<header className="flex items-baseline justify-between gap-3 mb-6">
  <div>
    <h1 className="text-2xl font-semibold tracking-[-0.02em]">Application tracker</h1>
    <p className="text-[13px] text-muted-foreground mt-1">
      Pipeline of every analysis in flight.
      {activeFilterCount > 0 && (
        <span className="ml-2 text-accent font-medium">
          {filtered.length} of {allAnalyses?.length ?? 0} shown
        </span>
      )}
    </p>
  </div>
  <div className="flex items-center gap-2">
    <Button
      variant={showFilters ? "default" : "ghost"}
      size="sm"
      onClick={() => setShowFilters((p) => !p)}
    >
      <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
      Filters
      {activeFilterCount > 0 && (
        <Badge variant="soft" size="sm" className="ml-1.5">
          {activeFilterCount}
        </Badge>
      )}
    </Button>
  </div>
</header>
```

### Step 2: Refactor the filter bar

Find the filter bar wrapper (around line 199 `{showFilters && (`). Change the outer wrapper from `<div className="rounded-lg border border-border bg-muted p-4 space-y-4">` to:

```tsx
<Card padding="sm" className="mb-6">
  <CardContent className="p-4 space-y-4">
    {/* existing filter contents */}
  </CardContent>
</Card>
```

Inside the filter card, also update the "Advanced Filters" heading:
```tsx
<p className="text-[13px] font-semibold flex items-center gap-2">
  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
  Advanced filters
</p>
```

Drop the `rounded-lg bg-primary/10 p-2` wrapper around the Filter icon; use it inline as above.

Clear-all button:
```tsx
<Button variant="ghost" size="sm" onClick={clearFilters}>
  <X className="w-3.5 h-3.5 mr-1.5" />Clear all
</Button>
```

The filter input grid stays largely the same — drop the labeled stacks with the Tailwind `text-xs font-medium text-muted-foreground` labels (they look OK with the new tokens).

### Step 3: Kanban column polish

Find the column rendering JSX (likely inside a `KanbanColumn` inner component or inlined inside the `Board()` return). Each column has:
- A header showing column name + count
- A body containing cards

Wrap each column header with sticky positioning:
```tsx
<div className="sticky top-12 z-10 bg-background border-b border-border pb-2 mb-3">
  <h3 className="text-[13px] font-semibold flex items-center gap-2">
    {columnLabel}
    <Badge variant="default" size="sm">{count}</Badge>
  </h3>
</div>
```

(`top-12` aligns with the topbar.)

Column body wrapper:
```tsx
<div className="bg-surface-1 rounded-md border border-border p-3 space-y-2 min-h-[120px]">
  {/* cards */}
</div>
```

Cards inside columns — find the card rendering (around line 347 from the structure markers) and switch to:
```tsx
<Card
  padding="sm"
  className="cursor-pointer hover:border-border-strong transition-colors border-l-2"
  style={{ borderLeftColor: statusColor }}
  onClick={() => setLocation(`/analysis/${a.id}`)}
>
  <CardContent className="flex items-center justify-between gap-3 p-3">
    <div className="min-w-0">
      <p className="text-[13px] font-medium truncate">{a.jobTitle}</p>
      {a.companyName && <p className="text-[11px] text-muted-foreground truncate">{a.companyName}</p>}
    </div>
    <ScoreCircle score={a.fitScore} size="sm" />
  </CardContent>
</Card>
```

`statusColor` should be a tokenized HSL string derived from the column's status (e.g. `applied` → `hsl(var(--info))`, `got_interview` → `hsl(var(--warning))`, etc.).

Empty column placeholder:
```tsx
{cards.length === 0 && (
  <p className="text-[12px] text-subtle-foreground text-center py-4">Drag analyses here</p>
)}
```

### Step 4: Empty state for whole board

When `(allAnalyses ?? []).length === 0`:

```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <LayoutGrid />
    </EmptyMedia>
    <EmptyTitle>No analyses in your pipeline</EmptyTitle>
    <EmptyDescription>
      Run an analysis from the Optimize page to start tracking applications.
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button onClick={() => setLocation("/")}>Start a new analysis</Button>
  </EmptyContent>
</Empty>
```

Add imports as needed.

### Step 5: Typecheck

```bash
pnpm run typecheck
```

### Step 6: Commit

```bash
git add artifacts/resume-matcher/src/pages/board.tsx
git commit -m "feat(board): sticky column headers, status-tinted card borders, tighter header"
```

---

## Task 3: Brand page

**Files:**
- Modify: `artifacts/resume-matcher/src/pages/brand.tsx`

### Step 1: Replace `StatCard` inner component

The brand page has its own `StatCard` (lines 27-56). Replace with the same token-driven version used in Task 1 Stats:

```tsx
function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  highlight,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card
      padding="sm"
      className={cn(
        "transition-colors",
        highlight && "border-accent/50",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">{title}</p>
            <p className="font-mono tabular-nums text-[24px] font-semibold mt-1.5 leading-none">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

Add `cn` import if missing.

### Step 2: Replace the page header

Find existing header (around lines 160-170) and replace with:

```tsx
<header className="flex items-baseline justify-between gap-3 mb-6">
  <div>
    <h1 className="text-2xl font-semibold tracking-[-0.02em]">Brand dashboard</h1>
    <p className="text-[13px] text-muted-foreground mt-1">
      Your professional identity quantified across {totalAnalyses} analyses.
    </p>
  </div>
</header>
```

Drop the inline `<Fingerprint w-8 h-8>` icon — the page is in the Insights nav so the context is clear.

### Step 3: Update Fit Score Evolution chart theming

Find the chart (around line 189). Sweep colors:

- `<CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />` → `<CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />`
- `<XAxis ... tick={{ fontSize: 10, fill: '#888' }}>` → `<XAxis ... tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}>`
- `<YAxis ...>` same fix
- `<Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: ... }}>` → `<Tooltip contentStyle={{ backgroundColor: 'hsl(var(--surface-3))', border: '1px solid hsl(var(--border-strong))', borderRadius: '6px', fontSize: '12px', color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }} />`
- `<Line stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 6, strokeWidth: 0 }}>` → `<Line stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: 'hsl(var(--background))', stroke: 'hsl(var(--accent))' }} activeDot={{ r: 5, strokeWidth: 0 }}>`

Grep for remaining hex literals:
```bash
grep -n "#[0-9a-fA-F]\\{3,8\\}" artifacts/resume-matcher/src/pages/brand.tsx
```

### Step 4: Horizontal keyword bars

Find the "keyword strength" section in the page (likely a word-cloud or pill cluster — look for `topMatchedKeywords` or similar). Replace it with a horizontal-bars layout:

```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
      <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
      Top keyword strengths
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-2">
    {topKeywords.length === 0 ? (
      <p className="text-[12px] text-muted-foreground text-center py-4">
        Run more analyses to see your top keywords.
      </p>
    ) : (
      topKeywords.slice(0, 10).map((kw) => {
        const pct = maxKeywordCount > 0 ? (kw.count / maxKeywordCount) * 100 : 0;
        return (
          <div key={kw.name} className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-muted-foreground w-32 truncate text-right">{kw.name}</span>
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono tabular-nums text-[11px] text-muted-foreground w-8 text-right">{kw.count}</span>
          </div>
        );
      })
    )}
  </CardContent>
</Card>
```

You may need to add a `topKeywords` derived variable to the component if it doesn't already exist. The shape: `Array<{ name: string; count: number }>` derived from `allAnalyses` via flatMap + count by frequency.

`maxKeywordCount = Math.max(...topKeywords.map(k => k.count), 0)` for percentage scaling.

If the existing page already has `topMatchedKeywords` or similar, reuse it. Otherwise add:
```ts
const topKeywords = useMemo(() => {
  if (!analyses) return [];
  const counts = new Map<string, number>();
  for (const a of analyses) {
    for (const kw of (a.atsKeywordsMatched as string[] | undefined) ?? []) {
      counts.set(kw, (counts.get(kw) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((x, y) => y.count - x.count);
}, [analyses]);

const maxKeywordCount = topKeywords[0]?.count ?? 0;
```

### Step 5: Typecheck

```bash
pnpm run typecheck
```

### Step 6: Commit

```bash
git add artifacts/resume-matcher/src/pages/brand.tsx
git commit -m "feat(brand): hero metric strip, horizontal keyword bars, token-driven chart"
```

---

## Task 4: Final verification + PR

**Files:** (verification only)

### Step 1: Repo-wide typecheck
```bash
pnpm run typecheck
```
Expected: every workspace `Done`.

### Step 2: Sanity greps
```bash
# Confirm no leftover hex color literals in chart configs
grep -nE "#[0-9a-fA-F]{6}" artifacts/resume-matcher/src/pages/stats.tsx artifacts/resume-matcher/src/pages/brand.tsx
# Expected: empty (or only in code comments)

# Confirm sticky top-12 columns
grep -c "sticky top-12" artifacts/resume-matcher/src/pages/board.tsx
# Expected: at least 1

# Confirm new headers
grep -c "text-2xl font-semibold tracking-\\[-0.02em\\]" artifacts/resume-matcher/src/pages/stats.tsx artifacts/resume-matcher/src/pages/board.tsx artifacts/resume-matcher/src/pages/brand.tsx
# Expected: 3 (one per page)
```

### Step 3: Smoke test (optional)

Start servers and verify each page visually. The implementer can skip this if time-constrained.

### Step 4: Push and PR

```bash
git push -u origin ui/sub-project-3b-pages
gh pr create --base main --head ui/sub-project-3b-pages --title "UI upgrade · sub-project 3b: Stats + Board + Brand polish" --body "$(cat <<'PRBODY'
## Summary

Sub-project 3b of 4 in the UI upgrade. Polishes the three remaining Tier-2 pages.

### Stats
- New StatCard with mono+tabular numbers and uniform layout
- Token-driven chart theming (no more hex literals)
- New Empty primitive replacing dashed border block

### Board
- Tighter header with subtitle + filter button
- Sticky column headers with count badges
- Status-tinted left border on each card
- Empty placeholder per column

### Brand
- Hero metric strip with new StatCard shape
- Horizontal keyword bars instead of pills
- Token-driven Fit Score Evolution line chart

## Test plan
- [ ] pnpm run typecheck all green
- [ ] Stats page renders all KPI tiles, charts have legible axes in both themes
- [ ] Board columns scroll independently with sticky headers
- [ ] Brand keyword bars scale correctly when one keyword dominates

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

---

## Done

3 commits + 1 PR. Stats/Board/Brand all on the new design tokens. Sub-project 4 (Analysis page restructure) is the last UI sub-project remaining.
