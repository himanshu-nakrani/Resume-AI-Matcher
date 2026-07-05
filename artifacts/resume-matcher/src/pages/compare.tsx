import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useListAnalyses,
  useGetAnalysis,
  getGetAnalysisQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  GitCompareArrows,
  AlertCircle,
  PlusCircle,
  RefreshCw,
} from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { unknownErrorMessage } from "@/lib/api-error";
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
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : 0;
}

function dateValue(value: unknown): Date | null {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function relativeDate(value: unknown): string {
  const date = dateValue(value);
  return date
    ? formatDistanceToNow(date, { addSuffix: true })
    : "Date unavailable";
}

function ScoreBar({
  score,
  label,
  compareScore,
}: {
  score: number;
  label: string;
  compareScore?: number;
}) {
  const boundedScore = safeScore(score);
  const color =
    boundedScore >= 80
      ? "hsl(var(--success))"
      : boundedScore >= 60
        ? "hsl(var(--warning))"
        : "hsl(var(--destructive))";
  const delta =
    typeof compareScore === "number" ? boundedScore - compareScore : null;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
          {label}
        </span>
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono tabular-nums text-[20px] font-semibold"
            style={{ color }}
          >
            {boundedScore}
          </span>
          {delta !== null && delta !== 0 && (
            <Badge variant={delta > 0 ? "success" : "destructive"} size="sm">
              {delta > 0 ? (
                <ArrowUp className="h-2.5 w-2.5 mr-0.5" />
              ) : (
                <ArrowDown className="h-2.5 w-2.5 mr-0.5" />
              )}
              {Math.abs(delta)}
            </Badge>
          )}
        </div>
      </div>
      <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${boundedScore}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function AnalysisColumn({
  id,
  compareId,
}: {
  id: number;
  compareId?: number | null;
}) {
  const { data, isLoading, isError, error } = useGetAnalysis(id, {
    query: { enabled: !!id, queryKey: getGetAnalysisQueryKey(id) },
  });
  const { data: compareData } = useGetAnalysis(compareId ?? 0, {
    query: {
      enabled: !!compareId,
      queryKey: getGetAnalysisQueryKey(compareId ?? 0),
    },
  });

  const compareMatchedSet = useMemo(
    () => new Set(stringArray(compareData?.atsKeywordsMatched)),
    [compareData?.atsKeywordsMatched],
  );
  const compareMissingSet = useMemo(
    () => new Set(stringArray(compareData?.atsKeywordsMissing)),
    [compareData?.atsKeywordsMissing],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-36 rounded-md" />
        <Skeleton className="h-36 rounded-md" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold">Could not load analysis</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {unknownErrorMessage(error)}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const strengths = stringArray(data.strengths);
  const gaps = stringArray(data.gaps);
  const atsMatched = stringArray(data.atsKeywordsMatched);
  const atsMissing = stringArray(data.atsKeywordsMissing);
  const compareStrengths = stringArray(compareData?.strengths);
  const compareGaps = stringArray(compareData?.gaps);
  const fitScore = safeScore(data.fitScore);
  const atsScore = safeScore(data.atsScore);
  const compareFitScore = compareData
    ? safeScore(compareData.fitScore)
    : undefined;
  const compareAtsScore = compareData
    ? safeScore(compareData.atsScore)
    : undefined;

  const uniqueStrengths = compareData
    ? strengths.filter((s) => !compareStrengths.includes(s))
    : [];
  const uniqueGaps = compareData
    ? gaps.filter((g) => !compareGaps.includes(g))
    : [];

  return (
    <div className="space-y-6">
      <div className="sticky top-12 z-10 bg-background border-b border-border pb-3 -mx-4 px-4 mb-4">
        <div>
          <h2 className="text-lg font-bold truncate">{data.jobTitle}</h2>
          {data.companyName && (
            <p className="text-sm text-muted-foreground">{data.companyName}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {relativeDate(data.createdAt)}
          </p>
        </div>

        <Card className="border-2 mt-3">
          <CardContent className="pt-6 space-y-4">
            <ScoreBar
              score={fitScore}
              label="Fit Score"
              compareScore={compareFitScore}
            />
            <ScoreBar
              score={atsScore}
              label="ATS Score"
              compareScore={compareAtsScore}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            Strengths
            <Badge variant="secondary" className="ml-auto">
              {strengths.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {strengths.length === 0 ? (
            <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
              No strengths were returned for this analysis.
            </p>
          ) : (
            strengths.map((s, i) => (
              <div
                key={i}
                className={`text-sm flex items-start gap-2 p-2 rounded-lg transition-colors ${uniqueStrengths.includes(s) ? "bg-green-50 dark:bg-green-900/20 font-semibold text-green-700 dark:text-green-400" : "hover:bg-muted/50"}`}
              >
                <CheckCircle2
                  className={`w-4 h-4 mt-0.5 shrink-0 ${uniqueStrengths.includes(s) ? "text-green-600 dark:text-green-400" : "text-green-500"}`}
                />
                <span className="flex-1">{s}</span>
                {uniqueStrengths.includes(s) && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 shrink-0"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    unique
                  </Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-1.5">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            Gaps
            <Badge variant="secondary" className="ml-auto">
              {gaps.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {gaps.length === 0 ? (
            <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
              No gaps were returned for this analysis.
            </p>
          ) : (
            gaps.map((g, i) => (
              <div
                key={i}
                className={`text-sm flex items-start gap-2 p-2 rounded-lg transition-colors ${uniqueGaps.includes(g) ? "bg-red-50 dark:bg-red-900/20 font-semibold text-red-700 dark:text-red-400" : "hover:bg-muted/50"}`}
              >
                <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <span className="flex-1">{g}</span>
                {uniqueGaps.includes(g) && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 shrink-0"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    unique
                  </Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            ATS Keywords
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Matched
              </p>
              <Badge variant="outline">{atsMatched.length}</Badge>
            </div>
            {atsMatched.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No matched keywords.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {atsMatched.map((kw) => {
                  const inOtherColumn = compareMatchedSet.has(kw);
                  return (
                    <Badge
                      key={kw}
                      variant={
                        compareId == null
                          ? "default"
                          : inOtherColumn
                            ? "default"
                            : "success"
                      }
                      size="sm"
                    >
                      {kw}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Missing
              </p>
              <Badge variant="outline">{atsMissing.length}</Badge>
            </div>
            {atsMissing.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No missing keywords.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {atsMissing.map((kw) => {
                  const inOtherColumn = compareMissingSet.has(kw);
                  return (
                    <Badge
                      key={kw}
                      variant={
                        compareId == null
                          ? "outline"
                          : inOtherColumn
                            ? "outline"
                            : "warning"
                      }
                      size="sm"
                    >
                      {kw}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {data.fitRationale && (
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="rounded-lg bg-muted p-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              Fit Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {data.fitRationale}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function Compare() {
  const [, setLocation] = useLocation();
  const {
    data: analyses = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useListAnalyses();
  const [leftId, setLeftId] = useState<number | null>(null);
  const [rightId, setRightId] = useState<number | null>(null);

  useEffect(() => {
    if (analyses.length < 2) return;
    const ids = new Set(analyses.map((analysis) => analysis.id));
    const nextLeftId =
      leftId != null && ids.has(leftId) ? leftId : analyses[0].id;
    const nextRightId =
      rightId != null && ids.has(rightId) && rightId !== nextLeftId
        ? rightId
        : (analyses.find((analysis) => analysis.id !== nextLeftId)?.id ?? null);

    if (nextLeftId !== leftId) setLeftId(nextLeftId);
    if (nextRightId !== rightId) setRightId(nextRightId);
  }, [analyses, leftId, rightId]);

  const selectedCount = [leftId, rightId].filter(
    (id): id is number => id != null,
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Compare analyses
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Side-by-side score, keyword, strength, and gap diff across resume
            versions.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
          New analysis
        </Button>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-md" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Skeleton className="h-96 rounded-md" />
            <Skeleton className="h-96 rounded-md" />
          </div>
        </div>
      ) : error ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>Could not load analyses</EmptyTitle>
            <EmptyDescription>{unknownErrorMessage(error)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
              />
              {isFetching ? "Retrying..." : "Retry"}
            </Button>
          </EmptyContent>
        </Empty>
      ) : analyses.length < 2 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GitCompareArrows />
            </EmptyMedia>
            <EmptyTitle>Run at least two analyses</EmptyTitle>
            <EmptyDescription>
              Compare needs two resume-target pairs so it can highlight score
              movement, shared keywords, and unique gaps.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setLocation("/")}>
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              Start a new analysis
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="rounded-lg border bg-surface-1 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold">Comparison set</p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedCount}/2 selected from {analyses.length} analyses
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  const tmp = leftId;
                  setLeftId(rightId);
                  setRightId(tmp);
                }}
                disabled={leftId == null || rightId == null}
                aria-label="Swap analyses"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <Select
                value={leftId?.toString() ?? ""}
                onValueChange={(v) => setLeftId(Number(v))}
              >
                <SelectTrigger aria-label="Pick first analysis">
                  <SelectValue placeholder="Pick first analysis" />
                </SelectTrigger>
                <SelectContent>
                  {analyses.map((a) => (
                    <SelectItem
                      key={a.id}
                      value={a.id.toString()}
                      disabled={a.id === rightId}
                    >
                      {a.jobTitle} {a.companyName ? `· ${a.companyName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="hidden text-center text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground md:block">
                vs
              </div>
              <Select
                value={rightId?.toString() ?? ""}
                onValueChange={(v) => setRightId(Number(v))}
              >
                <SelectTrigger aria-label="Pick second analysis">
                  <SelectValue placeholder="Pick second analysis" />
                </SelectTrigger>
                <SelectContent>
                  {analyses.map((a) => (
                    <SelectItem
                      key={a.id}
                      value={a.id.toString()}
                      disabled={a.id === leftId}
                    >
                      {a.jobTitle} {a.companyName ? `· ${a.companyName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {leftId != null && (
              <AnalysisColumn id={leftId} compareId={rightId} />
            )}
            {rightId != null && (
              <AnalysisColumn id={rightId} compareId={leftId} />
            )}
          </div>

          {leftId == null && rightId == null && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Pick two analyses to compare</EmptyTitle>
                <EmptyDescription>
                  Select an analysis on each side to see the diff highlight gaps
                  and shared strengths.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </>
      )}
    </div>
  );
}
