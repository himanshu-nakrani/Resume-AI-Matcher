import { useParams } from "wouter";
import { useGetSharedAnalysis } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ChevronRight,
  FileText,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return stringArray(parsed);
    } catch {
      return [trimmed];
    }

    return [trimmed];
  }

  return [];
}

function safeScore(value: unknown): number {
  const score = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.min(100, Math.max(0, score));
}

function formatAnalyzedAt(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return "Analysis date unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Analysis date unavailable";
  }

  return `Analyzed ${formatDistanceToNow(date, { addSuffix: true })}`;
}

function EmptyLine({ children }: { children: string }) {
  return (
    <p className="rounded-md bg-surface-2 px-3 py-2 text-[13px] text-muted-foreground">
      {children}
    </p>
  );
}

function InsightList({
  items,
  empty,
  icon,
}: {
  items: string[];
  empty: string;
  icon: "success" | "danger" | "accent";
}) {
  if (items.length === 0) return <EmptyLine>{empty}</EmptyLine>;

  const Icon = icon === "danger" ? XCircle : icon === "success" ? CheckCircle2 : ChevronRight;
  const color =
    icon === "danger"
      ? "text-destructive"
      : icon === "success"
        ? "text-success"
        : "text-accent";

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className="flex items-start gap-2 text-[13px] leading-6">
          <Icon className={`mt-1 h-3.5 w-3.5 shrink-0 ${color}`} />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function KeywordGroup({
  label,
  keywords,
  empty,
  tone,
}: {
  label: string;
  keywords: string[];
  empty: string;
  tone: "success" | "danger";
}) {
  const labelClass = tone === "success" ? "text-success" : "text-destructive";
  const badgeClass =
    tone === "success"
      ? "border-success/30 bg-success/10 text-success"
      : "border-destructive/30 bg-destructive/10 text-destructive";

  return (
    <div>
      <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wider ${labelClass}`}>
        {label}
      </p>
      {keywords.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <Badge key={`${keyword}-${index}`} variant="outline" className={badgeClass}>
              {keyword}
            </Badge>
          ))}
        </div>
      ) : (
        <EmptyLine>{empty}</EmptyLine>
      )}
    </div>
  );
}

export function SharedAnalysis() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data: analysis, isLoading, isError } = useGetSharedAnalysis(token, {
    query: { enabled: !!token, queryKey: ["shared", token] },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 text-foreground">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-7 w-28" />
          </div>
          <Skeleton className="h-36 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
          </div>
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (isError || !analysis) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-xl">
          <Empty className="bg-surface-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertCircle />
              </EmptyMedia>
              <EmptyTitle>Analysis not found</EmptyTitle>
              <EmptyDescription>
                This shared analysis is no longer public, or the link is invalid.
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild variant="outline">
              <a href="/">Open OptiMatch</a>
            </Button>
          </Empty>
        </div>
      </div>
    );
  }

  const strengths = stringArray(analysis.strengths);
  const gaps = stringArray(analysis.gaps);
  const improvements = stringArray(analysis.improvements);
  const atsMatched = stringArray(analysis.atsKeywordsMatched);
  const atsMissing = stringArray(analysis.atsKeywordsMissing);
  const fitScore = safeScore(analysis.fitScore);
  const atsScore = safeScore(analysis.atsScore);
  const analyzedAt = formatAnalyzedAt(analysis.createdAt);
  const company = typeof analysis.companyName === "string" ? analysis.companyName.trim() : "";
  const fitRationale =
    typeof analysis.fitRationale === "string" && analysis.fitRationale.trim()
      ? analysis.fitRationale.trim()
      : "No fit rationale was returned for this shared analysis.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-surface-1/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-foreground">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">OptiMatch</span>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[11px]">
            Public analysis
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <section className="mb-5 rounded-lg border border-border bg-surface-1 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-2">
              <Badge variant="outline" className="w-fit text-[11px]">
                Shared resume match
              </Badge>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {analysis.jobTitle || "Untitled role"}
                </h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {company ? `${company} · ${analyzedAt}` : analyzedAt}
                </p>
              </div>
              <p className="max-w-3xl text-[13px] leading-6 text-muted-foreground">
                Public snapshot of the resume fit, ATS readiness, gaps, and next edits for this job target.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:w-[300px]">
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <ScoreCircle score={fitScore} size="md" label="Fit score" />
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <ScoreCircle score={atsScore} size="md" label="ATS score" />
              </div>
            </div>
          </div>
        </section>

        <div className="mb-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-border bg-surface-1 pb-3">
              <CardTitle>Fit rationale</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-[13px] leading-6 text-muted-foreground">{fitRationale}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="border-b border-border bg-surface-1 pb-3">
              <CardTitle>ATS readiness</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-[13px] leading-6 text-muted-foreground">
                The ATS score estimates how well this resume aligns with automated screening signals for the role.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InsightList
                items={strengths}
                empty="No strengths were returned for this shared analysis."
                icon="success"
              />
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" /> Gaps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InsightList
                items={gaps}
                empty="No gaps were returned for this shared analysis."
                icon="danger"
              />
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-warning" /> Resume improvements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InsightList
              items={improvements}
              empty="No improvement recommendations were returned for this shared analysis."
              icon="accent"
            />
          </CardContent>
        </Card>

        <Card className="mt-4 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>ATS keywords</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <KeywordGroup
              label="Matched"
              keywords={atsMatched}
              empty="No matched ATS keywords were returned."
              tone="success"
            />
            <KeywordGroup
              label="Missing"
              keywords={atsMissing}
              empty="No missing ATS keywords were returned."
              tone="danger"
            />
          </CardContent>
        </Card>

        {analysis.coverLetter && (
          <Card className="mt-4 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" /> Cover letter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-md bg-surface-2 p-4 font-mono text-[12px] leading-6 text-muted-foreground">
                {analysis.coverLetter}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="py-6 text-center text-xs text-muted-foreground">
          Created with <span className="font-semibold text-foreground">OptiMatch</span>
        </p>
      </main>
    </div>
  );
}
