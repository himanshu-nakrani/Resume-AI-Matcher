import { useMemo } from "react";
import { useLocation } from "wouter";
import { useListAnalyses } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScoreCircle } from "@/components/score-circle";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  Fingerprint,
  TrendingUp,
  FileText,
  Target,
  Zap,
  Award,
  Briefcase,
  Sparkles,
  AlertCircle,
  PlusCircle,
  RefreshCw,
} from "lucide-react";

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

function dateTime(value: unknown): number {
  return dateValue(value)?.getTime() ?? 0;
}

function shortDate(value: unknown): string {
  const date = dateValue(value);
  return date
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "Unknown";
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  highlight,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card
      padding="sm"
      className={cn("transition-colors", highlight && "border-accent/50")}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
              {title}
            </p>
            <p className="font-mono tabular-nums text-[24px] font-semibold mt-1.5 leading-none">
              {value}
            </p>
            {sub && (
              <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>
            )}
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Brand() {
  const [, setLocation] = useLocation();
  const {
    data: analyses = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useListAnalyses();

  const topKeywords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of analyses) {
      for (const kw of stringArray(a.atsKeywordsMatched)) {
        counts.set(kw, (counts.get(kw) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((x, y) => y.count - x.count);
  }, [analyses]);

  const maxKeywordCount = topKeywords[0]?.count ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircle />
          </EmptyMedia>
          <EmptyTitle>Could not load brand data</EmptyTitle>
          <EmptyDescription>
            {error instanceof Error ? error.message : "Try again in a moment."}
          </EmptyDescription>
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
    );
  }

  if (analyses.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Fingerprint />
          </EmptyMedia>
          <EmptyTitle>No brand data yet</EmptyTitle>
          <EmptyDescription>
            Run your first analysis to start building a professional brand
            profile from real job targets.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setLocation("/")}>
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            Start a new analysis
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  // 1. Keyword Strength Index
  const matchedFreq: Record<string, number> = {};

  analyses.forEach((a) => {
    const matched = stringArray(a.atsKeywordsMatched);
    matched.forEach((kw) => {
      matchedFreq[kw] = (matchedFreq[kw] || 0) + 1;
    });
  });

  const keywordStrengthData = Object.entries(matchedFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, value]) => ({
      name,
      value,
      rate: Math.round((value / analyses.length) * 100),
    }));

  // 2. Skill Gap Map
  const missingFreq: Record<string, number> = {};
  analyses.forEach((a) => {
    const missing = stringArray(a.atsKeywordsMissing);
    missing.forEach((kw) => {
      missingFreq[kw] = (missingFreq[kw] || 0) + 1;
    });
  });

  const skillGapData = Object.entries(missingFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, value]) => ({
      name,
      value,
      rate: Math.round((value / analyses.length) * 100),
    }));

  // 3. Fit Score Trend
  const trendData = [...analyses]
    .sort((a, b) => dateTime(a.createdAt) - dateTime(b.createdAt))
    .map((a) => ({
      date: shortDate(a.createdAt),
      score: safeScore(a.fitScore),
      job: a.jobTitle,
    }));

  // 4. Personal Summary Stats
  const totalAnalyses = analyses.length;
  const avgFitScore = Math.round(
    analyses.reduce((acc, a) => acc + safeScore(a.fitScore), 0) / totalAnalyses,
  );
  const avgAtsScore = Math.round(
    analyses.reduce((acc, a) => acc + safeScore(a.atsScore), 0) / totalAnalyses,
  );
  const bestScore = Math.max(...analyses.map((a) => safeScore(a.fitScore)));

  const roleFreq: Record<string, number> = {};
  analyses.forEach((a) => {
    roleFreq[a.jobTitle] = (roleFreq[a.jobTitle] || 0) + 1;
  });
  const mostAnalyzedRole = Object.entries(roleFreq).sort(
    (a, b) => b[1] - a[1],
  )[0][0];

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Brand dashboard
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Your professional identity quantified across {totalAnalyses}{" "}
            analyses.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
          New analysis
        </Button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Analyses"
          value={totalAnalyses}
          icon={FileText}
          sub="Total applications"
        />
        <StatCard
          title="Avg Fit"
          value={`${avgFitScore}%`}
          icon={Target}
          sub="Match quality"
          highlight
        />
        <StatCard
          title="Avg ATS"
          value={`${avgAtsScore}%`}
          icon={Zap}
          sub="System readiness"
        />
        <StatCard
          title="Peak Match"
          value={`${bestScore}%`}
          icon={Award}
          sub="Highest score"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Fit Score
              Evolution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--surface-3))",
                      border: "1px solid hsl(var(--border-strong))",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                    labelStyle={{
                      color: "hsl(var(--foreground))",
                      fontWeight: 600,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{
                      r: 3,
                      strokeWidth: 2,
                      fill: "hsl(var(--background))",
                      stroke: "hsl(var(--accent))",
                    }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    name="Fit Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" /> Focus Area
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-6">
            <div className="mb-4">
              <ScoreCircle score={avgFitScore} size="lg" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground uppercase">
                Top Target Role
              </p>
              <p className="text-xl font-bold mt-1 line-clamp-2">
                {mostAnalyzedRole}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Keyword Strength Index */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Keyword Strength Index</CardTitle>
            <p className="text-xs text-muted-foreground">
              Most frequent matched keywords across all resumes.
            </p>
          </CardHeader>
          <CardContent>
            {keywordStrengthData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center rounded-md bg-surface-1 px-6 text-center text-[13px] text-muted-foreground">
                Matched keywords will appear here after analyses return ATS
                keyword data.
              </div>
            ) : (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={keywordStrengthData}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `${value} occurrences`,
                        "Count",
                      ]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {keywordStrengthData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`hsl(var(--primary) / ${Math.max(0.3, entry.rate / 100)})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skill Gap Map */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Skill Gap Map</CardTitle>
            <p className="text-xs text-muted-foreground">
              Top missing keywords — your biggest growth opportunities.
            </p>
          </CardHeader>
          <CardContent>
            {skillGapData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center rounded-md bg-surface-1 px-6 text-center text-[13px] text-muted-foreground">
                Missing keyword trends will appear here when analyses identify
                recurring gaps.
              </div>
            ) : (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={skillGapData}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `${value} missing`,
                        "Count",
                      ]}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                      fill="hsl(var(--destructive))"
                    >
                      {skillGapData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`hsl(var(--destructive) / ${Math.max(0.3, entry.rate / 100)})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
            Top keyword strengths
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topKeywords.length === 0 ? (
            <p className="text-[12px] text-muted-foreground text-center py-4">
              Run more analyses to see your top keywords.
            </p>
          ) : (
            topKeywords.slice(0, 10).map((kw) => {
              const pct =
                maxKeywordCount > 0 ? (kw.count / maxKeywordCount) * 100 : 0;
              return (
                <div key={kw.name} className="flex items-center gap-3">
                  <span className="font-mono text-[12px] text-muted-foreground w-32 truncate text-right">
                    {kw.name}
                  </span>
                  <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono tabular-nums text-[11px] text-muted-foreground w-8 text-right">
                    {kw.count}
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
