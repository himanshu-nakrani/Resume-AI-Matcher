# UI Upgrade Sub-project 4: Analysis Page Tabbed Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single 1431-line `pages/analysis.tsx` into a folder of focused files with a sticky-header + tabbed interface (Overview · Cover Letter · LinkedIn · Pipeline · Notes). URL state via `?tab=` query param. APIs unchanged.

**Architecture:** Pure structural refactor — no behavioral changes. Three commits: (1) scaffold the folder with the shell + shared.tsx, (2) port Overview tab, (3) port the remaining four tabs and delete the old file. Each commit must typecheck cleanly.

**Tech Stack:** React 19, Tailwind 4, shadcn/ui Tabs (Linear underline from sub-project 2), wouter routing, TanStack Query.

**Parent spec:** `docs/superpowers/specs/2026-06-28-ui-upgrade-startup-grade-design.md`
**Sub-project spec:** `docs/superpowers/specs/2026-06-29-ui-upgrade-04-analysis-tabbed-design.md`

---

## Background

This follows sub-projects 1, 2, 3a, and 3b — all merged. Branch: `ui/sub-project-4-analysis`.

The current `artifacts/resume-matcher/src/pages/analysis.tsx` is 1431 lines and contains:

| Lines | Content |
|---|---|
| 1-62 | Imports |
| 64-66 | `CoverLetterTone` type + `TONE_OPTIONS` |
| 165-505 | `JobTrackingSection` (deadline, contact, follow-up, tags, portfolio, version, location, salary expectation) |
| 507-589 | `BulletRewriter` |
| 591-643 | `NotesSection` |
| 645-733 | `ShareSection` |
| 735-746 | `CHECKLIST_ITEMS` |
| 748-808 | `InterviewChecklist` |
| 811-1431 | `Analysis()` shell + the long JSX return |

Inside the JSX return:

| Lines | Section |
|---|---|
| 954-1060 | Header (back, title, company, time, chips, action row) |
| 1062-1104 | Optimized LaTeX card (conditional) |
| 1106-1122 | Scores grid (Fit + ATS) |
| 1124-1165 | Strengths & Gaps grid |
| 1167-1186 | Resume Improvements |
| 1188-1233 | ATS Keywords |
| 1235-1251 | `<JobTrackingSection>` mount |
| 1253-1254 | `<InterviewChecklist>` mount |
| 1256-1257 | `<NotesSection>` mount |
| 1259-1260 | `<BulletRewriter>` mount |
| 1262-1376 | Cover Letter card |
| 1378-1428 | LinkedIn Post card |

**Important:** all `data-testid` attributes in the existing JSX must be preserved unchanged in the new files. Tests select on these.

**Typecheck command (after each task):**
```bash
pnpm run typecheck
```
Every workspace must end with `Done`.

**Conventions:**
- One commit per task with the exact message specified.
- Don't change any mutation, hook, or fetch logic — only relocate and restructure.
- Don't edit `App.tsx`. The folder's `index.tsx` becomes the resolution target.
- Don't touch any other page or component.

---

## File Map

```
artifacts/resume-matcher/src/pages/analysis/        (NEW folder)
├── index.tsx               (NEW) — shell: useGetAnalysis, sticky header w/ action row, Tabs switcher, 5 TabsContent mounts
├── overview-tab.tsx        (NEW) — Optimized LaTeX, scores, strengths/gaps, improvements, ATS, BulletRewriter, InterviewChecklist
├── cover-letter-tab.tsx    (NEW) — tone selector + generate + display + variation
├── linkedin-tab.tsx        (NEW) — generate + display
├── pipeline-tab.tsx        (NEW) — JobTrackingSection mount
├── notes-tab.tsx           (NEW) — NotesSection mount
└── shared.tsx              (NEW) — JobTrackingSection, BulletRewriter, NotesSection, ShareSection, InterviewChecklist, TONE_OPTIONS, CHECKLIST_ITEMS, CoverLetterTone type

artifacts/resume-matcher/src/pages/analysis.tsx     (DELETED at end of Task 3)
```

`App.tsx` already imports `Analysis` from `@/pages/analysis`. Since Node/Vite resolve `@/pages/analysis` → `pages/analysis/index.tsx` when `pages/analysis.tsx` is removed and `pages/analysis/index.tsx` exists, the route wires up automatically. **Verify this resolution by running the dev server during Task 3.**

---

## Task 1: Scaffold the folder — shared.tsx + empty index.tsx + tab stubs

**Files:**
- Create: `artifacts/resume-matcher/src/pages/analysis/shared.tsx`
- Create: `artifacts/resume-matcher/src/pages/analysis/index.tsx`
- Create: `artifacts/resume-matcher/src/pages/analysis/overview-tab.tsx`
- Create: `artifacts/resume-matcher/src/pages/analysis/cover-letter-tab.tsx`
- Create: `artifacts/resume-matcher/src/pages/analysis/linkedin-tab.tsx`
- Create: `artifacts/resume-matcher/src/pages/analysis/pipeline-tab.tsx`
- Create: `artifacts/resume-matcher/src/pages/analysis/notes-tab.tsx`
- Modify: `artifacts/resume-matcher/src/pages/analysis.tsx` (stays intact during this commit; both old file and new folder coexist for one commit)

The old `analysis.tsx` continues to be the route target during Task 1 (because no `index.tsx` is rendered until App.tsx routing resolves a folder). To make the new index.tsx the target, we must DELETE `analysis.tsx` — but doing that in Task 1 with empty tab stubs would break the app. So in Task 1, we create the new folder with placeholder content that ISN'T routed yet; in Task 3 we delete the old file.

Actually, Vite/TS module resolution prefers `analysis.tsx` over `analysis/index.tsx` when both exist (the `.tsx` file wins). So during Task 1 and Task 2, the old file is still the route target. The new files exist only to be imported in subsequent tasks. The switchover happens in Task 3 when `analysis.tsx` is deleted.

### Step 1: Create `shared.tsx` with copied helper components

Create `artifacts/resume-matcher/src/pages/analysis/shared.tsx`. Copy these blocks from `artifacts/resume-matcher/src/pages/analysis.tsx`:

- Lines 64-66 (`CoverLetterTone` type)
- Lines 66-74 (`TONE_OPTIONS` constant — the full array)
- Lines 165-505 (`JobTrackingSection` function — copy in full)
- Lines 507-589 (`BulletRewriter` function — copy in full)
- Lines 591-643 (`NotesSection` function — copy in full)
- Lines 645-733 (`ShareSection` function — copy in full)
- Lines 735-746 (`CHECKLIST_ITEMS` constant — copy in full)
- Lines 748-808 (`InterviewChecklist` function — copy in full)

The file structure of `shared.tsx`:

```tsx
// Imports — copy whatever the moved functions reference. Most likely:
import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAnalysisQueryKey,
  useUpdateAnalysis,
  useRewriteBullet,
  useShareAnalysis,
  useUnshareAnalysis,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCopy } from "@/hooks/use-copy";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, CalendarClock, User, Mail, Tag, DollarSign, Link2, X, Plus, Building2,
  Wand2, ArrowRightLeft, Sparkles, ClipboardCheck, StickyNote, Share2, Copy, Check,
  ExternalLink, EyeOff, Send,
} from "lucide-react";
import { format } from "date-fns";

// ==== Cover Letter tones ====
export type CoverLetterTone = "professional" | "friendly" | "enthusiastic" | "concise";

export const TONE_OPTIONS: { value: CoverLetterTone; label: string; desc: string }[] = [
  // ...copy exact entries from analysis.tsx lines 66-74
];

// ==== Checklist items ====
export const CHECKLIST_ITEMS = [
  // ...copy exact entries from analysis.tsx lines 735-746
];

// ==== Components ====
export function JobTrackingSection({ analysisId, analysis }: { /* ...exact props from current */ }) {
  // ...copy verbatim from lines 165-505
}

export function BulletRewriter({ analysisId }: { analysisId: number }) {
  // ...copy verbatim from lines 507-589
}

export function NotesSection({ analysisId, initialNotes }: { analysisId: number; initialNotes: string | null }) {
  // ...copy verbatim from lines 591-643
}

export function ShareSection({ analysisId, isPublic, shareToken }: { analysisId: number; isPublic: boolean; shareToken: string | null }) {
  // ...copy verbatim from lines 645-733
}

export function InterviewChecklist({ analysisId }: { analysisId: number }) {
  // ...copy verbatim from lines 748-808
}
```

**CRITICAL: copy the function bodies EXACTLY.** Don't rewrite, don't refactor, don't drop any `data-testid`. The point of Task 1 is to mechanically move code, not to change it.

The icon imports in the snippet above are a starting point. Run the typecheck after writing and add any missing icons that the copied components reference.

### Step 2: Create placeholder `index.tsx`

Create `artifacts/resume-matcher/src/pages/analysis/index.tsx` with a placeholder that re-exports the old route's component:

```tsx
// Placeholder for sub-project 4 Task 1. The actual tabbed shell is implemented in Task 3.
// Until then, the parent pages/analysis.tsx is the route target.
export { Analysis } from "../analysis";
```

This file isn't routed yet but its existence ensures no broken import paths in Tasks 2 and 3.

### Step 3: Create placeholder tab files

Each tab file is a stub for now. Create:

`artifacts/resume-matcher/src/pages/analysis/overview-tab.tsx`:
```tsx
import type { Analysis } from "@workspace/api-client-react";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function OverviewTab({ analysis: _analysis, id: _id }: TabProps) {
  return <div>Overview placeholder</div>;
}
```

`artifacts/resume-matcher/src/pages/analysis/cover-letter-tab.tsx`:
```tsx
import type { Analysis } from "@workspace/api-client-react";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function CoverLetterTab({ analysis: _analysis, id: _id }: TabProps) {
  return <div>Cover letter placeholder</div>;
}
```

`artifacts/resume-matcher/src/pages/analysis/linkedin-tab.tsx`:
```tsx
import type { Analysis } from "@workspace/api-client-react";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function LinkedInTab({ analysis: _analysis, id: _id }: TabProps) {
  return <div>LinkedIn placeholder</div>;
}
```

`artifacts/resume-matcher/src/pages/analysis/pipeline-tab.tsx`:
```tsx
import type { Analysis } from "@workspace/api-client-react";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function PipelineTab({ analysis: _analysis, id: _id }: TabProps) {
  return <div>Pipeline placeholder</div>;
}
```

`artifacts/resume-matcher/src/pages/analysis/notes-tab.tsx`:
```tsx
import type { Analysis } from "@workspace/api-client-react";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function NotesTab({ analysis: _analysis, id: _id }: TabProps) {
  return <div>Notes placeholder</div>;
}
```

If `import type { Analysis } from "@workspace/api-client-react"` doesn't resolve, the type may be exported under a different name (likely `Analysis` since the schema is named that). Check by:
```bash
grep -rE "export (type|interface) Analysis\\b" lib/api-zod/src/generated/types/
```
Use whatever the actual name is.

### Step 4: Typecheck

```bash
pnpm run typecheck
```

Expected: every workspace ends with `Done`. If `shared.tsx` has unresolved imports, add them. If a referenced symbol is missing, copy it from the original.

### Step 5: Commit

```bash
git add artifacts/resume-matcher/src/pages/analysis/
git commit -m "refactor(analysis): scaffold pages/analysis/ folder with shared components"
```

The old `pages/analysis.tsx` remains intact and continues to render the route. The new folder is created but not yet routed.

---

## Task 2: Port the Overview tab

**Files:**
- Modify: `artifacts/resume-matcher/src/pages/analysis/overview-tab.tsx`

### Step 1: Replace the overview-tab.tsx stub

Replace the entire content of `artifacts/resume-matcher/src/pages/analysis/overview-tab.tsx` with the Overview tab's full implementation. The content comes from `pages/analysis.tsx` lines 1062-1233 + the bullet rewriter and interview checklist mounts at 1253, 1259-1260, restyled and consolidated.

Reference what to copy:

| From `pages/analysis.tsx` lines | What |
|---|---|
| 1062-1104 | Optimized LaTeX Card (conditional on `analysis.optimizedLatex`) |
| 1107-1122 | Scores grid (Fit + ATS in 2-col Card layout) |
| 1124-1165 | Strengths & Gaps grid |
| 1167-1186 | Resume Improvements |
| 1188-1233 | ATS Keywords |
| 1259-1260 | `<BulletRewriter analysisId={id} />` mount |
| 1253-1254 | `<InterviewChecklist analysisId={id} />` mount |

Write the file:

```tsx
import { useState } from "react";
import type { Analysis } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCopy } from "@/hooks/use-copy";
import { useToast } from "@/hooks/use-toast";
import { DEEPSEEK_KEY_STORAGE_KEY } from "@/lib/deepseek-storage";
import {
  CheckCircle2, XCircle, Lightbulb, ChevronRight, FileText, Copy, Check, Download,
} from "lucide-react";
import { BulletRewriter, InterviewChecklist } from "./shared";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function OverviewTab({ analysis, id }: TabProps) {
  const { copy, isCopied } = useCopy();
  const { toast } = useToast();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const strengths = (analysis.strengths as string[]) ?? [];
  const gaps = (analysis.gaps as string[]) ?? [];
  const improvements = (analysis.improvements as string[]) ?? [];
  const atsMatched = (analysis.atsKeywordsMatched as string[]) ?? [];
  const atsMissing = (analysis.atsKeywordsMissing as string[]) ?? [];
  const optimizedLatex = (analysis as { optimizedLatex?: string | null }).optimizedLatex ?? null;

  const safeFileName = (parts: Array<string | null | undefined>, ext: string) => {
    const base = parts
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `${base || "resume"}.${ext}`;
  };

  const downloadTextFile = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadOptimizedPdf = async () => {
    if (!optimizedLatex) {
      toast({ title: "PDF unavailable", description: "This analysis does not have optimized LaTeX to compile.", variant: "destructive" });
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const deepseekKey = localStorage.getItem(DEEPSEEK_KEY_STORAGE_KEY)?.trim();
      const response = await fetch(`/api/analyses/${id}/resume.pdf`, {
        headers: {
          Accept: "application/pdf, application/json",
          ...(deepseekKey ? { "X-DeepSeek-Api-Key": deepseekKey } : {}),
        },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not compile optimized resume PDF.");
      }
      const blob = await response.blob();
      const fileName = safeFileName([analysis.companyName, analysis.jobTitle], "pdf");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "PDF downloaded", description: "Validated by AI, then compiled from optimized LaTeX." });
    } catch (err) {
      toast({
        title: "Could not download PDF",
        description: err instanceof Error ? err.message : "Could not compile optimized resume PDF.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {optimizedLatex && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[15px] flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-accent" /> Optimized resume LaTeX
              </CardTitle>
              <div className="flex gap-2 no-print">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(optimizedLatex, "Optimized LaTeX copied")}
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    downloadTextFile(
                      optimizedLatex,
                      safeFileName([analysis.companyName, analysis.jobTitle], "tex"),
                    )
                  }
                >
                  Download LaTeX
                </Button>
                <Button
                  size="sm"
                  onClick={downloadOptimizedPdf}
                  disabled={isDownloadingPdf}
                  data-testid="button-export-pdf"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  {isDownloadingPdf ? "Validating…" : "PDF"}
                </Button>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground mt-1">
              AI-tailored LaTeX resume for {analysis.companyName ?? "this company"} and {analysis.jobTitle}.
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              value={optimizedLatex}
              readOnly
              className="min-h-[360px] font-mono text-[12px] resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-3 no-print">
              Download PDF validates and repairs this optimized LaTeX with AI, then compiles it on the API server.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-2">
            <ScoreCircle score={analysis.fitScore} size="lg" label="Fit Score" />
            <p className="text-[13px] text-muted-foreground text-center max-w-xs mt-2">
              {analysis.fitRationale}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-2">
            <ScoreCircle score={analysis.atsScore} size="lg" label="ATS Score" />
            <p className="text-[13px] text-muted-foreground text-center max-w-xs mt-2">
              How well your resume passes automated applicant tracking systems.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Strengths & Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Strengths
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {strengths.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No strengths identified.</p>
            ) : (
              strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px]" data-testid={`strength-${i}`}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] flex items-center gap-2">
              <XCircle className="w-3.5 h-3.5 text-destructive" /> Gaps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {gaps.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No critical gaps identified.</p>
            ) : (
              gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px]" data-testid={`gap-${i}`}>
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                  <span>{g}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Improvements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-warning" /> Resume improvements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {improvements.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No improvement suggestions.</p>
          ) : (
            improvements.map((imp, i) => (
              <div key={i} className="flex items-start gap-3 text-[13px] p-3 rounded-md bg-surface-2" data-testid={`improvement-${i}`}>
                <ChevronRight className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                <span>{imp}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ATS Keywords */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px]">ATS keywords</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground mb-2">Matched</p>
            <div className="flex flex-wrap gap-2">
              {atsMatched.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">None matched</p>
              ) : (
                atsMatched.map((kw, i) => (
                  <Badge
                    key={i}
                    variant="success"
                    size="sm"
                    data-testid={`keyword-matched-${i}`}
                  >
                    {kw}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground mb-2">Missing</p>
            <div className="flex flex-wrap gap-2">
              {atsMissing.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No missing keywords</p>
              ) : (
                atsMissing.map((kw, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    size="sm"
                    data-testid={`keyword-missing-${i}`}
                  >
                    {kw}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bullet rewriter */}
      <BulletRewriter analysisId={id} />

      {/* Interview checklist */}
      <InterviewChecklist analysisId={id} />
    </div>
  );
}
```

Notes:
- The Optimized LaTeX section includes its own PDF download button, since the action is contextual to this content.
- The Strengths/Gaps and Improvements sections use semantic-soft Badge variants (`success`, `destructive`, `warning`-colored icons) instead of ad-hoc Tailwind color classes.
- ATS Keywords use the new Badge `success`/`outline` variants instead of ad-hoc green/rose tints.
- Each `data-testid` from the original JSX is preserved.

### Step 2: Typecheck

```bash
pnpm run typecheck
```

Fix any unresolved imports or missing references. The Analysis type from `@workspace/api-client-react` may not include the optional `optimizedLatex` field — the `(analysis as { optimizedLatex?: string | null }).optimizedLatex ?? null` cast handles this.

### Step 3: Commit

```bash
git add artifacts/resume-matcher/src/pages/analysis/overview-tab.tsx
git commit -m "feat(analysis): port Overview tab content"
```

The old `pages/analysis.tsx` is still the route target; the new overview-tab.tsx isn't rendered yet.

---

## Task 3: Port remaining tabs, build shell, delete old file

**Files:**
- Modify: `artifacts/resume-matcher/src/pages/analysis/cover-letter-tab.tsx`
- Modify: `artifacts/resume-matcher/src/pages/analysis/linkedin-tab.tsx`
- Modify: `artifacts/resume-matcher/src/pages/analysis/pipeline-tab.tsx`
- Modify: `artifacts/resume-matcher/src/pages/analysis/notes-tab.tsx`
- Modify: `artifacts/resume-matcher/src/pages/analysis/index.tsx` (replace placeholder with the real shell)
- Delete: `artifacts/resume-matcher/src/pages/analysis.tsx`

### Step 1: Implement `cover-letter-tab.tsx`

Replace the entire content with:

```tsx
import { useState } from "react";
import type { Analysis } from "@workspace/api-client-react";
import {
  useGenerateCoverLetter,
  getGetAnalysisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/hooks/use-copy";
import { FileText, Copy, Check, Sparkles, Wand2 } from "lucide-react";
import { TONE_OPTIONS, type CoverLetterTone } from "./shared";
import { cn } from "@/lib/utils";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function CoverLetterTab({ analysis, id }: TabProps) {
  const { copy, isCopied } = useCopy();
  const queryClient = useQueryClient();
  const [coverLetterTone, setCoverLetterTone] = useState<CoverLetterTone>("professional");
  const [coverLetterVariation, setCoverLetterVariation] = useState<string | null>(null);

  const generateCoverLetter = useGenerateCoverLetter({
    mutation: {
      onSuccess: (data) => {
        if (generateCoverLetter.variables?.data?.tone !== coverLetterTone) {
          setCoverLetterVariation(data.content);
        } else {
          queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
        }
      },
    },
  });

  const generateVariation = () => {
    const currentIndex = TONE_OPTIONS.findIndex((t) => t.value === coverLetterTone);
    const nextTone = TONE_OPTIONS[(currentIndex + 1) % TONE_OPTIONS.length].value;
    generateCoverLetter.mutate({ id, data: { tone: nextTone } });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px] flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-accent" /> Tailored cover letter
          </CardTitle>
          <div className="flex gap-2 no-print">
            {analysis.coverLetter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(analysis.coverLetter!, "Cover letter copied")}
                data-testid="button-copy-cover-letter"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                Copy
              </Button>
            )}
            <Button
              size="sm"
              variant={analysis.coverLetter ? "secondary" : "default"}
              onClick={() => generateCoverLetter.mutate({ id, data: { tone: coverLetterTone } })}
              disabled={generateCoverLetter.isPending}
              data-testid="button-generate-cover-letter"
            >
              {generateCoverLetter.isPending ? "Generating…" : analysis.coverLetter ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>
        <div className="mt-4 no-print">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground mb-2">Tone</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TONE_OPTIONS.map((tone) => (
              <button
                key={tone.value}
                onClick={() => setCoverLetterTone(tone.value)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left transition-colors",
                  coverLetterTone === tone.value
                    ? "border-accent bg-accent-soft"
                    : "border-border hover:border-border-strong",
                )}
                data-testid={`tone-${tone.value}`}
              >
                <p className={cn("text-[12px] font-semibold", coverLetterTone === tone.value && "text-accent")}>
                  {tone.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{tone.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {generateCoverLetter.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : analysis.coverLetter ? (
          <>
            <Textarea
              value={analysis.coverLetter}
              readOnly
              className="min-h-[300px] font-mono text-[13px] resize-none"
              data-testid="textarea-cover-letter"
            />
            <div className="pt-2 flex flex-col gap-4">
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={generateVariation}
                disabled={generateCoverLetter.isPending}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Generate 2nd variation
              </Button>
              {coverLetterVariation && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-subtle-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Wand2 className="w-3 h-3" /> Alternative variation
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copy(coverLetterVariation, "Variation copied")}
                    >
                      {isCopied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      Copy variation
                    </Button>
                  </div>
                  <Textarea
                    value={coverLetterVariation}
                    readOnly
                    className="min-h-[300px] font-mono text-[13px] resize-none border-accent/30 bg-accent-soft"
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground py-4">
            Select a tone above, then click "Generate" to create a tailored cover letter.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 2: Implement `linkedin-tab.tsx`

Replace content with:

```tsx
import type { Analysis } from "@workspace/api-client-react";
import {
  useGenerateLinkedinPost,
  getGetAnalysisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/hooks/use-copy";
import { Linkedin, Copy, Check } from "lucide-react";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function LinkedInTab({ analysis, id }: TabProps) {
  const { copy, isCopied } = useCopy();
  const queryClient = useQueryClient();

  const generateLinkedinPost = useGenerateLinkedinPost({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) }),
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px] flex items-center gap-2">
            <Linkedin className="w-3.5 h-3.5 text-accent" /> LinkedIn post
          </CardTitle>
          <div className="flex gap-2 no-print">
            {analysis.linkedinPost && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(analysis.linkedinPost!, "LinkedIn post copied")}
                data-testid="button-copy-linkedin"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                Copy
              </Button>
            )}
            <Button
              size="sm"
              variant={analysis.linkedinPost ? "secondary" : "default"}
              onClick={() => generateLinkedinPost.mutate({ id })}
              disabled={generateLinkedinPost.isPending}
              data-testid="button-generate-linkedin"
            >
              {generateLinkedinPost.isPending ? "Generating…" : analysis.linkedinPost ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {generateLinkedinPost.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : analysis.linkedinPost ? (
          <Textarea
            value={analysis.linkedinPost}
            readOnly
            className="min-h-[180px] text-[13px] resize-none"
            data-testid="textarea-linkedin"
          />
        ) : (
          <p className="text-[13px] text-muted-foreground py-4">
            Click "Generate" to create a LinkedIn announcement for this role.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 3: Implement `pipeline-tab.tsx`

Replace content with:

```tsx
import type { Analysis } from "@workspace/api-client-react";
import { JobTrackingSection } from "./shared";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function PipelineTab({ analysis, id }: TabProps) {
  return (
    <JobTrackingSection
      analysisId={id}
      analysis={{
        deadline: analysis.deadline ?? null,
        contactName: analysis.contactName ?? null,
        contactEmail: analysis.contactEmail ?? null,
        followUpDate: analysis.followUpDate ?? null,
        tags: (analysis.tags as string[]) ?? [],
        portfolioLinks: (analysis.portfolioLinks as string[]) ?? [],
        jobTitle: analysis.jobTitle,
        companyName: analysis.companyName ?? null,
        versionLabel: (analysis as { versionLabel?: string | null }).versionLabel ?? null,
        location: (analysis as { location?: string | null }).location ?? null,
        salaryExpectation: (analysis as { salaryExpectation?: string | null }).salaryExpectation ?? null,
      }}
    />
  );
}
```

### Step 4: Implement `notes-tab.tsx`

Replace content with:

```tsx
import type { Analysis } from "@workspace/api-client-react";
import { NotesSection } from "./shared";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function NotesTab({ analysis, id }: TabProps) {
  return <NotesSection analysisId={id} initialNotes={analysis.notes ?? null} />;
}
```

### Step 5: Implement the shell `index.tsx`

Replace the placeholder with the full shell:

```tsx
import { useParams, useLocation, useSearch } from "wouter";
import {
  useGetAnalysis,
  getGetAnalysisQueryKey,
  useDeleteAnalysis,
  useUpdateAnalysis,
  useDuplicateAnalysis,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Heart, Trash2, GitCompareArrows, CalendarClock, Tag,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ShareSection } from "./shared";
import { OverviewTab } from "./overview-tab";
import { CoverLetterTab } from "./cover-letter-tab";
import { LinkedInTab } from "./linkedin-tab";
import { PipelineTab } from "./pipeline-tab";
import { NotesTab } from "./notes-tab";

const TAB_VALUES = ["overview", "cover-letter", "linkedin", "pipeline", "notes"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null | undefined): v is TabValue {
  return v != null && (TAB_VALUES as readonly string[]).includes(v);
}

export function Analysis() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: analysis, isLoading } = useGetAnalysis(id, {
    query: { enabled: !!id, queryKey: getGetAnalysisQueryKey(id) },
  });

  const tabParam = new URLSearchParams(search).get("tab");
  const activeTab: TabValue = isTabValue(tabParam) ? tabParam : "overview";
  const setTab = (next: string) => {
    setLocation(`/analysis/${id}?tab=${next}`, { replace: true });
  };

  const deleteAnalysis = useDeleteAnalysis({
    mutation: { onSuccess: () => setLocation("/") },
  });

  const updateAnalysis = useUpdateAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) }),
    },
  });

  const duplicateAnalysis = useDuplicateAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
        toast({ title: "Analysis duplicated", description: "Opening the copy now." });
        setLocation(`/analysis/${data.id}`);
      },
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-20">
        <p className="text-[13px] text-muted-foreground">Analysis not found.</p>
        <Button variant="secondary" className="mt-4" onClick={() => setLocation("/")}>
          Go back
        </Button>
      </div>
    );
  }

  const isSampled = ((analysis.tags as string[] | undefined) ?? []).includes("sample");

  return (
    <div className="space-y-0" data-testid={`analysis-${id}`}>
      <Tabs value={activeTab} onValueChange={setTab}>
        <div className="sticky top-12 z-10 bg-background border-b border-border pb-3 mb-6 -mx-6 px-6">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-2 transition-colors no-print"
            data-testid="button-back"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{analysis.jobTitle}</h1>
                {isSampled && <Badge variant="soft" size="sm">Sample</Badge>}
              </div>
              {analysis.companyName && (
                <p className="text-[13px] text-muted-foreground mt-0.5">{analysis.companyName}</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {analysis.deadline && (
                  <Badge variant="warning" size="sm">
                    <CalendarClock className="w-3 h-3 mr-1" />
                    Due {format(new Date(analysis.deadline), "MMM d")}
                  </Badge>
                )}
                {analysis.followUpDate && (
                  <Badge variant="info" size="sm">
                    <CalendarClock className="w-3 h-3 mr-1" />
                    Follow-up {format(new Date(analysis.followUpDate), "MMM d")}
                  </Badge>
                )}
                {Array.isArray(analysis.tags) &&
                  (analysis.tags as string[])
                    .filter((tag) => tag !== "sample")
                    .map((tag) => (
                      <Badge key={tag} variant="soft" size="sm">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end no-print">
              <Button
                variant="ghost"
                size="sm"
                className={analysis.isFavorite ? "text-destructive" : "text-muted-foreground"}
                onClick={() => updateAnalysis.mutate({ id, data: { isFavorite: !analysis.isFavorite } })}
                data-testid="button-favorite"
              >
                <Heart className={`w-3.5 h-3.5 ${analysis.isFavorite ? "fill-destructive" : ""}`} />
              </Button>
              <ShareSection
                analysisId={id}
                isPublic={analysis.isPublic ?? false}
                shareToken={analysis.shareToken ?? null}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => duplicateAnalysis.mutate({ id })}
                disabled={duplicateAnalysis.isPending}
                title="Duplicate this analysis"
              >
                <GitCompareArrows className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => deleteAnalysis.mutate({ id })}
                disabled={deleteAnalysis.isPending}
                data-testid="button-delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <TabsList className="mt-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cover-letter">Cover Letter</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview"><OverviewTab analysis={analysis} id={id} /></TabsContent>
        <TabsContent value="cover-letter"><CoverLetterTab analysis={analysis} id={id} /></TabsContent>
        <TabsContent value="linkedin"><LinkedInTab analysis={analysis} id={id} /></TabsContent>
        <TabsContent value="pipeline"><PipelineTab analysis={analysis} id={id} /></TabsContent>
        <TabsContent value="notes"><NotesTab analysis={analysis} id={id} /></TabsContent>
      </Tabs>
    </div>
  );
}
```

If `useSearch` is not exported from `wouter`, fall back to reading `window.location.search` with a listener. To check:
```bash
grep -E "export.*useSearch" node_modules/wouter/index.d.ts
```
If absent, use this drop-in:
```tsx
function useSearch(): string {
  const [search, setSearch] = useState(() => window.location.search);
  useEffect(() => {
    const update = () => setSearch(window.location.search);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return search;
}
```

### Step 6: Delete the old file

```bash
rm artifacts/resume-matcher/src/pages/analysis.tsx
```

Now `@/pages/analysis` resolves to `pages/analysis/index.tsx` and the new shell renders.

### Step 7: Verify file sizes

```bash
wc -l artifacts/resume-matcher/src/pages/analysis/*.tsx
```

Each tab file should be under 600 lines. If `overview-tab.tsx` is over 600 lines, extract Strengths/Gaps/Improvements/ATS Keywords into a co-located sub-component.

### Step 8: Typecheck

```bash
pnpm run typecheck
```

Expected: every workspace `Done`. If errors appear:
- Missing imports → add them
- `useSearch` missing → use the drop-in above
- `Analysis` type from `@workspace/api-client-react` doesn't have a field → cast inline: `(analysis as { fieldName?: string }).fieldName`

### Step 9: Smoke test (recommended)

```bash
pnpm --filter @workspace/api-server run dev &
cd artifacts/resume-matcher && pnpm run dev
```

Open `http://localhost:5173/analysis/1` (assuming the seeded sample exists). Verify:
1. Sticky header shows title, company, time, action buttons.
2. 5 tabs visible. Overview is default.
3. Clicking a tab updates URL to `?tab=cover-letter` etc. Browser back/forward toggles tabs.
4. Each tab renders its content.
5. Generate / regenerate buttons in Cover Letter and LinkedIn tabs work.
6. JobTracking inputs in Pipeline tab still save.
7. Notes tab autosaves.
8. Favorite, Duplicate, Delete, Share buttons in the header work.

Stop the servers when done.

### Step 10: Commit

```bash
git add artifacts/resume-matcher/src/pages/analysis/ artifacts/resume-matcher/src/pages/analysis.tsx
git commit -m "feat(analysis): tab shell, port remaining tabs, delete old single-file page"
```

`git status` after commit should be clean. If there are stray modifications (pnpm-workspace.yaml, .env, .sqlite-wal), do NOT include them.

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
# Old file is gone
test ! -e artifacts/resume-matcher/src/pages/analysis.tsx && echo OK || echo "STILL EXISTS"

# New folder structure exists
ls artifacts/resume-matcher/src/pages/analysis/

# Routing import unchanged
grep -E "from \"@/pages/analysis\"" artifacts/resume-matcher/src/App.tsx

# data-testid preserved across moves
grep -rE "data-testid=\"(analysis-|button-back|button-favorite|button-delete|button-export-pdf|button-copy-cover-letter|button-generate-cover-letter|button-copy-linkedin|button-generate-linkedin|textarea-cover-letter|textarea-linkedin|strength-|gap-|improvement-|keyword-matched-|keyword-missing-|tone-)" artifacts/resume-matcher/src/pages/analysis/ | head -20

# Tabs primitive is used
grep -c "TabsList\\|TabsTrigger\\|TabsContent" artifacts/resume-matcher/src/pages/analysis/index.tsx
# Expected: at least 3 (5 triggers + 5 contents + 1 list = ~11 actually)
```

### Step 3: Push and PR

```bash
git push -u origin ui/sub-project-4-analysis
gh pr create --base main --head ui/sub-project-4-analysis --title "UI upgrade · sub-project 4: Analysis page tabbed restructure" --body "$(cat <<'PRBODY'
## Summary

Last sub-project in the UI upgrade. Splits the 1431-line pages/analysis.tsx into a folder with shell + 5 tabs (Overview · Cover Letter · LinkedIn · Pipeline · Notes) + shared.tsx. URL state via ?tab= query param.

**Parent spec:** docs/superpowers/specs/2026-06-28-ui-upgrade-startup-grade-design.md
**Sub-project spec:** docs/superpowers/specs/2026-06-29-ui-upgrade-04-analysis-tabbed-design.md
**Plan:** docs/superpowers/plans/2026-06-29-ui-upgrade-04-analysis-tabbed.md

## What changed

- `pages/analysis.tsx` (1431 lines) → `pages/analysis/` folder (7 files)
- Sticky header with title, company, action row, and Linear-style underline tab switcher
- URL state via `?tab=` (default `overview`); back/forward toggles tabs
- No App.tsx change (folder index resolves the route automatically)
- All data-testid attributes preserved

## Commits (3)
- refactor(analysis): scaffold pages/analysis/ folder with shared components
- feat(analysis): port Overview tab content
- feat(analysis): tab shell, port remaining tabs, delete old single-file page

## Test plan

- [ ] pnpm run typecheck clean across all workspaces
- [ ] /analysis/:id defaults to Overview tab
- [ ] Clicking Cover Letter/LinkedIn/Pipeline/Notes updates ?tab= and back/forward navigates
- [ ] Cover Letter generate + regenerate + variation flow works
- [ ] LinkedIn generate works
- [ ] Pipeline saves deadline/contact/portfolio/tags
- [ ] Notes autosaves
- [ ] Header actions (Favorite, Share, Duplicate, Delete) work
- [ ] Sample badge appears for the seeded sample analysis

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

### Step 4: Done

No final commit. The 3 prior commits cover all changes.

---

## Done

3 commits, 7 new files, 1 deleted file. The UI upgrade Phase 2 is complete (sub-projects 1-4 all merged or in flight).

Next remaining work from the original "implement 1-12" plan:
- **Phase 3 items 8-12**: testing, CI, AI hardening, observability, migrations
