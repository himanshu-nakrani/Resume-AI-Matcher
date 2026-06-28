import { useState, useMemo } from "react";
import { useListAnalyses, useGetAnalysis, getGetAnalysisQueryKey } from "@workspace/api-client-react";
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
} from "lucide-react";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { formatDistanceToNow } from "date-fns";

function ScoreBar({ score, label, compareScore }: { score: number; label: string; compareScore?: number }) {
  const color =
    score >= 80 ? "hsl(var(--success))"
    : score >= 60 ? "hsl(var(--warning))"
    : "hsl(var(--destructive))";
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

function AnalysisColumn({ id, compareId }: { id: number; compareId?: number | null }) {
  const { data, isLoading } = useGetAnalysis(id, {
    query: { enabled: !!id, queryKey: getGetAnalysisQueryKey(id) },
  });
  const { data: compareData } = useGetAnalysis(compareId ?? 0, {
    query: { enabled: !!compareId, queryKey: getGetAnalysisQueryKey(compareId ?? 0) },
  });

  const compareMatchedSet = useMemo(
    () => new Set((compareData?.atsKeywordsMatched as string[] | undefined) ?? []),
    [compareData?.atsKeywordsMatched],
  );
  const compareMissingSet = useMemo(
    () => new Set((compareData?.atsKeywordsMissing as string[] | undefined) ?? []),
    [compareData?.atsKeywordsMissing],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data) return null;

  const strengths = (data.strengths as string[]) ?? [];
  const gaps = (data.gaps as string[]) ?? [];
  const atsMatched = (data.atsKeywordsMatched as string[]) ?? [];
  const atsMissing = (data.atsKeywordsMissing as string[]) ?? [];

  const uniqueStrengths = compareData
    ? strengths.filter((s) => !(compareData.strengths as string[]).includes(s))
    : [];
  const uniqueGaps = compareData
    ? gaps.filter((g) => !(compareData.gaps as string[]).includes(g))
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
            {formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}
          </p>
        </div>

        <Card className="border-2 mt-3">
          <CardContent className="pt-6 space-y-4">
            <ScoreBar score={data.fitScore} label="Fit Score" compareScore={compareData?.fitScore} />
            <ScoreBar score={data.atsScore} label="ATS Score" compareScore={compareData?.atsScore} />
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
            <Badge variant="secondary" className="ml-auto">{strengths.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {strengths.map((s, i) => (
            <div key={i} className={`text-sm flex items-start gap-2 p-2 rounded-lg transition-colors ${uniqueStrengths.includes(s) ? "bg-green-50 dark:bg-green-900/20 font-semibold text-green-700 dark:text-green-400" : "hover:bg-muted/50"}`}>
              <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${uniqueStrengths.includes(s) ? "text-green-600 dark:text-green-400" : "text-green-500"}`} />
              <span className="flex-1">{s}</span>
              {uniqueStrengths.includes(s) && (
                <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 shrink-0">
                  <Sparkles className="w-3 h-3 mr-1" />
                  unique
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-1.5">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            Gaps
            <Badge variant="secondary" className="ml-auto">{gaps.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {gaps.map((g, i) => (
            <div key={i} className={`text-sm flex items-start gap-2 p-2 rounded-lg transition-colors ${uniqueGaps.includes(g) ? "bg-red-50 dark:bg-red-900/20 font-semibold text-red-700 dark:text-red-400" : "hover:bg-muted/50"}`}>
              <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <span className="flex-1">{g}</span>
              {uniqueGaps.includes(g) && (
                <Badge variant="outline" className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 shrink-0">
                  <Sparkles className="w-3 h-3 mr-1" />
                  unique
                </Badge>
              )}
            </div>
          ))}
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
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Matched</p>
              <Badge variant="outline">
                {atsMatched.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {atsMatched.map((kw) => {
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
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Missing</p>
              <Badge variant="outline">
                {atsMissing.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {atsMissing.map((kw) => {
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
            </div>
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
            <p className="text-sm text-muted-foreground leading-relaxed">{data.fitRationale}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function Compare() {
  const { data: analyses } = useListAnalyses();
  const [leftId, setLeftId] = useState<number | null>(null);
  const [rightId, setRightId] = useState<number | null>(null);

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
          <Select value={leftId?.toString() ?? ""} onValueChange={(v) => setLeftId(Number(v))}>
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
          onClick={() => { const tmp = leftId; setLeftId(rightId); setRightId(tmp); }}
          disabled={leftId == null || rightId == null}
          aria-label="Swap analyses"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1">
          <Select value={rightId?.toString() ?? ""} onValueChange={(v) => setRightId(Number(v))}>
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
        {leftId != null && <AnalysisColumn id={leftId} compareId={rightId} />}
        {rightId != null && <AnalysisColumn id={rightId} compareId={leftId} />}
      </div>

      {leftId == null && rightId == null && (
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
}
