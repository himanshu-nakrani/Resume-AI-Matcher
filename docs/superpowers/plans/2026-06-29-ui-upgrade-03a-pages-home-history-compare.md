# UI Upgrade Sub-project 3a: Home + History + Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hand-polish three Tier-2 pages (Home, History, Compare) to apply the new design tokens and primitives from sub-projects 1 & 2. APIs and data flow stay; layout and chrome are reorganized for the Linear/Vercel aesthetic.

**Architecture:** Single PR. Three commits, one per page. Each page rewrite preserves all existing form logic, mutation handlers, localStorage state, URL state, and inner helper components — only the JSX layout and styling change. Reuses primitives (Button, Card, Input, Badge, Empty, ScoreCircle) from sub-project 2.

**Tech Stack:** React 19, Tailwind 4, shadcn/ui, react-hook-form + zod, TanStack Query, wouter routing.

**Parent spec:** [`docs/superpowers/specs/2026-06-28-ui-upgrade-startup-grade-design.md`](../specs/2026-06-28-ui-upgrade-startup-grade-design.md)
**Sub-project spec:** [`docs/superpowers/specs/2026-06-28-ui-upgrade-03a-pages-home-history-compare-design.md`](../specs/2026-06-28-ui-upgrade-03a-pages-home-history-compare-design.md)

---

## Background for the implementing engineer

This sub-project follows:
- **Sub-project 1** (merged): Design tokens, dark-first default, sidebar/topbar shell, first-run sample seed.
- **Sub-project 2** (merged): Primitive components rebuilt — Button, Card (with `padding="sm|default|lg"` prop), Input, Tabs, Badge (with `solid` and `soft` variants), Kbd, Skeleton (shimmer), Empty, ScoreCircle (animated count-up, threshold colors).

**Repo:** pnpm workspace. Branch: `ui/sub-project-3-pages` (already checked out).

**Typecheck command (run after EACH task):**
```bash
pnpm run typecheck
```
Expected: every workspace (`libs`, `api-server`, `mockup-sandbox`, `resume-matcher`, `scripts`) ends with `Done`. The repo is in a clean-typecheck state after PR #14 + PR #15 — your work must preserve that.

**Conventions:**
- Don't change any component API (no breaking signature changes anywhere).
- Don't touch routes, mutations, or data fetching — visual layout only.
- Don't extract components unless the spec says to. The spec only allows extracting from `home.tsx` IF it exceeds 700 lines after the rewrite.
- Use the new Card `padding` prop where helpful (`padding="sm"` for compact filter bars).
- Use new Badge `variant="soft"` + semantic variants for status indicators.
- Use new Empty primitive for empty states (already gives the border + 32px icon tile look).
- Conventional commits, one per task.

---

## File Map

### Files to modify

```
artifacts/resume-matcher/src/pages/home.tsx       — Task 1
artifacts/resume-matcher/src/pages/history.tsx    — Task 2
artifacts/resume-matcher/src/pages/compare.tsx    — Task 3
```

### Files NOT touched

Everything else. Specifically: no changes to `components/ui/*`, no changes to other pages, no routing changes, no api-server / lib changes.

---

## Shared header pattern

Both History and Compare get this pattern. Don't extract — just inline:

```tsx
<header className="flex items-baseline justify-between gap-3 mb-6">
  <div>
    <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
    {subtitle && <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>}
  </div>
  <div className="flex items-center gap-2">{/* right actions */}</div>
</header>
```

Home uses a simpler variant without the right actions slot (no contextual actions on the form-first page).

---

## Task 1: Home page restructure

**Files:**
- Modify: `artifacts/resume-matcher/src/pages/home.tsx`

### Step 1: Read the existing file in full to understand the existing structure

Open `artifacts/resume-matcher/src/pages/home.tsx`. The file is 1006 lines. Key anchors:
- Lines 1-30: imports
- Lines 31-152: helpers (`getHostname`, `cleanJobText`, `jobBadges`, `jobSnippets`, etc.)
- Lines 154-191: `USER_STORAGE_KEY` constant + form schema
- Lines 193-512: `Home()` component setup (form, state, handlers)
- Lines 513-1006: returned JSX

### Step 2: Reorganize the returned JSX

The goal is to keep ALL of the form state, handlers, and helpers untouched, and rewrite ONLY the returned JSX inside `Home()`. Specifically:

1. **New page header** (replaces lines ~514-518):
   ```tsx
   <header className="mb-6">
     <h1 className="text-2xl font-semibold tracking-[-0.02em]">Optimize your resume</h1>
     <p className="text-[13px] text-muted-foreground mt-1">
       Paste your resume and a job to see your fit score and improvement plan.
     </p>
   </header>
   ```

2. **Two-column form layout** (wraps the existing User Information, Target Job, and Resume Upload sections):
   ```tsx
   <Form {...form}>
     <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-24 md:pb-0" data-testid="form-analysis">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* LEFT column: User Information card + Resume Upload card */}
         <div className="space-y-6">
           {/* Move existing User Information <Card> here */}
           {/* Move existing Resume Upload <Card> here */}
         </div>
         {/* RIGHT column: Target Job card */}
         <div className="space-y-6">
           {/* Move existing Target Job <Card> here */}
         </div>
       </div>

       {/* Submit button — desktop in-flow, mobile sticky */}
       <div className="hidden md:flex justify-end">
         <Button type="submit" size="lg" disabled={createAnalysis.isPending} loading={createAnalysis.isPending}>
           Analyze
           <ArrowRight className="ml-1 h-4 w-4" />
         </Button>
       </div>
       <div className="fixed md:hidden bottom-16 left-0 right-0 z-30 border-t border-border bg-surface-1 p-4">
         <Button type="submit" size="lg" className="w-full" disabled={createAnalysis.isPending} loading={createAnalysis.isPending}>
           Analyze
         </Button>
       </div>
     </form>
   </Form>
   ```

   Notes:
   - `pb-24` on the form gives space for the mobile sticky button so content isn't covered.
   - `bottom-16` on mobile button accounts for the bottom-nav (which is 64px = 4rem = 16 Tailwind units).
   - The Card content blocks (User Information, Target Job with company + role + JD textarea, Resume Upload with file dropzone) move INTO their respective columns AS-IS. Don't reformat them.
   - The current `space-y-6` between cards becomes `space-y-6` within each column.

3. **Recent analyses strip** (NEW, between the form and the job search):
   - Add this AFTER the form's closing tag but BEFORE the job search collapsible:
   ```tsx
   {analyses && analyses.length > 0 && (
     <section className="mt-10">
       <h2 className="text-[15px] font-semibold mb-3">Recent analyses</h2>
       <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
         {analyses.slice(0, 5).map((a) => (
           <Card
             key={a.id}
             padding="sm"
             className="shrink-0 w-[200px] cursor-pointer hover:border-border-strong transition-colors"
             onClick={() => setLocation(`/analysis/${a.id}`)}
           >
             <CardContent className="flex items-center gap-3">
               <ScoreCircle score={a.fitScore} size="sm" />
               <div className="min-w-0">
                 <p className="text-[13px] font-medium truncate">{a.jobTitle}</p>
                 {a.companyName && (
                   <p className="text-[11px] text-muted-foreground truncate">{a.companyName}</p>
                 )}
               </div>
             </CardContent>
           </Card>
         ))}
       </div>
     </section>
   )}
   ```
   - `analyses` is already available from `useListAnalyses()` at the top of the component.
   - `setLocation` from `useLocation()` is already imported.
   - `ScoreCircle` is already imported.

4. **Job search collapsible** (wraps the existing Job Search Card):
   - Replace the current Job Search `<Card>` (lines ~599-817) wrapper with a `<details>` element:
   ```tsx
   <details className="mt-10 group">
     <summary className="flex items-center gap-2 cursor-pointer rounded-md border border-border bg-surface-1 px-4 py-3 hover:bg-surface-2 transition-colors marker:hidden list-none">
       <Search className="h-4 w-4 text-muted-foreground" />
       <span className="text-[15px] font-semibold">Find similar roles</span>
       <span className="text-[12px] text-muted-foreground">Search jobs that match your input</span>
       <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
     </summary>
     <div className="mt-3">
       {/* Move the existing Job Search <CardContent> body in here as-is */}
       {/* Strip the wrapping <Card><CardHeader>...</CardHeader><CardContent> and just keep the inner body. */}
     </div>
   </details>
   ```
   - `marker:hidden list-none` hides the default disclosure triangle so the chevron icon is the only indicator.
   - The inner content stays unchanged — the textarea, filters, search button, results list, all of it.

5. **Wrapping container**:
   ```tsx
   return (
     <div className="space-y-0 max-w-5xl mx-auto">
       {/* header */}
       {/* form (two-column) */}
       {/* recent analyses */}
       {/* job search details */}
     </div>
   );
   ```

### Step 3: Verify file size

After the rewrite:
```bash
wc -l artifacts/resume-matcher/src/pages/home.tsx
```

If the file is under 700 lines, leave as-is. If it's over 700 lines, the spec allows extracting inner sections to `pages/home/sections.tsx`. Do not split otherwise — premature extraction is worse than a slightly large file.

### Step 4: Typecheck

```bash
pnpm run typecheck
```
Expected: clean across every workspace.

### Step 5: Commit

```bash
git add artifacts/resume-matcher/src/pages/home.tsx
git commit -m "feat(home): two-column form, recent analyses strip, collapsible job search"
```

If you extracted to `pages/home/sections.tsx`, also stage that:
```bash
git add artifacts/resume-matcher/src/pages/home.tsx artifacts/resume-matcher/src/pages/home/
git commit -m "feat(home): two-column form, recent analyses strip, collapsible job search"
```

---

## Task 2: History page table-first redesign

**Files:**
- Modify: `artifacts/resume-matcher/src/pages/history.tsx`

### Step 1: Read the existing file

`artifacts/resume-matcher/src/pages/history.tsx` is 629 lines. Key anchors:
- Lines 1-46: imports
- Lines 47-77: `STATUS_CONFIG`, `ALL_STATUSES`, `SAVED_SEARCHES_KEY`, types, helpers
- Lines 79-115: `StatusPicker` inner component
- Lines 117-136: `FavoriteButton` inner component
- Lines 138-196: `InlineEdit` inner component
- Lines 198-342: `History()` setup (state, mutations, filtered, statusCounts, exportCSV, save/apply/delete saved searches, selection mutations)
- Lines 343-629: returned JSX

### Step 2: Rewrite the returned JSX

**Keep these inner components unchanged:** `StatusPicker`, `FavoriteButton`, `InlineEdit`. They get reused in both the table and mobile-card layouts.

**Keep these handlers unchanged:** `deleteAnalysis`, `updateAnalysis`, `duplicateAnalysis`, `exportCSV`, `applySavedSearch`, `saveCurrentSearch`, `deleteSavedSearch`, `clearSelection`, `deleteSelected`, `toggleId`.

Replace the entire returned JSX (lines ~343-629) with this structure:

```tsx
return (
  <div className="space-y-6">
    {/* PAGE HEADER */}
    <header className="flex items-baseline justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          Analyses
          {analyses && analyses.length > 0 && (
            <Badge variant="default" size="sm" className="ml-3 align-middle">
              {analyses.length}
            </Badge>
          )}
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          All your resume analyses, most recent first.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {savedSearches.length > 0 && (
          <DropdownMenu open={showSavedSearches} onOpenChange={setShowSavedSearches}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <BookmarkCheck className="w-3.5 h-3.5 mr-1.5" />
                Saved
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Saved searches</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {savedSearches.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                  onSelect={() => applySavedSearch(s)}
                >
                  <span className="flex-1 truncate text-sm">{s.name}</span>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-destructive p-0.5 rounded"
                    onClick={(e) => { e.stopPropagation(); deleteSavedSearch(s.id); }}
                    aria-label="Delete saved search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {filtered.length > 0 && (
          <Button variant="secondary" size="sm" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        )}
      </div>
    </header>

    {/* BULK SELECTION BAR */}
    {selectedIds.size > 0 && (
      <div className="sticky top-12 z-20 -mx-6 -my-2 flex items-center justify-between gap-3 border-b border-border bg-surface-1 px-6 py-2 backdrop-blur-md">
        <span className="text-[13px] text-muted-foreground">{selectedIds.size} selected</span>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={deleteSelected}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete {selectedIds.size}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
        </div>
      </div>
    )}

    {/* FILTER BAR */}
    {analyses && analyses.length > 0 && (
      <Card padding="sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by title or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setStatusFilter("all")}
              className={cn(
                "h-7 rounded-[4px] px-2 text-[11px] font-medium tracking-[0.04em] transition-colors",
                statusFilter === "all"
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
              )}
            >
              All
            </button>
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                className={cn(
                  "h-7 rounded-[4px] px-2 text-[11px] font-medium tracking-[0.04em] transition-colors",
                  statusFilter === s
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
                )}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          <Button
            variant={favoritesOnly ? "default" : "ghost"}
            size="sm"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
          >
            <Heart className={cn("w-3.5 h-3.5 mr-1.5", favoritesOnly && "fill-current")} />
            Favorites
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setFavoritesOnly(false); }}>
              <X className="w-3.5 h-3.5 mr-1.5" />Clear
            </Button>
          )}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={saveCurrentSearch} title="Save this search">
              <Bookmark className="w-3.5 h-3.5 mr-1.5" />Save
            </Button>
          )}
        </CardContent>
      </Card>
    )}

    {/* LOADING STATE */}
    {isLoading && (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 rounded-md" />
        ))}
      </div>
    )}

    {/* EMPTY: NO ANALYSES AT ALL */}
    {!isLoading && analyses && analyses.length === 0 && (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sparkles />
          </EmptyMedia>
          <EmptyTitle>No analyses yet</EmptyTitle>
          <EmptyDescription>
            Paste a resume and a job description on the home page to see your first analysis.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setLocation("/")} data-testid="button-new-analysis">
            Start a new analysis
          </Button>
        </EmptyContent>
      </Empty>
    )}

    {/* EMPTY: NO MATCHES FOR CURRENT FILTERS */}
    {!isLoading && analyses && analyses.length > 0 && filtered.length === 0 && (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No matches</EmptyTitle>
          <EmptyDescription>No analyses match your filters.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="secondary" onClick={() => { setSearch(""); setStatusFilter("all"); setFavoritesOnly(false); }}>
            Clear filters
          </Button>
        </EmptyContent>
      </Empty>
    )}

    {/* DESKTOP TABLE (md+) */}
    {!isLoading && filtered.length > 0 && (
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Title</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Company</th>
              <th className="w-16 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Fit</th>
              <th className="w-16 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">ATS</th>
              <th className="w-32 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Status</th>
              <th className="hidden lg:table-cell w-28 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Created</th>
              <th className="w-12 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const isSampled = (a.tags ?? []).includes("sample");
              return (
                <tr
                  key={a.id}
                  className="border-b border-border hover:bg-surface-2 cursor-pointer group"
                  onClick={() => setLocation(`/analysis/${a.id}`)}
                  title={`Created ${format(new Date(a.createdAt), "PPp")}`}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-border"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleId(a.id)}
                      aria-label="Select row"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FavoriteButton analysisId={a.id} isFavorite={a.isFavorite} />
                      <span className="text-[13px] font-medium truncate">{a.jobTitle}</span>
                      {isSampled && <Badge variant="soft" size="sm">Sample</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[13px] text-muted-foreground truncate">{a.companyName ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[13px]" style={{ color: a.fitScore >= 80 ? "hsl(var(--success))" : a.fitScore >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))" }}>
                    {a.fitScore}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[13px] text-muted-foreground">{a.atsScore}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <StatusPicker analysisId={a.id} currentStatus={a.status} />
                  </td>
                  <td className="hidden lg:table-cell px-3 py-2 text-[12px] text-muted-foreground">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setLocation(`/analysis/${a.id}`)}>
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => duplicateAnalysis.mutate({ id: a.id })}>
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => deleteAnalysis.mutate({ id: a.id })}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}

    {/* MOBILE CARDS (below md) */}
    {!isLoading && filtered.length > 0 && (
      <div className="md:hidden space-y-3">
        {filtered.map((a) => {
          const isSampled = (a.tags ?? []).includes("sample");
          return (
            <Card
              key={a.id}
              padding="sm"
              className="cursor-pointer hover:border-border-strong transition-colors"
              onClick={() => setLocation(`/analysis/${a.id}`)}
            >
              <CardContent className="flex items-start gap-3 p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border shrink-0"
                  checked={selectedIds.has(a.id)}
                  onChange={(e) => { e.stopPropagation(); toggleId(a.id); }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Select row"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-medium truncate">{a.jobTitle}</p>
                        {isSampled && <Badge variant="soft" size="sm">Sample</Badge>}
                      </div>
                      {a.companyName && <p className="text-[12px] text-muted-foreground truncate">{a.companyName}</p>}
                    </div>
                    <FavoriteButton analysisId={a.id} isFavorite={a.isFavorite} />
                  </div>
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="font-mono tabular-nums" style={{ color: a.fitScore >= 80 ? "hsl(var(--success))" : a.fitScore >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))" }}>
                      Fit {a.fitScore}
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">ATS {a.atsScore}</span>
                    <span className="text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <StatusPicker analysisId={a.id} currentStatus={a.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    )}
  </div>
);
```

### Step 3: Auto-clear selection when filter changes

The spec requires `selectedIds` to clear when filters change. Add this useEffect right after the existing state declarations in `History()` (around line 207):

```tsx
useEffect(() => {
  // Drop selections that are no longer visible after filter change.
  setSelectedIds((prev) => {
    const next = new Set<number>();
    for (const id of prev) {
      if (filtered.some((a) => a.id === id)) next.add(id);
    }
    return next.size === prev.size ? prev : next;
  });
}, [filtered]);
```

Confirm `useEffect` is imported from React. If not, add it to the existing react import line.

### Step 4: Add missing imports

Verify these imports are present at the top of the file. Add any that are missing:

```ts
import { useEffect, useMemo, useState, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { MoreHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
```

The existing imports for `Button`, `Input`, `Skeleton`, `DropdownMenu*`, `Bookmark`, `BookmarkCheck`, `ChevronDown`, `Download`, `Filter`, `Heart`, `Search`, `Trash2`, `X` stay.

### Step 5: Remove the old pipeline summary block

The old JSX had a "Pipeline summary" grid (lines ~398-412). It is REMOVED in this redesign — status counts are now visible inline in the filter pill row (via active state) and as a count badge in the header. Make sure you don't accidentally keep it.

### Step 6: Typecheck

```bash
pnpm run typecheck
```
Expected: clean.

### Step 7: Commit

```bash
git add artifacts/resume-matcher/src/pages/history.tsx
git commit -m "feat(history): table-first redesign with mobile cards, bulk-select, sample badge"
```

---

## Task 3: Compare page diff highlighting

**Files:**
- Modify: `artifacts/resume-matcher/src/pages/compare.tsx`

### Step 1: Read the existing file

`artifacts/resume-matcher/src/pages/compare.tsx` is 352 lines. Key anchors:
- Lines 1-26: imports
- Lines 27-53: `ScoreBar` inner component (current implementation uses raw bars)
- Lines 55-228: `AnalysisColumn` inner component
- Lines 230-352: `Compare()` setup + return

### Step 2: Update imports

Add at the top of the file:

```ts
import { ArrowLeftRight, ArrowUp, ArrowDown } from "lucide-react";
```

### Step 3: Replace `ScoreBar` with a score-delta-aware version

Replace the entire `ScoreBar` function (lines 27-53) with:

```tsx
function ScoreBar({ score, label, compareScore }: { score: number; label: string; compareScore?: number }) {
  const color = score >= 80 ? "hsl(var(--success))" : score >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const delta = typeof compareScore === "number" ? score - compareScore : null;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="font-mono tabular-nums text-[20px] font-semibold" style={{ color }}>
            {score}
          </span>
          {delta !== null && delta !== 0 && (
            <Badge variant={delta > 0 ? "success" : "destructive"} size="sm">
              {delta > 0 ? <ArrowUp className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDown className="h-2.5 w-2.5 mr-0.5" />}
              {Math.abs(delta)}
            </Badge>
          )}
        </div>
      </div>
      <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
```

This replaces the old bar implementation with a smaller token-aware bar, mono numerals, and a delta chip when both columns are populated.

### Step 4: Add keyword-set computation in `AnalysisColumn`

`AnalysisColumn` already accepts a `compareId` prop. Inside the component, after the existing analysis fetch (around line 64), add:

```tsx
// Fetch the other analysis for keyword diff highlighting.
const { data: compareAnalysis } = useGetAnalysis(compareId ?? -1, {
  query: { enabled: compareId != null, queryKey: ["analysis", compareId ?? "none"] },
});

const compareMatchedSet = useMemo(
  () => new Set((compareAnalysis?.atsKeywordsMatched as string[] | undefined) ?? []),
  [compareAnalysis?.atsKeywordsMatched],
);
const compareMissingSet = useMemo(
  () => new Set((compareAnalysis?.atsKeywordsMissing as string[] | undefined) ?? []),
  [compareAnalysis?.atsKeywordsMissing],
);
```

If `useMemo` isn't already imported in this file, add it to the React import:
```ts
import { useMemo } from "react";
```

If `useGetAnalysis` is already used elsewhere in the file, reuse the existing import; otherwise check that it's imported from `@workspace/api-client-react`.

### Step 5: Apply diff variants to keyword Badges in `AnalysisColumn`

Find the section that renders `atsKeywordsMatched` in the column (in the existing `AnalysisColumn` JSX). Look for `.atsKeywordsMatched.map(` or similar.

Replace the keyword Badge rendering to add the diff variant. The pattern:

```tsx
{matched.map((kw) => {
  const inOtherColumn = compareMatchedSet.has(kw);
  return (
    <Badge
      key={kw}
      variant={compareId == null ? "default" : inOtherColumn ? "default" : "success"}
      size="sm"
    >
      {kw}
    </Badge>
  );
})}
```

And similarly for missing keywords:

```tsx
{missing.map((kw) => {
  const inOtherColumn = compareMissingSet.has(kw);
  return (
    <Badge
      key={kw}
      variant={compareId == null ? "outline" : inOtherColumn ? "outline" : "warning"}
      size="sm"
    >
      {kw}
    </Badge>
  );
})}
```

The semantics:
- `success` variant on a matched keyword: "your column has this strength and the other doesn't"
- `warning` variant on a missing keyword: "your column has this gap and the other doesn't"
- `default`/`outline` when there's no compare or when both columns share the keyword

### Step 6: Add sticky pane headers

In `AnalysisColumn`'s JSX, wrap the title + ScoreBar block with:

```tsx
<div className="sticky top-12 z-10 bg-background border-b border-border pb-3 -mx-4 px-4 mb-4">
  {/* existing title + score bars go here */}
</div>
```

`top-12` aligns with the desktop topbar (48px = 12 Tailwind units).

### Step 7: Update the `Compare()` page header and selector row

Find the returned JSX of `Compare()` (around line 240). Replace the page header and selector bar with:

```tsx
return (
  <div className="space-y-6">
    <header className="mb-4">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Compare analyses</h1>
      <p className="text-[13px] text-muted-foreground mt-1">
        Side-by-side diff of two resume analyses.
      </p>
    </header>

    <div className="flex items-center gap-3">
      <div className="flex-1">
        <Select value={idA?.toString() ?? ""} onValueChange={(v) => setIdA(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Pick first analysis" />
          </SelectTrigger>
          <SelectContent>
            {analyses?.map((a) => (
              <SelectItem key={a.id} value={a.id.toString()}>
                {a.jobTitle} {a.companyName ? `· ${a.companyName}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => { const tmp = idA; setIdA(idB); setIdB(tmp); }}
        disabled={idA == null || idB == null}
        aria-label="Swap analyses"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </Button>
      <div className="flex-1">
        <Select value={idB?.toString() ?? ""} onValueChange={(v) => setIdB(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Pick second analysis" />
          </SelectTrigger>
          <SelectContent>
            {analyses?.map((a) => (
              <SelectItem key={a.id} value={a.id.toString()}>
                {a.jobTitle} {a.companyName ? `· ${a.companyName}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {idA != null && <AnalysisColumn id={idA} compareId={idB} />}
      {idB != null && <AnalysisColumn id={idB} compareId={idA} />}
    </div>

    {idA == null && idB == null && (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Pick two analyses to compare</EmptyTitle>
          <EmptyDescription>
            Select an analysis on each side to see the diff highlight gaps and shared strengths.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )}
  </div>
);
```

Notes:
- The existing variable names for state (`idA`, `idB`, `setIdA`, `setIdB`) — confirm they match. If the existing file uses different names (e.g. `a`, `b`), keep what's there and adapt this template accordingly.
- The selector row is now a single flex row instead of two stacked Selects.
- The Swap button is the `ArrowLeftRight` icon, disabled when either side is empty.
- An Empty state appears when nothing is selected.

### Step 8: Add any missing imports

```ts
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
```

Some of these are likely already imported; only add what's missing.

### Step 9: Typecheck

```bash
pnpm run typecheck
```
Expected: clean.

### Step 10: Commit

```bash
git add artifacts/resume-matcher/src/pages/compare.tsx
git commit -m "feat(compare): two-pane polish with keyword diff and score deltas"
```

---

## Task 4: Final verification + smoke test

**Files:** (verification only)

### Step 1: Repo-wide typecheck

```bash
pnpm run typecheck
```
Expected: every workspace ends with `Done`.

### Step 2: Smoke test in browser

In two terminals from repo root:
```bash
# Terminal A — api-server
pnpm --filter @workspace/api-server run dev
# Terminal B — frontend
cd artifacts/resume-matcher && pnpm run dev
```

Open the printed Vite URL. Verify:

1. **Home (`/`)**:
   - Two-column form above 1024px (User Info + Resume Upload on left, Target Job on right)
   - Stacks to one column below 768px
   - Mobile shows a sticky Analyze button at the bottom that doesn't cover content
   - Recent analyses strip appears between form and job search (with sample analysis in it)
   - Click a recent-analysis card → navigates to that analysis
   - Job search section is COLLAPSED by default. Click summary → expands. Click again → collapses.
   - Existing job-search internals still work (results render when you search)

2. **History (`/history`)**:
   - Page header: "Analyses · [N total]" + right-aligned Saved / Export buttons
   - Filter bar: search + status pill row + Favorites toggle + Clear/Save (when filters active)
   - Desktop (≥768px): proper `<table>` with hover row highlight, click row to open
   - Tablet (768-1024px): Created column hidden, rest visible
   - Mobile (<768px): cards stacked
   - Bulk-select: tick a row → sticky bar appears with Delete N / Clear
   - Change a filter → selection auto-clears for hidden rows
   - Sample analysis shows a "Sample" badge next to its title
   - Empty filtered state shows Empty primitive with Clear filters button
   - Empty initial state (no analyses at all) shows Empty primitive with Start new analysis button (only visible after clearing the sample, or on a totally empty DB)

3. **Compare (`/compare`)**:
   - Page header with breadcrumb / topbar correct
   - Selector row: two Selects with Swap (↔) icon between them
   - Swap button is disabled until both sides are populated; click it to swap
   - Sticky pane headers stay visible when scrolling either column
   - Score deltas: when both columns populated, show ▲/▼ chips with absolute value
   - Keyword diff: success-tinted Badges on column A for matched-only-in-A, warning-tinted on column A for missing-only-in-A (same logic for B)
   - When idA + idB both null: Empty state appears

### Step 3: Sanity greps

```bash
# Confirm legacy patterns are gone
grep -nE "border-dashed" artifacts/resume-matcher/src/pages/history.tsx
grep -nE "ring-2 ring-offset-1 ring-current" artifacts/resume-matcher/src/pages/history.tsx
grep -nE "rounded-xl" artifacts/resume-matcher/src/pages/history.tsx | grep -v "rounded-xl\b.*Skeleton"
grep -nE "Pipeline summary" artifacts/resume-matcher/src/pages/history.tsx
```
Each should return empty (the dashed border, fluid ring, large radii, and old summary block are all gone).

```bash
# Confirm new patterns landed
grep -c '<table' artifacts/resume-matcher/src/pages/history.tsx                       # 1
grep -c "tags ?? \\[\\]).includes(\"sample\")" artifacts/resume-matcher/src/pages/history.tsx   # 2 (table + mobile card)
grep -c "<details" artifacts/resume-matcher/src/pages/home.tsx                        # 1
grep -c "ArrowLeftRight" artifacts/resume-matcher/src/pages/compare.tsx               # 2 (import + usage)
grep -c "compareMatchedSet\\|compareMissingSet" artifacts/resume-matcher/src/pages/compare.tsx  # 4+ (definition + usage)
```

### Step 4: Done

No final commit. The 3 prior commits cover all changes.

---

## Done

3 commits. Home, History, Compare are all hand-polished. Next sub-projects:
- **3b** — Stats + Board + Brand polish
- **4** — Analysis page tabbed restructure
