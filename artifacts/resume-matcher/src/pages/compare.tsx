import { useState } from "react";
import { useLocation } from "wouter";
import { useListAnalyses, useGetAnalysis, getGetAnalysisQueryKey } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
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
  ArrowLeft,
  GitCompareArrows,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function ScoreBar({ score, label, compareScore }: { score: number; label: string; compareScore?: number }) {
  const color =
    score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";
  const diff = compareScore !== undefined ? score - compareScore : null;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm items-center">
        <span className="text-muted-foreground font-medium">{label}</span>
        <div className="flex items-center gap-2">
          {diff !== null && diff !== 0 && (
            <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${diff > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
              {diff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {diff > 0 ? "+" : ""}{diff}
            </span>
          )}
          <span className="font-bold tabular-nums text-base">{score}</span>
        </div>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color} shadow-sm`}
          style={{ width: `${score}%` }}
        />
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
      <div>
        <h2 className="text-lg font-bold truncate">{data.jobTitle}</h2>
        {data.companyName && (
          <p className="text-sm text-muted-foreground">{data.companyName}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}
        </p>
      </div>

      <Card className="border-2">
        <CardContent className="pt-6 space-y-4">
          <ScoreBar score={data.fitScore} label="Fit Score" compareScore={compareData?.fitScore} />
          <ScoreBar score={data.atsScore} label="ATS Score" compareScore={compareData?.atsScore} />
        </CardContent>
      </Card>

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
              <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
                {atsMatched.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {atsMatched.map((kw, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 transition-colors dark:border-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-50 dark:hover:bg-emerald-900/60"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Missing</p>
              <Badge variant="outline" className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700">
                {atsMissing.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {atsMissing.map((kw, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs border-rose-300 bg-rose-50 text-rose-950 hover:bg-rose-100 transition-colors dark:border-rose-600 dark:bg-rose-950/45 dark:text-rose-50 dark:hover:bg-rose-900/60"
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  {kw}
                </Badge>
              ))}
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
  const [, setLocation] = useLocation();
  const { data: analyses, isLoading } = useListAnalyses();
  const [leftId, setLeftId] = useState<number | null>(null);
  const [rightId, setRightId] = useState<number | null>(null);

  const options = analyses
    ? [...analyses].sort((a, b) => b.fitScore - a.fitScore)
    : [];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="gap-2 hover:gap-3 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Button>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <div className="rounded-xl bg-muted p-3">
              <GitCompareArrows className="w-8 h-8 text-primary" />
            </div>
            Compare Analyses
          </h1>
          <p className="text-muted-foreground text-lg">
            Select two analyses to compare scores, strengths, gaps, and keywords side-by-side.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-14 rounded-xl shimmer" />
          <Skeleton className="h-14 rounded-xl shimmer" />
        </div>
      ) : options.length < 2 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="text-center py-16">
            <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
              <Sparkles className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold mb-2">Not Enough Analyses</h3>
            <p className="text-muted-foreground mb-6">You need at least 2 analyses to compare. Create more analyses to use this feature.</p>
            <Button onClick={() => setLocation("/")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Go to Home
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Left</p>
              <Select
                value={leftId?.toString() ?? ""}
                onValueChange={(v) => setLeftId(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an analysis..." />
                </SelectTrigger>
                <SelectContent>
                  {options.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()} disabled={a.id === rightId}>
                      <div className="flex items-center gap-2">
                        <span className={`tabular-nums font-bold text-xs px-1.5 py-0.5 rounded ${a.fitScore >= 80 ? "bg-green-100 text-green-700" : a.fitScore >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                          {a.fitScore}
                        </span>
                        <span className="font-medium">{a.jobTitle}</span>
                        {a.companyName && <span className="text-muted-foreground">@ {a.companyName}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Right</p>
              <Select
                value={rightId?.toString() ?? ""}
                onValueChange={(v) => setRightId(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an analysis..." />
                </SelectTrigger>
                <SelectContent>
                  {options.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()} disabled={a.id === leftId}>
                      <div className="flex items-center gap-2">
                        <span className={`tabular-nums font-bold text-xs px-1.5 py-0.5 rounded ${a.fitScore >= 80 ? "bg-green-100 text-green-700" : a.fitScore >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                          {a.fitScore}
                        </span>
                        <span className="font-medium">{a.jobTitle}</span>
                        {a.companyName && <span className="text-muted-foreground">@ {a.companyName}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {leftId && rightId ? (
            <div className="grid grid-cols-2 gap-6 items-start">
              <AnalysisColumn id={leftId} compareId={rightId} />
              <div className="border-l" />
              <AnalysisColumn id={rightId} compareId={leftId} />
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed rounded-xl text-muted-foreground">
              <GitCompareArrows className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select two analyses above to start comparing.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
