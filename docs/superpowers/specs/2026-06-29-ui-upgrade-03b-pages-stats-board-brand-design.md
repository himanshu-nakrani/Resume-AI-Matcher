# UI Upgrade Sub-project 3b: Stats + Board + Brand Polish

**Date:** 2026-06-29
**Status:** Approved for implementation
**Parent spec:** [`2026-06-28-ui-upgrade-startup-grade-design.md`](2026-06-28-ui-upgrade-startup-grade-design.md)
**Direction:** Linear / Vercel aesthetic — dark-first, indigo accent, tight density

## Goal

Polish the remaining three Tier-2 pages (Stats, Board, Brand) to apply the new design tokens and primitives. APIs, data flow, mutations, and Recharts structures stay; only the visual layout, headers, chart theming, and container chrome change.

## Scope

3 page files. ~1,500 lines touched. Total: 3 commits, 1 PR.

| Page | Current lines | Treatment |
|---|---|---|
| `pages/stats.tsx` | 773 | Tighter header, KPI tile redesign, chart theming to tokens |
| `pages/board.tsx` | 452 | Smaller header, Kanban column polish with WIP indicators, sticky column headers |
| `pages/brand.tsx` | 337 | Tighter header, hero metric strip, horizontal keyword bars |

## Design decisions

### Cross-cutting

Replicate the header pattern from sub-project 3a:

```tsx
<header className="flex items-baseline justify-between gap-3 mb-6">
  <div>
    <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
    {subtitle && <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>}
  </div>
  <div className="flex items-center gap-2">{/* right actions */}</div>
</header>
```

All three pages drop the old `text-3xl font-bold` / `text-4xl font-bold` heading sizes for the new `text-2xl font-semibold tracking-[-0.02em]`.

### Stats

- **Header**: H1 + subtitle + "Compare" button on right (preserve existing).
- **KPI tile redesign**: replace the current `StatCard` inner component with a token-driven version. New look: smaller padding (`Card padding="sm"` + `p-4`), uppercase 11px label, mono+tabular 24-28px value, optional sub line at 11px muted, icon as a 28x28 surface-2 tile in top-right.
- **Avg Fit / ATS Score Cards** (currently special-cased with `<ScoreCircle>`): keep using ScoreCircle but inside the same redesigned KPI tile shape so the row is visually uniform.
- **Chart theming**: chart colors that currently use hex literals (`#22c55e`, `#ef4444`, `#3b82f6`, etc.) switch to `hsl(var(--success))`, `hsl(var(--destructive))`, `hsl(var(--accent))`. CartesianGrid → use `hsl(var(--border))`. Axis tick fills → `hsl(var(--muted-foreground))`. Tooltip styles → use `bg-surface-3 border border-border-strong text-foreground` rounded-md.
- **SCORE_BUCKETS** color map: switch hex to token-driven HSL strings.
- **STATUS_COLORS** map: same — switch hex literals to semantic tokens (`hsl(var(--info))` for applied, `hsl(var(--warning))` for got_interview, `hsl(var(--success))` for selected, `hsl(var(--destructive))` for rejected, etc.).
- **Empty state**: replace the current "border-dashed" empty block with the `<Empty>` primitive.
- **Skeletons**: keep, but reduce sizes (`h-24` → `h-20`).
- **2×2 chart grid**: the spec parent says "4 KPI tiles at top, 2x2 chart grid below". The current page has more than that. Keep the existing chart count but ensure they're visually paired in `grid-cols-1 md:grid-cols-2 gap-4` rows.

### Board

- **Header**: smaller h1 (`text-2xl font-semibold`), subtitle ("Pipeline of every analysis in flight"), filter toggle button on right with active-count Badge.
- **Filter bar redesign**: when toggled open, wrap in a `<Card padding="sm">` instead of the current `bg-muted` div. Inputs use the new h-8 styling automatically.
- **Kanban columns**:
  - Sticky column header (`sticky top-12 z-10 bg-background border-b border-border pb-2`) showing column name, count, and a WIP cap indicator if defined.
  - Column body: `bg-surface-1` rounded-md border subtle, padded.
  - Cards inside: `Card padding="sm"` with title + company + ScoreCircle sm + status-colored left border (2px).
  - Empty column: shows "Drag cards here" placeholder text in `text-subtle-foreground`.
- **Drag affordance**: drag over a column lifts the column bg to `surface-2` and adds a 2px dashed `border-accent`. The card being dragged gets `opacity-50 scale-[0.98]` (the one exception to the "no transform" rule from the spec, since drag needs visual lift).
- **Column counts and WIP**: 5 columns at the top each show `{count} {status name}` and if a WIP limit applies (e.g., for "got_interview" > 5), show a yellow warning Badge.
- **Empty state** (when no analyses anywhere): `<Empty>` with CTA to create an analysis.

### Brand

- **Header**: tighter — drop the large `Fingerprint w-8 h-8` icon, replace with smaller header. H1 "Brand dashboard" + subtitle showing analysis count.
- **Hero metric strip**: 4 KPI tiles at top using the same redesigned tile as Stats.
- **Fit Score Evolution chart**: replace `hsl(var(--primary))` line color with `hsl(var(--accent))`. Tooltip styling tokens-driven. CartesianGrid → `hsl(var(--border))`. Axis tick fills → `hsl(var(--muted-foreground))`.
- **Focus Area Card**: ScoreCircle stays — already on tokens after sub-project 2.
- **Keyword strength section**: horizontal bars instead of pills/cloud. Each row: keyword name (mono 12px, left-aligned, fixed width) + bar (`h-1.5 bg-surface-2` with `bg-accent` fill) + count value (right). Top 10 keywords by frequency.

## Non-goals

- New behavioral changes.
- Restructuring data fetching or Recharts library choice.
- Adding new charts.
- Drag-and-drop library changes (Board still uses whatever it uses).

## Risks

| Risk | Mitigation |
|---|---|
| Recharts color literal sweep misses some | Implementer grep for `#[0-9a-f]{3,8}` in each file before commit |
| Token-driven chart colors look different in light mode | Verify both themes in browser smoke test |
| Board drag handler tied to existing class names | Preserve all `data-*` attrs; only restyle |
| Brand keyword bars look weird if few keywords exist | Show empty state when no keywords; fallback to "Run more analyses to see your brand" |
| Stats KPI grid wraps awkwardly at 768-1024px | Test `grid-cols-2 md:grid-cols-4` — 5+ tiles wrap fine |

## What "done" looks like

- All three pages adopt the new H1 size + subtitle pattern
- All chart colors are token-driven (no hex literals)
- Stats KPI tiles look uniform and use mono numbers
- Board columns have sticky headers and drag affordance
- Brand has hero metric strip and horizontal keyword bars
- `pnpm typecheck` clean
- No file exceeds 700 lines (Stats may need careful watching at 773 currently — likely shrinks after StatCard cleanup)
