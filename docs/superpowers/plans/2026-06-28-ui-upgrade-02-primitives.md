# UI Upgrade Sub-project 2: Primitive Components Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle 10 primitive components (Button, Card, Input, Textarea, Select, Tabs, Badge, Kbd, Skeleton, Tooltip, Empty, ScoreCircle) to apply the dark-first indigo token system from sub-project 1. APIs preserved; no call-site changes needed.

**Architecture:** Single PR. Edits are independent per component file — each task rewrites one primitive top-to-bottom and commits. ScoreCircle additionally adds a count-up animation. One new CSS keyframe (`skeleton-shimmer`) is added to `index.css`.

**Tech Stack:** Tailwind 4, shadcn/ui (Radix primitives), `class-variance-authority`, React 19, TypeScript.

**Parent spec:** [`docs/superpowers/specs/2026-06-28-ui-upgrade-startup-grade-design.md`](../specs/2026-06-28-ui-upgrade-startup-grade-design.md)
**Sub-project spec:** [`docs/superpowers/specs/2026-06-28-ui-upgrade-02-primitives-design.md`](../specs/2026-06-28-ui-upgrade-02-primitives-design.md)

---

## Background for the implementing engineer

This sub-project follows sub-project 1, which already landed the new design tokens (`--surface-1/2/3`, `--border-strong`, `--subtle-foreground`, `--accent`, `--accent-soft`, `--duration*`, `--ease`) and Tailwind theme mappings (`bg-surface-2`, `text-subtle-foreground`, `border-border-strong`, etc. are all valid utility classes).

**Repo:** pnpm workspace. Branch: `ui/sub-project-2-primitives` (already checked out).

**Typecheck command (run after each task):**
```bash
pnpm run typecheck
```
Expected: every workspace ends with `Done`. Sub-project 1 + PR #14 (DX cleanup) merged to main and the repo is in a clean-typecheck state. This plan must preserve that.

**Component conventions in this repo:**
- shadcn-style components using `cva()` for variants where there are multiple visual modes.
- `cn()` from `@/lib/utils` for className composition.
- `React.forwardRef` everywhere a ref is needed.
- `data-slot=` attributes on shadcn-generated components (preserve them when restyling).

**Constraints:**
- Do NOT change any public API. Existing variant names stay valid even when their styling changes.
- New variants/props are ADDITIVE only.
- No new dependencies.
- Don't touch consumers; pages and components outside `components/ui/` and `components/score-circle.tsx` are out of scope.
- Stay on branch `ui/sub-project-2-primitives`.

---

## File Map

### Files to modify

```
artifacts/resume-matcher/src/index.css                            — add @keyframes skeleton-shimmer
artifacts/resume-matcher/src/components/ui/button.tsx             — Task 1
artifacts/resume-matcher/src/components/ui/card.tsx               — Task 2
artifacts/resume-matcher/src/components/ui/input.tsx              — Task 3
artifacts/resume-matcher/src/components/ui/textarea.tsx           — Task 3
artifacts/resume-matcher/src/components/ui/select.tsx             — Task 3
artifacts/resume-matcher/src/components/ui/tabs.tsx               — Task 4
artifacts/resume-matcher/src/components/ui/badge.tsx              — Task 5
artifacts/resume-matcher/src/components/ui/kbd.tsx                — Task 6
artifacts/resume-matcher/src/components/ui/tooltip.tsx            — Task 6
artifacts/resume-matcher/src/components/ui/skeleton.tsx           — Task 7
artifacts/resume-matcher/src/components/ui/empty.tsx              — Task 8
artifacts/resume-matcher/src/components/score-circle.tsx          — Task 9
```

### Files NOT modified

Anything outside `components/ui/` and the single `score-circle.tsx` is out of scope. Pages, hooks, and api-server code stay untouched.

---

## Task 1: Rebuild Button

**Files:**
- Modify: `artifacts/resume-matcher/src/components/ui/button.tsx`

- [ ] **Step 1: Replace the whole file**

Open `artifacts/resume-matcher/src/components/ui/button.tsx` and replace its full contents with:

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-foreground hover:bg-accent/90",
        secondary:
          "bg-surface-2 text-foreground hover:bg-surface-3",
        ghost:
          "text-foreground hover:bg-surface-2",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-2",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link:
          "text-accent underline-offset-4 hover:underline",
        success:
          "bg-success text-success-foreground hover:bg-success/90",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90",
        info:
          "bg-info text-info-foreground hover:bg-info/90",
      },
      size: {
        default: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
        sm: "h-7 px-2.5 text-[12px] [&_svg]:size-3",
        lg: "h-10 px-5 text-[14px] [&_svg]:size-4",
        icon: "h-8 w-8 [&_svg]:size-3.5",
        "icon-sm": "h-7 w-7 [&_svg]:size-3",
        "icon-lg": "h-10 w-10 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        <span
          className={cn(
            "inline-flex items-center gap-2",
            loading && "invisible",
          )}
        >
          {children}
        </span>
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg
              className="h-3.5 w-3.5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}
      </Comp>
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

Notes:
- The `relative` on the base + an `absolute` spinner overlay preserves button width when loading.
- The inner `<span>` wraps children so we can `invisible` it without disturbing layout.
- `asChild` + `loading=true`: the `Slot` will still receive the wrapper span as its only child, which can confuse Radix Slot's single-child contract. **If a consumer uses both `asChild` and `loading`**, document that loading is ignored. (Practically: no current consumer does this. The pattern doesn't need a runtime warning.)

- [ ] **Step 2: Typecheck**

```bash
pnpm run typecheck
```
Expected: `Done` for every workspace.

- [ ] **Step 3: Commit**

```bash
git add artifacts/resume-matcher/src/components/ui/button.tsx
git commit -m "feat(button): resize and restyle for new tokens, preserve width when loading"
```

---

## Task 2: Card with optional padding prop

**Files:**
- Modify: `artifacts/resume-matcher/src/components/ui/card.tsx`

- [ ] **Step 1: Replace the whole file**

Open `artifacts/resume-matcher/src/components/ui/card.tsx` and replace its full contents with:

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

type CardPadding = "sm" | "default" | "lg"

const PADDING_VARS: Record<CardPadding, string> = {
  sm: "[--card-padding:0.75rem]",       // 12px
  default: "[--card-padding:1rem]",     // 16px
  lg: "[--card-padding:1.5rem]",        // 24px
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = "default", ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground border border-border rounded-lg",
        PADDING_VARS[padding],
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-header"
    className={cn(
      "flex flex-col space-y-1.5 p-[var(--card-padding,1rem)]",
      className,
    )}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-title"
    className={cn("text-[15px] font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-description"
    className={cn("text-[13px] text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-content"
    className={cn("p-[var(--card-padding,1rem)] pt-0", className)}
    {...props}
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-footer"
    className={cn("flex items-center p-[var(--card-padding,1rem)] pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
```

The CSS variable `--card-padding` is set on the Card root by the chosen padding option, and consumed by Header/Content/Footer via `p-[var(--card-padding,1rem)]`. Default behavior matches the previous `p-4` everywhere.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm run typecheck
git add artifacts/resume-matcher/src/components/ui/card.tsx
git commit -m "feat(card): add padding=sm/default/lg via CSS var, tighter typography"
```

---

## Task 3: Input + Textarea + Select trigger

**Files:**
- Modify: `artifacts/resume-matcher/src/components/ui/input.tsx`
- Modify: `artifacts/resume-matcher/src/components/ui/textarea.tsx`
- Modify: `artifacts/resume-matcher/src/components/ui/select.tsx`

- [ ] **Step 1: Replace `input.tsx`**

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          "flex h-8 w-full rounded-md border border-border bg-surface-3 px-2.5 text-[13px] text-foreground transition-colors",
          "file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-foreground",
          "placeholder:text-subtle-foreground",
          "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[error=true]:border-destructive data-[error=true]:focus-visible:ring-destructive/20",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
```

- [ ] **Step 2: Replace `textarea.tsx`**

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-border bg-surface-3 px-2.5 py-2 text-[13px] text-foreground transition-colors",
        "placeholder:text-subtle-foreground",
        "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[error=true]:border-destructive data-[error=true]:focus-visible:ring-destructive/20",
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
```

- [ ] **Step 3: Update `SelectTrigger` className in `select.tsx`**

Find the `SelectTrigger` definition (around line 18-30). Replace ONLY the `className` value of `<SelectPrimitive.Trigger>` from the old `cn(...)` argument to:

```ts
cn(
  "flex h-8 w-full items-center justify-between whitespace-nowrap rounded-md border border-border bg-surface-3 px-2.5 text-[13px] text-foreground transition-colors",
  "data-[placeholder]:text-subtle-foreground",
  "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "data-[error=true]:border-destructive data-[error=true]:focus:ring-destructive/20",
  "[&>span]:line-clamp-1",
  className,
)
```

Leave every other export in `select.tsx` (SelectContent, SelectItem, etc.) untouched.

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm run typecheck
git add artifacts/resume-matcher/src/components/ui/input.tsx \
        artifacts/resume-matcher/src/components/ui/textarea.tsx \
        artifacts/resume-matcher/src/components/ui/select.tsx
git commit -m "feat(input): tighter h-8 on surface-3 with accent focus ring; share styling across input/textarea/select"
```

---

## Task 4: Tabs — Linear underline

**Files:**
- Modify: `artifacts/resume-matcher/src/components/ui/tabs.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    data-slot="tabs-list"
    className={cn(
      "inline-flex h-9 items-center gap-4 border-b border-border",
      className,
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-slot="tabs-trigger"
    className={cn(
      "inline-flex h-9 items-center justify-center whitespace-nowrap border-b-2 border-transparent px-1 pb-2 text-[13px] font-medium text-muted-foreground transition-colors",
      "hover:text-foreground",
      "focus-visible:outline-none focus-visible:text-foreground",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:border-accent data-[state=active]:text-foreground",
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    data-slot="tabs-content"
    className={cn(
      "mt-4 focus-visible:outline-none",
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm run typecheck
git add artifacts/resume-matcher/src/components/ui/tabs.tsx
git commit -m "feat(tabs): replace pill with Linear-style underline"
```

---

## Task 5: Badge — squared with solid/soft variants

**Files:**
- Modify: `artifacts/resume-matcher/src/components/ui/badge.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[4px] border font-medium tracking-[0.04em] transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "border-border bg-surface-2 text-foreground",
        outline:
          "border-border bg-transparent text-foreground",
        solid:
          "border-transparent bg-accent text-accent-foreground",
        soft:
          "border-transparent bg-accent-soft text-accent",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        success:
          "border-transparent bg-[hsl(var(--success)/0.12)] text-success",
        warning:
          "border-transparent bg-[hsl(var(--warning)/0.12)] text-warning",
        info:
          "border-transparent bg-[hsl(var(--info)/0.12)] text-info",
      },
      size: {
        sm: "h-4 px-1.5 text-[10px]",
        default: "h-5 px-1.5 text-[10.5px]",
        lg: "h-6 px-2 text-[11px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode
  onRemove?: () => void
}

function Badge({
  className,
  variant,
  size,
  icon,
  onRemove,
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors hover:bg-surface-2"
          aria-label="Remove"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-2.5 w-2.5"
            aria-hidden
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}

export { Badge, badgeVariants }
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm run typecheck
git add artifacts/resume-matcher/src/components/ui/badge.tsx
git commit -m "feat(badge): squared shape, add solid/soft variants, semantic vars switch to soft style"
```

---

## Task 6: Kbd + Tooltip restyle

**Files:**
- Modify: `artifacts/resume-matcher/src/components/ui/kbd.tsx`
- Modify: `artifacts/resume-matcher/src/components/ui/tooltip.tsx`

- [ ] **Step 1: Replace `kbd.tsx`**

```tsx
import { cn } from "@/lib/utils"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground",
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background [[data-slot=tooltip-content]_&]:border-transparent dark:[[data-slot=tooltip-content]_&]:bg-background/10",
        className,
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
```

- [ ] **Step 2: Replace `tooltip.tsx`**

```tsx
"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md border border-border-strong bg-surface-3 px-3 py-1.5 text-xs text-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm run typecheck
git add artifacts/resume-matcher/src/components/ui/kbd.tsx \
        artifacts/resume-matcher/src/components/ui/tooltip.tsx
git commit -m "feat(kbd,tooltip): switch to surface-2/3 with border-strong outlines"
```

---

## Task 7: Skeleton — shimmer animation

**Files:**
- Modify: `artifacts/resume-matcher/src/index.css`
- Modify: `artifacts/resume-matcher/src/components/ui/skeleton.tsx`

- [ ] **Step 1: Add the `@keyframes skeleton-shimmer` rule to `index.css`**

Open `artifacts/resume-matcher/src/index.css`. Find the existing `@layer utilities` block (search for `@layer utilities`). Just before the closing `}` of that `@layer utilities` block, add:

```css
  @keyframes skeleton-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
```

If you can't find `@layer utilities`, append the keyframe at the bottom of the file outside any `@layer`:

```css
@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Either placement works for Tailwind 4 — the keyframe is referenced by the arbitrary-value class `animate-[skeleton-shimmer_1.2s_linear_infinite]` in the Skeleton component below.

- [ ] **Step 2: Replace `skeleton.tsx`**

```tsx
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-[linear-gradient(90deg,hsl(var(--surface-2))_25%,hsl(var(--surface-3))_50%,hsl(var(--surface-2))_75%)] bg-[length:200%_100%] animate-[skeleton-shimmer_1.2s_linear_infinite]",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm run typecheck
git add artifacts/resume-matcher/src/index.css \
        artifacts/resume-matcher/src/components/ui/skeleton.tsx
git commit -m "feat(skeleton): shimmer gradient over surface-2/3 instead of pulse"
```

---

## Task 8: Empty — re-skin

**Files:**
- Modify: `artifacts/resume-matcher/src/components/ui/empty.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-5 text-balance rounded-lg border border-border p-6 text-center md:p-10",
        className,
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        "flex max-w-sm flex-col items-center gap-2 text-center",
        className,
      )}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-surface-2 text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn("text-[15px] font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "max-w-[60ch] text-[13px] text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full min-w-0 max-w-sm flex-col items-center gap-3 text-balance text-[13px]",
        className,
      )}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm run typecheck
git add artifacts/resume-matcher/src/components/ui/empty.tsx
git commit -m "feat(empty): solid border, 32px icon tile on surface-2, tighter typography"
```

---

## Task 9: ScoreCircle — animated count-up

**Files:**
- Modify: `artifacts/resume-matcher/src/components/score-circle.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
import { useEffect, useRef, useState } from "react";

interface ScoreCircleProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const SIZE_MAP = {
  sm: { radius: 20, stroke: 4, text: "text-sm", container: "w-12 h-12" },
  md: { radius: 36, stroke: 6, text: "text-2xl", container: "w-24 h-24" },
  lg: { radius: 54, stroke: 6, text: "text-4xl", container: "w-36 h-36" },
} as const;

function colorForScore(score: number): string {
  if (score === 0) return "hsl(var(--muted-foreground))";
  if (score >= 80) return "hsl(var(--success))";
  if (score >= 60) return "hsl(var(--warning))";
  return "hsl(var(--destructive))";
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

const COUNT_UP_DURATION_MS = 200;

export function ScoreCircle({ score, size = "md", label }: ScoreCircleProps) {
  const { radius, stroke, text, container } = SIZE_MAP[size];
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const [displayScore, setDisplayScore] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplayScore(score);
      return;
    }
    const start = performance.now();
    const from = 0;
    const to = score;
    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / COUNT_UP_DURATION_MS, 1);
      const eased = easeOutExpo(t);
      setDisplayScore(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [score]);

  const color = colorForScore(score);
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;
  const rounded = Math.round(displayScore);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${container} flex items-center justify-center`}>
        <svg height="100%" width="100%" className="absolute inset-0 -rotate-90">
          <circle
            stroke="hsl(var(--surface-2))"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx="50%"
            cy="50%"
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx="50%"
            cy="50%"
          />
        </svg>
        <span
          className={`relative z-10 font-mono font-semibold tabular-nums ${text}`}
          style={{ color }}
        >
          {rounded}
        </span>
      </div>
      {label && (
        <span className="text-[12.5px] font-medium text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm run typecheck
git add artifacts/resume-matcher/src/components/score-circle.tsx
git commit -m "feat(score-circle): token-driven colors, mono numbers, 200ms count-up"
```

---

## Task 10: Final verification

**Files:** (verification only)

- [ ] **Step 1: Repo-wide typecheck**

```bash
pnpm run typecheck
```
Expected: every workspace reports `Done`. No errors.

- [ ] **Step 2: Sanity grep for old patterns**

```bash
grep -rE "bg-muted text-foreground" artifacts/resume-matcher/src/components/ui --include="*.tsx" | grep -v "select.tsx:.*SelectItem\|popover\|hover-card" | head -10
```
Expected: empty or short. (Some primitives we DIDN'T touch — like `select.tsx` for SelectItem, `popover.tsx`, `hover-card.tsx` — may still use older patterns. They're out of scope.)

```bash
grep -rE "rounded-full" artifacts/resume-matcher/src/components/ui/badge.tsx
```
Expected: empty (Badge is now squared).

```bash
grep -rE "border-dashed" artifacts/resume-matcher/src/components/ui/empty.tsx
```
Expected: empty.

```bash
grep -rE "animate-pulse" artifacts/resume-matcher/src/components/ui/skeleton.tsx
```
Expected: empty.

- [ ] **Step 3: Smoke test in browser**

In two terminals from repo root:
```bash
# Terminal A — api-server
pnpm --filter @workspace/api-server run dev
# Terminal B — frontend
cd artifacts/resume-matcher && pnpm run dev
```

Open the Vite URL (defaults to `http://localhost:5173`). Verify:
1. **Buttons** — Click "Cover letter" or any other primary button. It should look like a solid indigo button. Hover changes shade. Press it; if it has a loading state, the width doesn't shift.
2. **Inputs** — Type in any text field. Background is a slightly different shade than the page background; focus shows a 2px indigo ring.
3. **Badges** — Open History; the status chips should be squared (rounded-[4px]) not pills.
4. **Tabs** — Open the NotificationsPanel (bell icon in sidebar). The tabs at the top should have an underline indicator on the active tab (no background pill).
5. **Tooltips** — Hover any tooltipped element. Background is the surface-3 tone with a subtle border.
6. **Skeletons** — While loading the analyses list on History, the skeleton blocks should have a left-to-right shimmer, not a fade pulse.
7. **Empty states** — On a clean DB (after running the seed), navigate to `/saved-jobs` or `/alerts`. The Empty card should have a solid border (no dashes), a small 32px icon tile.
8. **ScoreCircle** — Open an analysis. The ring should animate from 0 to the final score on mount; the number should be mono.

- [ ] **Step 4: Done**

No final commit. The 9 prior commits cover all primitive changes.

---

## Done

9 commits. All 10 primitives + 1 component (ScoreCircle) + 1 CSS keyframe are restyled. Every consumer page gets the new look without modification.

Next sub-projects:
- **3** — Hand-polished page rewrites (Home, History, Stats, Board, Compare, Brand)
- **4** — Analysis page tabbed restructure
