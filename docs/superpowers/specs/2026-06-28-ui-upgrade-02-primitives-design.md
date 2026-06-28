# UI Upgrade Sub-project 2: Primitive Components Rebuild

**Date:** 2026-06-28
**Status:** Approved for implementation
**Parent spec:** [`2026-06-28-ui-upgrade-startup-grade-design.md`](2026-06-28-ui-upgrade-startup-grade-design.md)
**Direction:** Linear / Vercel aesthetic — dark-first, indigo accent, tight density

## Goal

Apply the new design tokens (shipped in sub-project 1) to all primitive components so every page in the app inherits the Linear/Vercel look. APIs are preserved — no breaking signature changes, no call-site edits required.

## Scope

10 primitive files plus 1 CSS keyframe addition.

| File | Change |
|---|---|
| `components/ui/button.tsx` | Resize, restyle, fix loading-width shift |
| `components/ui/card.tsx` | Add `padding` prop (sm/default/lg) |
| `components/ui/input.tsx` | Smaller, `bg-surface-3`, accent focus ring |
| `components/ui/textarea.tsx` | Match Input styling |
| `components/ui/select.tsx` | Trigger matches Input styling |
| `components/ui/tabs.tsx` | Replace pill with Linear-style underline |
| `components/ui/badge.tsx` | Squared, add `solid`/`soft` variants |
| `components/ui/kbd.tsx` | `bg-surface-2` + `border-border-strong` |
| `components/ui/skeleton.tsx` | Shimmer gradient instead of pulse |
| `components/ui/tooltip.tsx` | `bg-surface-3` + `border-border-strong` |
| `components/ui/empty.tsx` | Re-skin, drop `border-dashed` |
| `components/score-circle.tsx` | Token colors, mono numbers, 200ms count-up |
| `src/index.css` | New `skeleton-shimmer` keyframe |

## Design decisions

### Button
- Sizes: `sm: h-7` (12px text) / `default: h-8` (13px) / `lg: h-10` (14px). Icon sizes match.
- Keep all 9 existing variants (decided in brainstorming): default, secondary, ghost, outline, destructive, link, success, warning, info.
- Token mapping:
  - `default` → `bg-accent text-accent-foreground hover:bg-accent/90`
  - `secondary` → `bg-surface-2 text-foreground hover:bg-surface-3`
  - `ghost` → `hover:bg-surface-2`
  - `outline` → `border border-border bg-transparent hover:bg-surface-2`
  - Semantic (destructive/success/warning/info/link) unchanged in palette; just adopt new motion tokens.
- Loading state: preserve button width. Implementation: keep children rendered, layer absolute-positioned spinner on top, `aria-busy=true`, `pointer-events-none` on inner children. The button does NOT change size during loading.
- Focus ring: `ring-2 ring-accent ring-offset-2 ring-offset-background`.
- Radius: `rounded-md` (which now resolves to 6px via `--radius`).

### Card
- New prop: `padding?: "sm" | "default" | "lg"` — defaults to `default`.
- Apply via wrapper className. The CardHeader/Content/Footer internal padding is untouched (their existing `p-4 pt-0` etc. patterns stay).
  - `sm` → outer wrapper uses `p-3` equivalents inside CardHeader/Content/Footer.
  - Implementation: `Card` sets a CSS variable `--card-padding` that the sub-components consume.
- No transitions or hover by default. Consumers opt in via className.
- Radius stays `rounded-lg` (8px via `--radius-lg`).
- Shadow: tokens already deliver shadow-less in dark and `--shadow-xs` in light.

### Input + Textarea + Select trigger
- Height: `h-9` → `h-8` (32px).
- Background: `bg-transparent` → `bg-surface-3`.
- Focus: `border-accent ring-2 ring-accent/20`.
- Text: drop responsive `text-base md:text-sm`, set `text-[13px]` flat.
- Error state: opt-in via `data-error="true"` attribute (sets red border + a `aria-invalid` mirror). Consumers (e.g. react-hook-form integrations) add this attr.
- Textarea: same treatment + keep `field-sizing-content` if already present.
- Select trigger: applies the same className set as Input.

### Tabs (Linear underline)
- `TabsList`: `inline-flex h-9 items-center gap-4 border-b border-border` (transparent background).
- `TabsTrigger`:
  - Default: `text-muted-foreground h-9 px-1 pb-2 text-[13px] font-medium border-b-2 border-transparent transition-colors`.
  - Active: `data-[state=active]:text-foreground data-[state=active]:border-accent`.
- No animated sliding indicator (border-color transition is enough).
- Keyboard navigation handled by Radix Tabs as before.

### Badge (squared)
- Shape: `rounded-full` → `rounded-[4px]`.
- Variants:
  - Existing: `default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `info`.
  - New: `solid` → `bg-accent text-accent-foreground border-transparent`.
  - New: `soft` → `bg-accent-soft text-accent border-transparent`.
  - Semantic variants (success/warning/info) update to soft-style: `bg-success/12 text-success border-transparent` (etc.) instead of solid fill. (Solid semantic kept available via direct className override; default to soft.)
- Sizes: sm=`h-4 text-[10px]` / default=`h-5 text-[10.5px]` / lg=`h-6 text-[11px]`. Tracking `0.04em`.
- `onRemove` button: same API; hover bg → `surface-2`.

### Kbd
- Background: `bg-muted` → `bg-surface-2`.
- Border: add `border border-border-strong`.
- Padding: `px-1` → `px-1.5 py-0.5`.
- Height: keep `h-5`.
- Mono 11px.

### Skeleton
- Replace `animate-pulse rounded-md bg-muted` with shimmer:
  ```
  rounded-md
  bg-[linear-gradient(90deg,hsl(var(--surface-2))_25%,hsl(var(--surface-3))_50%,hsl(var(--surface-2))_75%)]
  bg-[length:200%_100%]
  animate-[skeleton-shimmer_1.2s_linear_infinite]
  ```
- New keyframe in `index.css`:
  ```css
  @keyframes skeleton-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  ```
  - Reverse direction so the shimmer reads left-to-right.
- `prefers-reduced-motion: reduce` already disables all animations globally via the existing `@layer base` rule (sub-project 1 added this). No extra guard needed.

### Tooltip
- Background: `bg-popover` → `bg-surface-3`.
- Border: add `border border-border-strong`.
- Padding: keep `px-3 py-1.5`.
- Text: `text-xs` (12px).
- Existing `data-[state=...]` enter/exit animations: keep.

### Empty
- Remove `border-dashed`. Add `border border-border` for explicit definition.
- `EmptyMedia` `icon` variant: `size-10` → `size-8`, `bg-muted` → `bg-surface-2`, internal icon size 6 → 8 (32px).
- `EmptyTitle`: `text-lg` → `text-[15px]`, weight 600.
- `EmptyDescription`: drop `text-sm/relaxed`, use `text-[13px] max-w-[60ch]`.

### ScoreCircle (animated)
- Strokes: `sm: 4` / `md: 6` / `lg: 6` (was 4/6/8).
- Threshold colors (token-driven inline style):
  - `score >= 80` → `hsl(var(--success))`
  - `60 <= score < 80` → `hsl(var(--warning))`
  - `score < 60` → `hsl(var(--destructive))`
  - `score === 0` → `hsl(var(--muted-foreground))`
- Background ring uses `hsl(var(--surface-2))`.
- Number: `font-mono tabular-nums` (was just `tabular-nums`).
- Count-up: on mount, `requestAnimationFrame` loop animates `displayScore` from 0 to `score` over 200ms with `cubic-bezier(0.2, 0, 0, 1)` easing. Renders `Math.round(displayScore)`. Cleanup on unmount.
- Respects `prefers-reduced-motion`: if reduced, snap `displayScore = score` immediately without animation. Implementation: read `window.matchMedia("(prefers-reduced-motion: reduce)").matches` once in the effect.

## API stability

All component APIs are unchanged or strictly extended:
- Button, Badge: existing variant names kept; new variants added.
- Card: new optional `padding` prop with `"default"` fallback (matches current behavior).
- Input, Textarea, Select: no prop changes; visuals only.
- Tabs, Kbd, Skeleton, Tooltip, Empty, ScoreCircle: no prop changes.
- No call site needs to change to compile.

## Non-goals

- Per-page polish (sub-project 3).
- Adding new primitives (e.g. DataTable, ToggleGroup variants).
- Replacing Radix/shadcn underpinnings — restyling only.
- The `@theme inline` Tailwind mappings — already shipped in sub-project 1.

## Risks

| Risk | Mitigation |
|---|---|
| Loading button width shift mid-state | Use absolute-positioned spinner overlaid on hidden children; snapshot before/after click to verify |
| Tabs underline misalignment with old per-page styling | Smoke test History page (only consumer beyond NotificationsPanel) |
| Skeleton shimmer perf with many skeletons | The CSS animation runs on `background-position` (compositor-friendly); no JS, no layout thrash. Acceptable for 50+ concurrent skeletons. |
| ScoreCircle count-up + React StrictMode (double mount in dev) | Effect uses single ref to track raf id; cleanup cancels in-flight raf. Tested manually. |
| Pre-existing TS errors return | Sub-project 1 cleaned these up. PR #14 merged. New work must not re-introduce. |

## What "done" looks like

- All 13 files updated; existing visual tests (eye check) on Home, History, Analysis, Stats, Brand pass with no broken layouts.
- `pnpm typecheck` exits clean (status 0 on every workspace).
- Every primitive's public API is identical to before — call sites compile without change.
- A new `EmptyState` is consistent across `not-found.tsx`, `versions.tsx`, `saved-jobs.tsx`, `search-alerts.tsx` (these all use `Empty` already).
- Score circles in History and Analysis show animated count-up + threshold colors.
