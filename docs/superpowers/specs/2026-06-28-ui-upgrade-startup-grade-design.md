# OptiMatch UI/UX Upgrade — Startup-grade redesign

**Date:** 2026-06-28
**Status:** Parent spec — decomposed into 4 sub-projects (each gets its own spec + plan when implemented)
**Direction:** Linear / Vercel aesthetic — dense, sharp, dark-first, monochrome with indigo accent

## Goal

Take OptiMatch from "functional internal tool" to "startup-grade productivity product." Apply a unified visual language across all 13 pages, primitives, and global shell. Optimize for keyboard-first power users while keeping the product approachable for first-time visitors.

## Direction (decided in brainstorming)

| Question | Decision |
|---|---|
| Aesthetic | Linear / Vercel — dense, sharp, monochrome |
| Default theme | Dark-first; light fully supported as opt-in |
| Scope | All 13 pages hand-polished |
| Accent color | Indigo / Violet `#7C5CFF` |
| Type system | Inter (UI) + JetBrains Mono (numbers/code/kbd) — same as current |
| Sidebar | Linear-style narrow (180px) with shortcut hints |
| Motion | Restrained / Linear-style (100-150ms, color-only hover) |
| Density | Tight — 13px body, 32-36px list rows |
| First-run | Seed one sample analysis on first launch |
| Delivery | Phased: 4 sub-projects in dependency order |
| Home structure | Keep combined, polish only |
| Analysis structure | Tabbed sections — Overview · Cover Letter · LinkedIn · Pipeline · Notes |

## Design tokens (Foundation)

### Color (HSL values in `index.css`)

**Dark theme (default):**
- `--background: 0 0% 4%` — true near-black
- `--surface-1: 0 0% 6%` — cards
- `--surface-2: 0 0% 9%` — hover/raised
- `--surface-3: 0 0% 12%` — inputs
- `--border: 220 8% 14%` — subtle
- `--border-strong: 220 8% 22%` — emphasis
- `--foreground: 0 0% 96%`
- `--muted-foreground: 220 8% 60%`
- `--subtle-foreground: 220 8% 40%`
- `--accent: 252 87% 68%` (#7C5CFF)
- `--accent-foreground: 0 0% 100%`
- `--accent-soft: 252 87% 68% / 0.12`

**Light theme (opt-in):**
- Same token NAMES, tuned values; not enumerated here (will be matched during implementation to maintain readable contrast at WCAG AA).

**Semantic (both themes):** success (green), warning (amber), destructive (red), info (blue). Existing tokens stay; values may shift slightly for new background.

### Type

- **Fonts:** Inter (variable), JetBrains Mono (monospace). Self-hosted, already in use.
- **Scale (rem):** `--text-xs: 0.6875rem` (11) · `--text-sm: 0.8125rem` (13) · `--text-base: 0.875rem` (14) · `--text-md: 0.9375rem` (15) · `--text-lg: 1.0625rem` (17) · `--text-xl: 1.25rem` (20) · `--text-2xl: 1.5rem` (24) · `--text-3xl: 1.875rem` (30)
- **Letter-spacing:** `-0.02em` for ≥2xl, `-0.01em` for xl, default otherwise
- **Line-height:** 1.55 body, 1.15 headings
- **Numbers:** `font-variant-numeric: tabular-nums` everywhere monospace (scores, dates, prices, counts)

### Spacing & radius

- Base unit: 4px. All spacing on 4px multiples.
- Radius: `--radius-sm: 4px` · `--radius: 6px` (default) · `--radius-lg: 8px` · `--radius-xl: 10px`
- Existing 12-16px radii throughout the codebase get reduced.

### Shadows

- Dark mode: borders separate surfaces. Only hover/dropdown surfaces get a subtle `--shadow-sm`.
- Light mode: 1px borders + `--shadow-xs` (a single 1px hairline). Existing shadow tokens stay but values are tightened.

### Motion

- `--duration-fast: 100ms` · `--duration: 150ms` · `--duration-slow: 200ms`
- `--ease: cubic-bezier(0.2, 0, 0, 1)`
- All transitions reference these tokens.
- Respect `prefers-reduced-motion: reduce` — set all durations to 0.01ms.
- Page transitions: 120ms crossfade. No slide, no scale.
- Hover states: color-only, no transform.
- Exception: drag affordance on Kanban cards (Tier-2) gets a subtle 1px lift while dragging.

### Density

- Body 13px / labels 11px / headings 14-30px
- List rows: 32-36px
- Card padding tokens: `card-sm` 12px · `card` 16px · `card-lg` 24px
- Inputs: 32px tall, 13px text
- Buttons: 28px (sm) · 32px (default) · 40px (lg)

## Navigation shell

### Sidebar (180px, dark)

- 1px right border, no shadow
- Logo + product name at top (compact, 18px icon)
- Three labeled groups:
  - **Core:** Optimize, Tracker, Profile
  - **Insights:** History, Stats, Compare, Brand
  - **Jobs:** Versions, Saved Jobs, Alerts
- Group labels: 10px uppercase, `--subtle-foreground`
- Nav items: 32px tall, icon (12px) + label, active = `--surface-2` + `--foreground`
- Right-aligned kbd shortcut on hover (`⌘O`, `G H`)
- Bottom row: notifications, theme toggle, shortcut help — icon-only

### Mobile (<768px)

- Sidebar collapses to bottom tab bar (4 items: Optimize, Tracker, History, Profile)
- A "More" sheet for the remaining items

### Topbar (inside main area)

- Sticky, 48px, transparent over content (subtle `backdrop-blur` on scroll)
- Left: breadcrumb (e.g. `Insights / History`)
- Right: contextual page actions

### Command palette (⌘K)

- Visual upgrade only. Centered modal, max-width 560px, `--surface-1`, 1px border, 10px radius, no shadow
- Sections: Pages · Analyses · Actions · Settings
- Result rows: 36px, leading icon, label, right-aligned kbd hint
- Fuzzy match, keyboard nav, ↵ to execute, Esc to close
- Recently-used surfaces at top when query is empty

### Keyboard shortcuts (consolidated)

| Shortcut | Action |
|---|---|
| `⌘K` | Open palette |
| `⌘?` | Help |
| `Esc` | Close |
| `G H/S/C/B` | History/Stats/Compare/Brand (existing) |
| `⌘N` | New analysis (new) |
| `⌘\` | Toggle sidebar (new) |
| `T` | Toggle theme (when nothing focused) (new) |
| `J/K` | Move down/up in list views (new) |

## Primitives (component upgrades)

All shadcn-based; APIs preserved, looks redesigned.

| Primitive | Key changes |
|---|---|
| Button | 4 variants (default/secondary/ghost/destructive), 3 sizes (28/32/40), color-only hover, focus ring 2px accent, in-button spinner doesn't change width |
| Card | 1px border + 6px radius, no shadow in dark, hover = border-strong, no transform |
| Input/Textarea/Select | 32px, 13px, `--surface-3` bg, focus ring 2px accent/0.2, error state with red border + 11px message |
| Table | 32px header row (11px uppercase labels), 36px body rows, hover = `--surface-2`, sortable chevron on hover |
| Tabs | Linear-style horizontal, 2px bottom indicator, 14px label, 36px tall, animated indicator, ←/→ keyboard nav |
| Badge | 3 variants (default outline / solid / soft), 3 sizes, status badges get semantic soft tints |
| ScoreCircle | Stroke 8→6, 200ms count-up on mount, threshold colors (≥80 green / 60-79 amber / <60 red), JetBrains Mono tabular nums |
| Kbd | 11px mono, `--surface-2` bg, 1px `--border-strong`, 4px radius |
| Skeleton | 1.2s shimmer, shapes match real content |
| EmptyState | New reusable: 32px icon, 15px title, 13px description (max 60ch), one primary CTA |
| Tooltip | 11px, `--surface-3` bg, 1px `--border-strong`, no arrow, 200ms delay |

## Page-level designs (by tier)

### Tier 1: Polish only

`not-found.tsx`, `versions.tsx`, `saved-jobs.tsx`, `search-alerts.tsx`, `shared.tsx`, `user.tsx`

- New tokens + primitives apply automatically
- Each gets proper page header (h1 + subtitle + right-aligned action) and consistent EmptyState
- `user.tsx`: 2-column layout above 1024px

### Tier 2: Reworked layout

- **`home.tsx`** — keep combined structure. Two-column above 1024px (resume left, JD right). Recent-analyses strip below. Job-search panel becomes collapsible bottom section (collapsed by default). Sticky-bottom Analyze button on mobile.
- **`history.tsx`** — table-first redesign. Page header (h1 + count badge + filters). Filter bar (search · status chips · favorites). Table cols: Title · Company · Score · ATS · Status · Created · actions. Bulk-select mode.
- **`stats.tsx`** — dashboard layout. 4 KPI tiles at top (Total · Avg Fit · Applied · Interview Rate). 2x2 chart grid below (trend, status distribution, top keywords, funnel). Recharts theme updated to new tokens.
- **`board.tsx`** — Kanban polish. 5 columns with count + WIP indicators. Sticky column headers. Active drag = `--accent` border + 1px lift.
- **`compare.tsx`** — two-pane layout, shared scroll. Diff highlighting on keywords + score delta arrows.
- **`brand.tsx`** — hero metric strip at top. Horizontal keyword strength bars with mono labels.

### Tier 3: Architectural restructure

- **`analysis.tsx`** — full tabbed restructure
  - Sticky top: job title + company + Fit/ATS score circles + status badge + share/favorite/delete actions
  - Tabs: **Overview · Cover Letter · LinkedIn · Pipeline · Notes**
  - Tab content split:
    - Overview: strengths, gaps, improvements, ATS keywords, bullet rewriter, InterviewChecklist
    - Cover Letter: existing UI
    - LinkedIn: existing UI
    - Pipeline: deadline, follow-up date, contact info, ICS export
    - Notes: notes + share section
  - **File split:** current `pages/analysis.tsx` (1431 lines) becomes folder `pages/analysis/` with `index.tsx` (shell + tabs) + one file per tab
  - **URL state:** `/analysis/:id?tab=overview` persists tab across refreshes

## First-run experience

- On app boot, if no analyses exist (`SELECT COUNT(*) FROM analyses = 0`), seed one realistic sample
- Sample: "Senior Frontend Engineer" at "Stripe" with a believable resume + JD + scores + a few strengths/gaps
- Sample appears in History, Stats, etc. — every screen feels populated
- Sample row gets a "Sample · click to remove" badge (visual differentiation)
- Removing it is the user's first explicit interaction with the product
- Implementation: server-side seed on first DB write, NOT client-side (so refresh doesn't re-add)

## Sub-project decomposition

The total work is too large for a single plan. Decompose into 4 sub-projects, each its own spec + plan + execution:

1. **Foundation + global shell** (this sub-project's plan ships first)
   - All design tokens in `index.css`
   - Sidebar + topbar rebuild (`layout.tsx`)
   - Command palette visual upgrade
   - First-run sample-analysis seed (API server + DB)
   - Tier 1 pages inherit changes automatically
2. **Primitive components rebuild**
   - Button, Card, Input, Tabs, Badge, Kbd, Skeleton, EmptyState, Tooltip
   - ScoreCircle animation + threshold colors
3. **Tier-2 page rewrites**
   - Home, History, Stats, Board, Compare, Brand
4. **Analysis page restructure**
   - Tab system, file split into `pages/analysis/`, URL state

Each sub-project is independently shippable and independently reviewable.

## Non-goals

- Mobile-first redesign. Mobile must remain functional and accessible, but desktop power-user UX is the priority.
- New features. This is a visual + structural upgrade only; no behavioral changes except first-run seed and the new keyboard shortcuts.
- Brand identity / logo / marketing pages. The current logo stays.
- Accessibility regression. Maintain WCAG AA for both themes; verify focus states everywhere.

## Risks & mitigations

- **Risk:** dark-first shift breaks user expectations of existing screenshots/bookmarks. **Mitigation:** light mode still fully supported; theme toggle is prominent in sidebar bottom row.
- **Risk:** all 13 pages = large blast radius. **Mitigation:** phased rollout, 4 PRs, each independently reviewable and reversible.
- **Risk:** tabbed Analysis page might hurt SEO / share links if anyone deep-links to a section. **Mitigation:** `?tab=` URL state preserves deep-linking.
- **Risk:** sample-analysis seed could surprise users on existing DBs. **Mitigation:** only seed when count is 0 — existing installs never see it.
- **Risk:** pre-existing TS2308 errors in `lib/api-zod/src/index.ts` still block lib build. **Mitigation:** out of scope; not made worse.

## Out of scope (explicit)

- New API endpoints (beyond what first-run seed requires)
- DB schema changes (other than the sample-seed insert)
- The 6 pre-existing TS2308 duplicate-export errors
- The pre-existing OpenAI SDK typing errors in `api-server`

## What "done" looks like

After all 4 sub-projects ship:

- A first-time visitor sees a populated, well-designed app that feels professional and intentional
- A keyboard-first user can navigate the whole product without touching the mouse
- Both light and dark themes look polished; dark is the default
- Every page has a consistent header pattern, consistent empty-state, consistent loading skeleton
- `pages/analysis.tsx` is no longer a 1431-line file
- All 13 pages render with the new design tokens and primitives
