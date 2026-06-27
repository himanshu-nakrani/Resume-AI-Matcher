# UI Upgrade Sub-project 1: Foundation + Global Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the design tokens with the new dark-first Linear/Vercel system (indigo accent, tighter density, restrained motion), rebuild the sidebar + topbar shell, refresh the command palette, and add a first-run sample-analysis seed.

**Architecture:** Single PR. Edit `index.css` tokens first → primitives that depend on tokens recompile cleanly (no API changes). Then rebuild `layout.tsx` and `command-palette.tsx` to use new tokens + tighter structure. Add seed to `api-server` boot path so it runs once per fresh DB.

**Tech Stack:** Tailwind 4, shadcn/ui (existing primitives stay), Inter + JetBrains Mono (already in use), React 19, Wouter routing, Drizzle ORM + better-sqlite3, Express 5.

**Parent spec:** [`docs/superpowers/specs/2026-06-28-ui-upgrade-startup-grade-design.md`](../specs/2026-06-28-ui-upgrade-startup-grade-design.md)

---

## Background for the implementing engineer

This is sub-project **1 of 4** in a larger UI/UX upgrade. The scope of THIS plan is intentionally narrow:

1. Design tokens (`index.css`) — colors, type scale, spacing, motion, radius, shadows
2. Sidebar shell (`components/layout.tsx`) — 180px Linear-style with kbd hint hovers, three-group structure
3. Topbar (inside main area in `layout.tsx`) — breadcrumb left + contextual actions right
4. Mobile bottom-tab bar (already partly present in `layout.tsx`) — clean up
5. Command palette visual upgrade (`components/command-palette.tsx`)
6. First-run sample-analysis seed (`api-server` boot path + `lib/db`)

**Out of scope for this sub-project (handled in later sub-projects):**
- Individual primitive component rebuilds (Button/Card/Input/Tabs/etc.) — sub-project 2
- Per-page polish — sub-projects 3 + 4
- The pre-existing TS2308 errors in `lib/api-zod/src/index.ts`

**Sample analysis content** (used by Task 11): the seed inserts a single realistic row simulating "Senior Frontend Engineer" at "Stripe" — see Task 11 for the exact row fields and values.

**Important constraints:**
- No backwards-compat shims for old token names — token names stay (`--background`, `--foreground`, `--border`, etc. are unchanged), only values shift. New tokens (`--surface-1`, `--surface-2`, `--surface-3`, `--border-strong`, `--subtle-foreground`, `--accent-soft`, `--duration*`, `--ease`) are added.
- Use Conventional Commits. Each task commits independently.
- Do NOT switch branches. Branch is already `wip/scratch`. (Implementer dispatch dir: `/Users/himanshu/Git/Resume-AI-Matcher`.)
- After each frontend task that touches `.tsx`, run `cd artifacts/resume-matcher && ../../node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS6305\|TS7006\|TS18046\|TS2322\|TS2345" | head -20` to confirm no NEW real errors. The filtered errors are pre-existing stale-build cascade noise; only flag novel errors.
- After tasks touching api-server or lib/db: run `./node_modules/.bin/tsc --build 2>&1 | tail -10` and confirm only the 6 pre-existing TS2308 errors appear.

---

## File Map

### Files to create

```
artifacts/api-server/src/lib/seed-sample-analysis.ts    — sample-analysis seeder (Task 11)
```

### Files to modify

```
artifacts/resume-matcher/src/index.css                  — token rewrite + base layer + utilities (Tasks 1, 2, 3)
artifacts/resume-matcher/src/components/layout.tsx      — sidebar + topbar + bottom tab bar rebuild (Tasks 5, 6, 7, 8)
artifacts/resume-matcher/src/components/command-palette.tsx — visual upgrade (Task 9)
artifacts/resume-matcher/src/App.tsx                    — wire ThemeBoot to default dark on first visit (Task 4)
artifacts/resume-matcher/src/hooks/use-dark-mode.ts     — change default to "dark" (Task 4)
artifacts/api-server/src/index.ts                       — invoke seed on boot (Task 11)
```

### Files NOT touched in this sub-project

- `components/ui/*` — primitive rebuilds are sub-project 2
- All pages under `pages/` — page polish is sub-projects 3 + 4

---

## Task 1: Replace color and surface tokens in `index.css`

**Files:**
- Modify: `artifacts/resume-matcher/src/index.css`

- [ ] **Step 1: Find the current `:root` and `.dark` blocks**

Run:
```bash
grep -n "^:root\|^\.dark" artifacts/resume-matcher/src/index.css
```
Expected: two line numbers. `:root` is around line 78, `.dark` around line 164.

- [ ] **Step 2: Replace the `.dark` block (default theme after Task 4)**

Find the entire `.dark { ... }` block. Replace its contents with:

```css
.dark {
  /* Base — true near-black, surfaces tier up */
  --background: 0 0% 4%;
  --foreground: 0 0% 96%;
  --surface-1: 0 0% 6%;
  --surface-2: 0 0% 9%;
  --surface-3: 0 0% 12%;
  --border: 220 8% 14%;
  --border-strong: 220 8% 22%;

  /* Cards & popovers — alias to surfaces */
  --card: 0 0% 6%;
  --card-foreground: 0 0% 96%;
  --card-border: 220 8% 14%;
  --popover: 0 0% 6%;
  --popover-foreground: 0 0% 96%;
  --popover-border: 220 8% 14%;

  /* Sidebar — slightly cooler than background */
  --sidebar: 0 0% 3%;
  --sidebar-foreground: 0 0% 96%;
  --sidebar-border: 220 8% 14%;
  --sidebar-primary: 252 87% 68%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 0 0% 9%;
  --sidebar-accent-foreground: 0 0% 96%;
  --sidebar-ring: 252 87% 68%;

  /* Primary — light, used for solid emphasis */
  --primary: 0 0% 98%;
  --primary-foreground: 0 0% 4%;

  /* Secondary, muted */
  --secondary: 0 0% 9%;
  --secondary-foreground: 0 0% 96%;
  --muted: 0 0% 9%;
  --muted-foreground: 220 8% 60%;
  --subtle-foreground: 220 8% 40%;

  /* Accent — Indigo / Violet #7C5CFF */
  --accent: 252 87% 68%;
  --accent-foreground: 0 0% 100%;
  --accent-soft: 252 87% 68% / 0.12;

  /* Semantics — tuned for dark surfaces */
  --destructive: 0 70% 60%;
  --destructive-foreground: 0 0% 100%;
  --success: 145 60% 50%;
  --success-foreground: 0 0% 100%;
  --warning: 38 90% 60%;
  --warning-foreground: 0 0% 0%;
  --info: 200 75% 60%;
  --info-foreground: 0 0% 100%;

  /* Input & ring */
  --input: 0 0% 12%;
  --ring: 252 87% 68%;

  /* Chart palette — accent-anchored */
  --chart-1: 252 87% 68%;
  --chart-2: 200 75% 60%;
  --chart-3: 145 60% 50%;
  --chart-4: 38 90% 60%;
  --chart-5: 320 70% 65%;

  /* Shadows — borders do the work in dark; shadows only on raised surfaces */
  --shadow-xs: 0 0 0 0 transparent;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.25);
  --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 8px -2px rgb(0 0 0 / 0.35);
  --shadow-lg: 0 10px 24px -6px rgb(0 0 0 / 0.4);
  --shadow-xl: 0 20px 40px -10px rgb(0 0 0 / 0.5);
  --shadow-2xl: 0 30px 60px -15px rgb(0 0 0 / 0.55);
  --shadow-inner: inset 0 1px 0 0 rgb(255 255 255 / 0.04);
}
```

- [ ] **Step 3: Replace the `:root` block (light theme = opt-in)**

Find the entire `:root { ... }` block (the one with `--background: 0 0% 100%;`). Replace its contents with:

```css
:root {
  /* Base — warm off-white, layered surfaces */
  --background: 0 0% 100%;
  --foreground: 240 10% 10%;
  --surface-1: 0 0% 100%;
  --surface-2: 220 14% 97%;
  --surface-3: 220 14% 94%;
  --border: 220 13% 88%;
  --border-strong: 220 13% 80%;

  /* Cards & popovers — alias to surfaces */
  --card: 0 0% 100%;
  --card-foreground: 240 10% 10%;
  --card-border: 220 13% 88%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 10%;
  --popover-border: 220 13% 88%;

  /* Sidebar — slightly cooler than background */
  --sidebar: 220 14% 98%;
  --sidebar-foreground: 240 10% 10%;
  --sidebar-border: 220 13% 88%;
  --sidebar-primary: 252 87% 60%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 220 14% 94%;
  --sidebar-accent-foreground: 240 10% 10%;
  --sidebar-ring: 252 87% 60%;

  /* Primary — near-black for solid emphasis */
  --primary: 240 10% 12%;
  --primary-foreground: 0 0% 100%;

  /* Secondary, muted */
  --secondary: 220 14% 94%;
  --secondary-foreground: 240 10% 10%;
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 44%;
  --subtle-foreground: 220 9% 60%;

  /* Accent — Indigo / Violet, darker shade for light-mode contrast */
  --accent: 252 87% 60%;
  --accent-foreground: 0 0% 100%;
  --accent-soft: 252 87% 60% / 0.10;

  /* Semantics */
  --destructive: 0 65% 48%;
  --destructive-foreground: 0 0% 100%;
  --success: 145 60% 38%;
  --success-foreground: 0 0% 100%;
  --warning: 38 90% 50%;
  --warning-foreground: 0 0% 100%;
  --info: 200 75% 45%;
  --info-foreground: 0 0% 100%;

  /* Input & ring */
  --input: 220 13% 88%;
  --ring: 252 87% 60%;

  /* Chart palette */
  --chart-1: 252 87% 60%;
  --chart-2: 200 75% 45%;
  --chart-3: 145 60% 38%;
  --chart-4: 38 90% 50%;
  --chart-5: 320 70% 50%;

  /* Typography — values unchanged from current */
  --app-font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --app-font-serif: "Georgia", serif;
  --app-font-mono: "JetBrains Mono", "Fira Code", Consolas, monospace;

  /* Radius — reduced from 0.5rem default */
  --radius: 0.375rem;

  /* Motion */
  --duration-fast: 100ms;
  --duration: 150ms;
  --duration-slow: 200ms;
  --ease: cubic-bezier(0.2, 0, 0, 1);

  /* Shadows — hairline approach in light mode */
  --shadow-xs: 0 1px 0 0 rgb(0 0 0 / 0.04);
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.06);
  --shadow-md: 0 4px 8px -2px rgb(0 0 0 / 0.06);
  --shadow-lg: 0 10px 24px -6px rgb(0 0 0 / 0.08);
  --shadow-xl: 0 20px 40px -10px rgb(0 0 0 / 0.10);
  --shadow-2xl: 0 30px 60px -15px rgb(0 0 0 / 0.12);
  --shadow-inner: inset 0 1px 0 0 rgb(0 0 0 / 0.04);
}
```

- [ ] **Step 4: Confirm no other CSS files override these tokens**

Run:
```bash
grep -rn "^:root\|^\.dark" artifacts/resume-matcher/src --include="*.css"
```
Expected: matches only in `index.css`.

- [ ] **Step 5: Frontend typecheck**

Run:
```bash
cd artifacts/resume-matcher && ../../node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS6305\|TS7006\|TS18046\|TS2322\|TS2345" | head -20
```
Expected: no output (no new errors). cd back: `cd /Users/himanshu/Git/Resume-AI-Matcher`.

- [ ] **Step 6: Commit**

```bash
git add artifacts/resume-matcher/src/index.css
git commit -m "feat(tokens): replace color tokens with dark-first indigo system"
```

---

## Task 2: Extend `@theme inline` to expose new tokens to Tailwind

**Files:**
- Modify: `artifacts/resume-matcher/src/index.css`

The Tailwind 4 `@theme inline` block (lines 7-76) maps CSS custom properties to Tailwind color/font/radius utility classes. Newly-added tokens from Task 1 need entries here so they can be used as `bg-surface-1`, `text-subtle-foreground`, etc.

- [ ] **Step 1: Add new color mappings inside `@theme inline { ... }`**

Find the line:
```css
--color-foreground: hsl(var(--foreground));
```

Immediately after that line, add:
```css
  --color-surface-1: hsl(var(--surface-1));
  --color-surface-2: hsl(var(--surface-2));
  --color-surface-3: hsl(var(--surface-3));
  --color-border-strong: hsl(var(--border-strong));
  --color-subtle-foreground: hsl(var(--subtle-foreground));
  --color-accent-soft: hsl(var(--accent-soft));
```

- [ ] **Step 2: Add duration + easing mappings inside `@theme inline`**

Find the closing `}` of the `@theme inline` block. Just before it, add:
```css
  --duration-fast: var(--duration-fast);
  --duration-default: var(--duration);
  --duration-slow: var(--duration-slow);
  --ease-out-expo: var(--ease);
```

- [ ] **Step 3: Frontend typecheck**

Run:
```bash
cd artifacts/resume-matcher && ../../node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS6305\|TS7006\|TS18046\|TS2322\|TS2345" | head -20
```
Expected: no output. cd back: `cd /Users/himanshu/Git/Resume-AI-Matcher`.

- [ ] **Step 4: Commit**

```bash
git add artifacts/resume-matcher/src/index.css
git commit -m "feat(tokens): expose new surface/foreground/motion tokens to Tailwind"
```

---

## Task 3: Rewrite `@layer base` and `@layer utilities` for new density

**Files:**
- Modify: `artifacts/resume-matcher/src/index.css`

The current `@layer base` (lines ~242-296) and the utilities (lines ~298+) need updates: tighter type density, motion durations referencing the new tokens, focus ring using `--accent`.

- [ ] **Step 1: Replace the `@layer base` block**

Find the `@layer base { ... }` block. Replace the WHOLE block with:
```css
@layer base {
  * {
    @apply border-border;
    transition-duration: var(--duration);
    transition-timing-function: var(--ease);
  }

  html {
    @apply scroll-smooth;
  }

  body {
    @apply font-sans antialiased bg-background text-foreground;
    font-size: 13px;
    line-height: 1.55;
    letter-spacing: -0.005em;
    font-feature-settings: "ss01", "cv11";
  }

  /* Heading scale — tight tracking, no fluid clamp */
  h1 {
    font-size: 1.875rem; /* 30px */
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.02em;
  }
  h2 {
    font-size: 1.5rem;   /* 24px */
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }
  h3 {
    font-size: 1.25rem;  /* 20px */
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.015em;
  }
  h4 {
    font-size: 1.0625rem; /* 17px */
    font-weight: 600;
    line-height: 1.35;
    letter-spacing: -0.01em;
  }

  /* Numbers default to tabular for stable alignment in tables and metrics */
  .tabular,
  [data-tabular] {
    font-variant-numeric: tabular-nums;
  }

  *:focus-visible {
    outline: 2px solid hsl(var(--accent));
    outline-offset: 2px;
    border-radius: 4px;
  }

  ::selection {
    background-color: hsl(var(--accent) / 0.20);
    color: hsl(var(--foreground));
  }

  /* Reduce motion */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

- [ ] **Step 2: Remove the now-duplicate `prefers-reduced-motion` block at the bottom of the file**

Run:
```bash
grep -n "prefers-reduced-motion" artifacts/resume-matcher/src/index.css
```
Expected: 2 matches. The match inside `@layer base` (just added) AND a freestanding `@media (prefers-reduced-motion: reduce) { * { animation-duration ...} }` near end of file (originally lines ~507-517).

Delete the FREESTANDING one at the bottom (NOT the one in `@layer base`). It looks like:
```css
/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Confirm only 1 match remains:
```bash
grep -c "prefers-reduced-motion" artifacts/resume-matcher/src/index.css
```
Expected: `1`.

- [ ] **Step 3: Remove now-obsolete `.bg-grid` from previous experiment, if present**

Run:
```bash
grep -n "bg-grid" artifacts/resume-matcher/src/index.css
```
If a `.bg-grid::before` rule exists, delete it (the experiment was discarded but in case any partial remained). If grep returns no output, skip.

- [ ] **Step 4: Frontend typecheck**

Run:
```bash
cd artifacts/resume-matcher && ../../node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS6305\|TS7006\|TS18046\|TS2322\|TS2345" | head -20
```
Expected: no output. cd back: `cd /Users/himanshu/Git/Resume-AI-Matcher`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/resume-matcher/src/index.css
git commit -m "feat(tokens): tighter base layer with new type scale and motion"
```

---

## Task 4: Default theme to dark

**Files:**
- Modify: `artifacts/resume-matcher/src/hooks/use-dark-mode.ts`
- Modify: `artifacts/resume-matcher/src/App.tsx` (only if needed)

The hook reads from localStorage with a default. Currently the default is light. Change to dark.

- [ ] **Step 1: Read the hook**

Run:
```bash
cat artifacts/resume-matcher/src/hooks/use-dark-mode.ts
```

- [ ] **Step 2: Change default to dark**

The hook likely contains a `localStorage.getItem(...)` with a fallback to a boolean or string. Make the fallback dark.

Common pattern — if the file looks like:
```ts
const stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
const initial = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
```

Change it to:
```ts
const stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
const initial = stored ? stored === "dark" : true; // default to dark when no preference stored
```

If the file uses a different pattern, locate the initial-value computation and force the fallback to `true` (dark). The principle: **when no user preference exists in localStorage, default = dark.** When the user explicitly toggles, their choice is honored.

- [ ] **Step 3: Verify `App.tsx` adds the `.dark` class on the html element**

Run:
```bash
grep -n "dark\|matchMedia\|theme" artifacts/resume-matcher/src/App.tsx artifacts/resume-matcher/src/main.tsx
```

The hook should already toggle `document.documentElement.classList` (`add("dark")` / `remove("dark")`). No App.tsx change needed unless the toggling is happening somewhere else.

If you find that on initial mount the `.dark` class is NOT applied to `<html>`, add this to `main.tsx` just before the React render call:
```ts
// Apply theme synchronously to avoid flash of light mode
const storedTheme = localStorage.getItem("theme");
if (storedTheme === "dark" || (storedTheme === null && true)) {
  document.documentElement.classList.add("dark");
}
```

If the class IS being applied via the existing hook on mount, skip this — but verify by opening the dev tools after starting the dev server and confirming `<html class="dark">` is present on first paint.

- [ ] **Step 4: Frontend typecheck**

Run:
```bash
cd artifacts/resume-matcher && ../../node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS6305\|TS7006\|TS18046\|TS2322\|TS2345" | head -20
```
Expected: no output. cd back: `cd /Users/himanshu/Git/Resume-AI-Matcher`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/resume-matcher/src/hooks/use-dark-mode.ts artifacts/resume-matcher/src/main.tsx artifacts/resume-matcher/src/App.tsx
git commit -m "feat(theme): default to dark on first visit"
```

(If `App.tsx` or `main.tsx` weren't changed, omit them from the git add — just commit `use-dark-mode.ts`.)

---

## Task 5: Update sidebar shortcut hint table

**Files:**
- Modify: `artifacts/resume-matcher/src/components/layout.tsx`

Add data-driven shortcut hints next to each nav item so they can render on hover. Update the existing `navGroups` array to include `kbd?: string` per item.

- [ ] **Step 1: Update `NavItem` interface**

Find the `interface NavItem { ... }` (around line 34). Replace with:
```ts
interface NavItem {
  href: string;
  label: string;
  icon: typeof PlusCircle;
  kbd?: string;
}
```

- [ ] **Step 2: Update the three `navGroups` items to include kbd**

Find `const navGroups: NavGroup[] = [` (around line 45). Replace the entire array (lines ~45-71) with:

```ts
const navGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { href: "/", label: "Optimize", icon: PlusCircle, kbd: "⌘N" },
      { href: "/tracker", label: "Tracker", icon: LayoutGrid, kbd: "⌘T" },
      { href: "/user", label: "Profile", icon: UserRound },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/history", label: "History", icon: History, kbd: "G H" },
      { href: "/stats", label: "Stats", icon: BarChart2, kbd: "G S" },
      { href: "/compare", label: "Compare", icon: GitCompareArrows, kbd: "G C" },
      { href: "/brand", label: "Brand", icon: Fingerprint, kbd: "G B" },
    ],
  },
  {
    label: "Jobs",
    items: [
      { href: "/versions", label: "Versions", icon: GitBranch },
      { href: "/saved-jobs", label: "Saved Jobs", icon: Bookmark },
      { href: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
];
```

- [ ] **Step 3: Update the existing `SHORTCUTS` array to match**

Find `const SHORTCUTS = [...]` (around line 89). Replace with:
```ts
const SHORTCUTS = [
  { keys: ["⌘", "K"], description: "Open command palette" },
  { keys: ["⌘", "?"], description: "Show keyboard shortcuts" },
  { keys: ["⌘", "N"], description: "New analysis" },
  { keys: ["⌘", "\\"], description: "Toggle sidebar" },
  { keys: ["G", "H"], description: "Go to History" },
  { keys: ["G", "S"], description: "Go to Stats" },
  { keys: ["G", "C"], description: "Go to Compare" },
  { keys: ["G", "B"], description: "Go to Brand" },
  { keys: ["T"], description: "Toggle theme" },
  { keys: ["J", "K"], description: "Move down/up in lists" },
  { keys: ["Esc"], description: "Close dialogs" },
];
```

- [ ] **Step 4: Update the `G ?` keyboard handler to add G B**

Find the keyboard handler `useEffect` (around line 161-205). In the switch block:
```ts
switch (e.key.toLowerCase()) {
  case "h":
    setLocation("/history");
    break;
  case "b":
    setLocation("/brand");
    break;
  case "s":
    setLocation("/stats");
    break;
  case "c":
    setLocation("/compare");
    break;
  default:
    break;
}
```

Keep this exactly as-is — `b` for brand is already correct.

In the SAME `useEffect`, also handle the new shortcuts. Just after the `if ((e.metaKey || e.ctrlKey) && e.key === "?")` block, add three new branches before the `if (e.key === "g" || e.key === "G")` block:

```ts
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setLocation("/");
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
        return;
      }

      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        toggle();
        return;
      }
```

Note: `setSidebarCollapsed` and `toggle` (already imported via `useDarkMode`) — we add `useState` for collapsed in Task 6. For now, this code will fail typecheck. That's expected and gets resolved in Task 6.

- [ ] **Step 5: SKIP commit for now**

Leave changes staged but do NOT commit. Tasks 5+6 are interdependent (the new shortcut references `setSidebarCollapsed` which doesn't exist until Task 6). Commit happens at end of Task 6.

---

## Task 6: Rebuild sidebar with new Linear-style markup

**Files:**
- Modify: `artifacts/resume-matcher/src/components/layout.tsx`

Rewrite the sidebar `<aside>` block (currently around lines 220-292) to match the spec's Linear style: 180px wide (was 256px / `w-64`), 32px nav items, kbd hint on hover, three labeled groups, slimmer bottom toolbar.

- [ ] **Step 1: Add collapsed state to Layout component**

In `function Layout({ children })` (around line 156), after the existing `useState` for `showShortcuts`, add:
```ts
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
```

This adds the state the Task-5 shortcut handler already references.

- [ ] **Step 2: Replace the existing `<aside>` block**

Find `<aside className="sticky top-0 z-20 hidden h-screen w-64 ...` (around line 220) through its closing `</aside>` (around line 292). Replace the ENTIRE block (open through close) with:

```tsx
<aside
  className={cn(
    "sticky top-0 z-20 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex transition-[width] duration-[var(--duration)]",
    sidebarCollapsed ? "w-[52px]" : "w-[180px]",
  )}
>
  <div className="px-3 py-4">
    <Link href="/" className="group flex items-center gap-2 outline-none ring-sidebar-ring focus-visible:ring-2 rounded px-2 py-1 transition-colors">
      <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-foreground text-background">
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
        </svg>
      </div>
      {!sidebarCollapsed && (
        <span className="truncate text-[12.5px] font-semibold tracking-[-0.01em]">OptiMatch</span>
      )}
    </Link>
  </div>

  <nav className="flex flex-1 flex-col overflow-y-auto px-2 pb-3" aria-label="Main">
    {navGroups.map((group, groupIdx) => (
      <div key={group.label}>
        {!sidebarCollapsed && (
          <div
            className={cn(
              "px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground",
              groupIdx === 0 && "pt-1",
            )}
          >
            {group.label}
          </div>
        )}
        <div className="flex flex-col">
          {group.items.map((item) => {
            const active = isActive(location, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex h-8 items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] transition-colors",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  sidebarCollapsed && "justify-center",
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {!sidebarCollapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.kbd && (
                      <kbd className="ml-auto hidden text-[9.5px] font-mono text-subtle-foreground group-hover:inline">
                        {item.kbd}
                      </kbd>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    ))}
  </nav>

  <div className="flex items-center gap-1 border-t border-sidebar-border px-2 py-2">
    <NotificationsPanel triggerClassName="h-7 w-7 text-muted-foreground hover:bg-surface-2 hover:text-foreground" />
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </Button>
    <button
      type="button"
      onClick={() => setShowShortcuts(true)}
      className="ml-auto inline-flex h-7 items-center gap-1 rounded-[5px] px-2 text-[10px] text-subtle-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      aria-label="Keyboard shortcuts"
    >
      <Keyboard className="h-3 w-3" />
      {!sidebarCollapsed && <span>⌘?</span>}
    </button>
  </div>
</aside>
```

- [ ] **Step 3: Frontend typecheck**

Run:
```bash
cd artifacts/resume-matcher && ../../node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS6305\|TS7006\|TS18046\|TS2322\|TS2345" | head -20
```
Expected: no output. If you see "Property 'triggerClassName' does not exist on NotificationsPanelProps" — check `notifications-panel.tsx`:

```bash
grep -n "triggerClassName" artifacts/resume-matcher/src/components/notifications-panel.tsx
```

If `triggerClassName` is NOT supported, change the panel invocation to:
```tsx
<NotificationsPanel />
```
and accept that the notification trigger uses its built-in styling. (The existing `layout.tsx` already passes `triggerClassName` — confirm before changing.) cd back: `cd /Users/himanshu/Git/Resume-AI-Matcher`.

- [ ] **Step 4: Commit (combined Task 5 + 6)**

```bash
git add artifacts/resume-matcher/src/components/layout.tsx
git commit -m "feat(shell): rebuild sidebar in Linear-style 180px with kbd hints"
```

---

## Task 7: Add topbar with breadcrumb inside main column

**Files:**
- Modify: `artifacts/resume-matcher/src/components/layout.tsx`

The current mobile-only header (around line 295-310) stays. Add a desktop-only topbar above the main content with a left-aligned breadcrumb derived from the current route.

- [ ] **Step 1: Add a breadcrumb helper at top of layout.tsx**

Find the top of `layout.tsx`, after the imports block (after line 32 `import { cn } ...`). Add:

```ts
function routeBreadcrumb(location: string): { group: string | null; label: string } {
  // Map known top-level routes to (group, label) for the breadcrumb.
  const ROUTE_INDEX: Record<string, { group: string | null; label: string }> = {
    "/": { group: "Core", label: "Optimize" },
    "/tracker": { group: "Core", label: "Tracker" },
    "/board": { group: "Core", label: "Tracker" },
    "/user": { group: "Core", label: "Profile" },
    "/history": { group: "Insights", label: "History" },
    "/stats": { group: "Insights", label: "Stats" },
    "/compare": { group: "Insights", label: "Compare" },
    "/brand": { group: "Insights", label: "Brand" },
    "/versions": { group: "Jobs", label: "Versions" },
    "/saved-jobs": { group: "Jobs", label: "Saved Jobs" },
    "/alerts": { group: "Jobs", label: "Alerts" },
  };
  if (ROUTE_INDEX[location]) return ROUTE_INDEX[location];
  if (location.startsWith("/analysis/")) return { group: "Insights", label: "Analysis" };
  return { group: null, label: "" };
}
```

- [ ] **Step 2: Add the topbar to the desktop main column**

Find the existing `<main className="flex-1 pb-20 md:pb-0">` (around line 312). Just BEFORE that line, insert this desktop-only topbar (Note: the existing mobile `<header>` stays, immediately preceding this code):

```tsx
<header className="sticky top-0 z-10 hidden h-12 items-center justify-between gap-3 border-b border-border bg-background/80 px-6 backdrop-blur-md md:flex">
  <div className="flex min-w-0 items-center gap-2 text-[12.5px]">
    {(() => {
      const bc = routeBreadcrumb(location);
      if (!bc.label) return null;
      return (
        <>
          {bc.group && (
            <>
              <span className="text-subtle-foreground">{bc.group}</span>
              <span className="text-subtle-foreground">/</span>
            </>
          )}
          <span className="truncate text-foreground">{bc.label}</span>
        </>
      );
    })()}
  </div>
  <div className="flex items-center gap-2" id="topbar-actions" />
</header>
```

The `#topbar-actions` empty div is a reservation for page-specific contextual actions to portal into later (sub-projects 3/4 wire this).

- [ ] **Step 3: Frontend typecheck**

Run:
```bash
cd artifacts/resume-matcher && ../../node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS6305\|TS7006\|TS18046\|TS2322\|TS2345" | head -20
```
Expected: no output. cd back: `cd /Users/himanshu/Git/Resume-AI-Matcher`.

- [ ] **Step 4: Commit**

```bash
git add artifacts/resume-matcher/src/components/layout.tsx
git commit -m "feat(shell): add sticky topbar with breadcrumb and actions slot"
```

---

## Task 8: Clean up mobile bottom-nav using new tokens

**Files:**
- Modify: `artifacts/resume-matcher/src/components/layout.tsx`

The current mobile bottom-nav (around line 318-345) uses `bg-background` / `border-border`. Update to use the new surface tokens for consistency.

- [ ] **Step 1: Locate the mobile nav**

Run:
```bash
grep -n "Mobile\|mobileNavItems\|fixed bottom-0" artifacts/resume-matcher/src/components/layout.tsx
```

- [ ] **Step 2: Update the mobile bottom nav markup**

Find the `<nav ... aria-label="Mobile">` block (around line 318). Replace its outer className from `bg-background` to `bg-surface-1`:

Before:
```tsx
<nav
  className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
  aria-label="Mobile"
>
```

After:
```tsx
<nav
  className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-surface-1 pb-[env(safe-area-inset-bottom)] md:hidden"
  aria-label="Mobile"
>
```

Also update the mobile header at the top (around line 295) — change `bg-background` to `bg-surface-1`:

Before:
```tsx
<header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
```

After:
```tsx
<header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface-1 px-4 py-3 md:hidden">
```

- [ ] **Step 3: Frontend typecheck**

Run:
```bash
cd artifacts/resume-matcher && ../../node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS6305\|TS7006\|TS18046\|TS2322\|TS2345" | head -20
```
Expected: no output. cd back: `cd /Users/himanshu/Git/Resume-AI-Matcher`.

- [ ] **Step 4: Commit**

```bash
git add artifacts/resume-matcher/src/components/layout.tsx
git commit -m "feat(shell): unify mobile chrome on surface-1 token"
```

---

## Task 9: Command palette visual upgrade

**Files:**
- Modify: `artifacts/resume-matcher/src/components/command-palette.tsx`

Already functional. Visual refresh + add Settings section + show kbd hints on result rows.

- [ ] **Step 1: Read the current command palette in full**

Run:
```bash
cat artifacts/resume-matcher/src/components/command-palette.tsx
```

You already have it from context. Confirm content matches the version above.

- [ ] **Step 2: Replace the entire file**

Write the new version of `artifacts/resume-matcher/src/components/command-palette.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useListAnalyses } from "@workspace/api-client-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useDarkMode } from "@/hooks/use-dark-mode";
import {
  Sparkles,
  History,
  BarChart2,
  GitCompareArrows,
  Heart,
  Plus,
  LayoutGrid,
  Fingerprint,
  GitBranch,
  Bookmark,
  Bell,
  UserRound,
  Moon,
  Sun,
} from "lucide-react";

type GoEntry = { label: string; path: string; icon: typeof Plus; kbd?: string };

const PAGES: GoEntry[] = [
  { label: "Optimize / New analysis", path: "/", icon: Plus, kbd: "⌘N" },
  { label: "Tracker", path: "/tracker", icon: LayoutGrid, kbd: "⌘T" },
  { label: "Profile", path: "/user", icon: UserRound },
  { label: "History", path: "/history", icon: History, kbd: "G H" },
  { label: "Stats", path: "/stats", icon: BarChart2, kbd: "G S" },
  { label: "Compare", path: "/compare", icon: GitCompareArrows, kbd: "G C" },
  { label: "Brand", path: "/brand", icon: Fingerprint, kbd: "G B" },
  { label: "Versions", path: "/versions", icon: GitBranch },
  { label: "Saved Jobs", path: "/saved-jobs", icon: Bookmark },
  { label: "Search Alerts", path: "/alerts", icon: Bell },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: analyses } = useListAnalyses();
  const { isDark, toggle } = useDarkMode();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      setLocation(path);
    },
    [setLocation],
  );

  const favorites = analyses?.filter((a) => a.isFavorite) ?? [];
  const recent = analyses?.slice(0, 5) ?? [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search analyses or navigate…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Pages">
          {PAGES.map((p) => (
            <CommandItem
              key={p.path}
              onSelect={() => go(p.path)}
              className="group"
            >
              <p.icon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1">{p.label}</span>
              {p.kbd && (
                <kbd className="ml-2 font-mono text-[10px] text-subtle-foreground">
                  {p.kbd}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        {favorites.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Favorites">
              {favorites.slice(0, 5).map((a) => (
                <CommandItem
                  key={a.id}
                  onSelect={() => go(`/analysis/${a.id}`)}
                >
                  <Heart className="mr-2 h-3.5 w-3.5 fill-destructive text-destructive" />
                  <span className="flex-1 truncate">{a.jobTitle}</span>
                  {a.companyName && (
                    <span className="ml-2 truncate text-[11px] text-muted-foreground">
                      {a.companyName}
                    </span>
                  )}
                  <span className="ml-2 font-mono text-[11px] font-medium tabular-nums">
                    {a.fitScore}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {recent.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent analyses">
              {recent.map((a) => (
                <CommandItem
                  key={a.id}
                  onSelect={() => go(`/analysis/${a.id}`)}
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5 text-accent" />
                  <span className="flex-1 truncate">{a.jobTitle}</span>
                  {a.companyName && (
                    <span className="ml-2 truncate text-[11px] text-muted-foreground">
                      {a.companyName}
                    </span>
                  )}
                  <span className="ml-2 font-mono text-[11px] font-medium tabular-nums">
                    {a.fitScore}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => { setOpen(false); toggle(); }} className="group">
            {isDark ? <Sun className="mr-2 h-3.5 w-3.5" /> : <Moon className="mr-2 h-3.5 w-3.5" />}
            <span className="flex-1">Toggle theme</span>
            <kbd className="ml-2 font-mono text-[10px] text-subtle-foreground">T</kbd>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 3: Frontend typecheck**

Run:
```bash
cd artifacts/resume-matcher && ../../node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS6305\|TS7006\|TS18046\|TS2322\|TS2345" | head -20
```
Expected: no output. cd back: `cd /Users/himanshu/Git/Resume-AI-Matcher`.

- [ ] **Step 4: Commit**

```bash
git add artifacts/resume-matcher/src/components/command-palette.tsx
git commit -m "feat(palette): add Settings group, kbd hints, and expanded Pages list"
```

---

## Task 10: Polish the Shortcuts modal styling

**Files:**
- Modify: `artifacts/resume-matcher/src/components/layout.tsx`

The `ShortcutsModal` (around line 103-154) uses old-style backdrop and color tokens. Re-align to new tokens.

- [ ] **Step 1: Find and replace the modal markup**

Find the `return ( <div className="fixed inset-0 z-50 ..." ` block inside `ShortcutsModal` (around line 115-153). Replace the entire returned JSX (between `return (` and the matching `);`) with:

```tsx
return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div
      className="absolute inset-0 bg-background/80 backdrop-blur-md"
      onClick={onClose}
      aria-hidden
    />
    <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-surface-1 p-5 shadow-lg">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-[13px] font-semibold">Keyboard shortcuts</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="space-y-2">
        {SHORTCUTS.map((shortcut, i) => (
          <li key={i} className="flex items-center justify-between gap-4 text-[12.5px]">
            <span className="text-muted-foreground">{shortcut.description}</span>
            <div className="flex shrink-0 items-center gap-1">
              {shortcut.keys.map((key, j) => (
                <kbd
                  key={j}
                  className="rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-muted-foreground"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-center text-[10.5px] text-subtle-foreground">
        Press Esc or click outside to close
      </p>
    </div>
  </div>
);
```

- [ ] **Step 2: Frontend typecheck**

Run:
```bash
cd artifacts/resume-matcher && ../../node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS6305\|TS7006\|TS18046\|TS2322\|TS2345" | head -20
```
Expected: no output. cd back: `cd /Users/himanshu/Git/Resume-AI-Matcher`.

- [ ] **Step 3: Commit**

```bash
git add artifacts/resume-matcher/src/components/layout.tsx
git commit -m "feat(shell): re-skin Shortcuts modal with new tokens"
```

---

## Task 11: First-run sample-analysis seed

**Files:**
- Create: `artifacts/api-server/src/lib/seed-sample-analysis.ts`
- Modify: `artifacts/api-server/src/index.ts`

When the server boots and finds zero rows in `analyses`, insert one realistic sample row so every screen looks populated for first-time users.

- [ ] **Step 1: Create the seeder module**

Create `artifacts/api-server/src/lib/seed-sample-analysis.ts` with this exact content:

```ts
import { db, analyses } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const SAMPLE_RESUME = `Jane Smith
Senior Frontend Engineer | San Francisco, CA
jane@example.com · linkedin.com/in/janesmith

EXPERIENCE
Senior Frontend Engineer · Lyft · 2022-Present
- Led migration from Redux to TanStack Query across 18 product surfaces, cutting bundle size 22% and reducing average page TTI from 2.1s to 1.4s
- Built design-system primitives (Button, Modal, Combobox) shipped across 3 product teams; adopted by 40+ engineers
- Owned web-vitals dashboard; drove p75 LCP from 3.2s to 1.8s through code-splitting and image-CDN strategy

Frontend Engineer · Coinbase · 2019-2022
- Shipped onboarding redesign that lifted account-creation completion 9 percentage points
- Authored team's React + TypeScript style guide; ran weekly code-review office hours

EDUCATION
B.S. Computer Science · UC Berkeley · 2019

SKILLS
React · TypeScript · Next.js · TanStack Query · Tailwind · Vite · Playwright · Storybook · GraphQL · Node`;

const SAMPLE_JD = `Senior Frontend Engineer at Stripe — Payments Platform

We're hiring a Senior Frontend Engineer to join the Payments Platform team. You will own complex, high-stakes user flows that move billions of dollars annually.

What you'll do:
- Build production React + TypeScript surfaces in our internal design system
- Drive performance: Core Web Vitals, bundle size, perceived latency
- Partner with design and product to prototype, ship, and iterate on payment flows
- Mentor mid-level engineers; raise the bar through code review and tech-spec authorship

What we're looking for:
- 5+ years of production React and TypeScript
- Deep experience with state management at scale (Redux, TanStack Query, etc.)
- Strong opinions on accessibility, performance, and testability
- Familiarity with one of: Next.js, Remix, Vite
- Bonus: GraphQL, Playwright, design-system authoring`;

export function seedSampleAnalysisIfEmpty(): void {
  try {
    const { count } = db.get<{ count: number }>(sql`SELECT COUNT(*) AS count FROM analyses`);
    if (count > 0) return;

    db.insert(analyses).values({
      jobTitle: "Senior Frontend Engineer",
      companyName: "Stripe",
      resumeText: SAMPLE_RESUME,
      originalFileName: "jane_smith_resume.pdf",
      originalFileType: "text",
      jobDescriptionText: SAMPLE_JD,
      fitScore: 87,
      fitRationale:
        "Strong overlap on React + TypeScript at scale, performance focus, and design-system experience. Lyft tenure demonstrates production React + TanStack Query depth that maps directly to the role's stated stack.",
      strengths: [
        "5+ years production React + TypeScript at scale (Lyft, Coinbase)",
        "Documented Core Web Vitals impact (LCP 3.2s → 1.8s)",
        "Design-system primitive ownership adopted by 40+ engineers",
        "Onboarding redesign with measurable conversion lift",
      ],
      gaps: [
        "No explicit GraphQL production experience",
        "No mention of Playwright (listed as bonus)",
        "Next.js / Remix experience not on resume",
      ],
      improvements: [
        "Add the bundle-size reduction (22%) to the resume summary line — it's the highest-impact metric and currently buried in a bullet.",
        "If you have any Playwright or Cypress E2E experience, add a line under Lyft.",
        "Quantify the design-system adoption (\"used by 40+ engineers across 3 teams\") in the summary, not just the bullet.",
      ],
      atsKeywordsMatched: [
        "React",
        "TypeScript",
        "TanStack Query",
        "design system",
        "Core Web Vitals",
        "performance",
        "code review",
      ],
      atsKeywordsMissing: ["Stripe", "GraphQL", "Playwright", "Next.js", "Remix"],
      atsScore: 78,
      status: "not_applied",
      isFavorite: false,
      isPublic: false,
      tags: ["sample", "frontend"],
      portfolioLinks: [],
    });

    logger.info("Seeded sample analysis for first-run experience");
  } catch (err) {
    logger.warn({ err }, "Failed to seed sample analysis; continuing");
  }
}
```

- [ ] **Step 2: Invoke the seeder from server boot**

Modify `artifacts/api-server/src/index.ts`. The current file is:
```ts
import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
```

Replace it with:
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

- [ ] **Step 3: Lib + API server typecheck**

Run:
```bash
./node_modules/.bin/tsc --build 2>&1 | tail -10
```
Expected: ONLY the 6 pre-existing TS2308 errors in `lib/api-zod/src/index.ts`. No errors in `seed-sample-analysis.ts` or `index.ts`.

If `db.get` or `db.insert` typing fails:
- `db.insert(analyses).values(...)` returns a builder — drizzle requires `.run()` to execute. Update the insert to: `db.insert(analyses).values(...).run();`
- `db.get<...>` is correct for better-sqlite3 + drizzle; if it errors, use the lower-level API: `const result = db.run(sql`SELECT COUNT(*) AS count FROM analyses`);` — no, that returns metadata. Actually correct: use `db.select({ count: sql<number>\`COUNT(*)\` }).from(analyses).get()` and check the result.

Concrete fallback if the typing doesn't compile — replace the `try` block with:
```ts
try {
  const result = db.select({ count: sql<number>`COUNT(*)` }).from(analyses).all();
  const count = result[0]?.count ?? 0;
  if (count > 0) return;

  db.insert(analyses).values({
    // ...same fields as before...
  }).run();

  logger.info("Seeded sample analysis for first-run experience");
} catch (err) {
  logger.warn({ err }, "Failed to seed sample analysis; continuing");
}
```

- [ ] **Step 4: Manual smoke test**

Start the api-server (in a separate terminal or backgrounded):
```bash
pnpm --filter @workspace/api-server run dev &
```

In a fresh terminal, hit the health endpoint to confirm boot:
```bash
sleep 3 && curl -s http://localhost:3000/api/healthz | head -c 200
```

The seed should have run on boot. To verify a row was added (or already existed):
```bash
curl -s http://localhost:3000/api/analyses | head -c 400
```

Stop the dev server:
```bash
kill %1 2>/dev/null
```

(If your repo runs the server on a different port, check `artifacts/api-server/src/index.ts` for the PORT default — it's 8080 in source, but check `.env` for overrides.)

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/seed-sample-analysis.ts artifacts/api-server/src/index.ts
git commit -m "feat(api-server): seed sample analysis on first-run for empty DBs"
```

---

## Task 12: Final repo-wide verification

**Files:** (verification only)

- [ ] **Step 1: Typecheck**

Run from repo root:
```bash
./node_modules/.bin/tsc --build 2>&1 | tail -10
```
Expected: ONLY the 6 pre-existing TS2308 errors.

```bash
cd artifacts/resume-matcher && ../../node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS6305\|TS7006\|TS18046\|TS2322\|TS2345" | head -20
```
Expected: no output. cd back: `cd /Users/himanshu/Git/Resume-AI-Matcher`.

- [ ] **Step 2: Visual smoke test**

In one terminal:
```bash
pnpm --filter @workspace/api-server run dev
```

In another:
```bash
cd artifacts/resume-matcher && pnpm run dev
```

Open the printed Vite URL (likely `http://localhost:5173`). Verify:
1. First paint is **dark mode** by default (the body is near-black, the sidebar is even darker)
2. Sidebar is **180px** wide, three groups labeled "Core / Insights / Jobs"
3. Hovering a sidebar item with a `kbd` (e.g. History) shows the kbd hint on the right (`G H`)
4. The desktop topbar is visible above content (it shows "Insights / History" when on `/history`)
5. Press `⌘K` — palette opens with the new Settings group at the bottom including "Toggle theme"
6. Press `⌘?` — Shortcuts modal opens with the new dark backdrop
7. Press `T` (with nothing focused) — theme toggles light/dark
8. Press `⌘\` — sidebar collapses to 52px (icon-only); press again to expand
9. The sample analysis appears in History if the DB was empty when the server booted
10. Switch to light mode — colors invert cleanly, no broken contrast

- [ ] **Step 3: Sanity grep — confirm no orphans**

Run:
```bash
grep -rE "w-64\b" artifacts/resume-matcher/src/components/layout.tsx
```
Expected: no output (sidebar width is now `w-[180px]` / `w-[52px]`).

```bash
grep -rE "bg-grid|graph-paper" artifacts/resume-matcher/src --include="*.tsx" --include="*.css"
```
Expected: no output (the discarded bg-grid experiment is fully gone).

- [ ] **Step 4: Done**

No final commit. The 11 prior commits cover all changes.

---

## Done

11 commits. Foundation tokens replaced, dark-first default, Linear-style sidebar + topbar shell, refreshed command palette + Shortcuts modal, first-run sample-analysis seed. Tier-1 pages inherit the new tokens automatically. Subsequent sub-projects: primitives → tier-2 page rewrites → analysis page restructure.
