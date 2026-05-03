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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums">{score}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function AnalysisColumn({ id }: { id: number }) {
  const { data, isLoading } = useGetAnalysis(id, {
    query: { enabled: !!id, queryKey: getGetAnalysisQueryKey(id) },
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

      <Card className="border shadow-sm">
        <CardContent className="pt-5 space-y-3">
          <ScoreBar score={data.fitScore} label="Fit Score" />
          <ScoreBar score={data.atsScore} label="ATS Score" />
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Strengths
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {strengths.map((s, i) => (
            <p key={i} className="text-xs flex items-start gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
              {s}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-destructive" /> Gaps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {gaps.map((g, i) => (
            <p key={i} className="text-xs flex items-start gap-1.5">
              <XCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
              {g}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">ATS Keywords</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-green-600 mb-1.5">Matched ({atsMatched.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {atsMatched.map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-destructive mb-1.5">Missing ({atsMissing.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {atsMissing.map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {data.fitRationale && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fit Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{data.fitRationale}</p>
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

  const options = analyses ?? [];

  return (
    <div className="space-y-8">
      <div>
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <GitCompareArrows className="w-7 h-7 text-primary" /> Compare Analyses
        </h1>
        <p className="text-muted-foreground mt-1">
          Select two analyses to compare scores, strengths, gaps, and keywords side-by-side.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : options.length < 2 ? (
        <div className="text-center py-20 border border-dashed rounded-xl text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Not enough analyses to compare</p>
          <p className="text-sm mt-1">You need at least 2 analyses to use this feature.</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>
            Run New Analysis
          </Button>
        </div>
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
                      <span className="font-medium">{a.jobTitle}</span>
                      {a.companyName && <span className="text-muted-foreground ml-1.5">@ {a.companyName}</span>}
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
                      <span className="font-medium">{a.jobTitle}</span>
                      {a.companyName && <span className="text-muted-foreground ml-1.5">@ {a.companyName}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {leftId && rightId ? (
            <div className="grid grid-cols-2 gap-6 items-start">
              <AnalysisColumn id={leftId} />
              <div className="border-l" />
              <AnalysisColumn id={rightId} />
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
