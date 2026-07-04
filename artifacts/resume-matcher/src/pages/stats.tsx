import { useState } from "react";
import { useLocation } from "wouter";
import { useGetAnalysisStats, useListAnalyses } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  CartesianGrid,
} from "recharts";
import {
  AlertCircle,
  TrendingUp,
  FileText,
  Target,
  Zap,
  GitBranch,
  CheckCircle2,
  GitCompareArrows,
  Calendar,
  Trophy,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";

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
      className={cn(
        "transition-colors",
        highlight && "border-accent/50",
      )}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">{title}</p>
            <p className="font-mono tabular-nums text-[24px] font-semibold mt-1.5 leading-none">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const SCORE_BUCKETS = [
  { label: "0–20", min: 0, max: 20, color: "hsl(var(--destructive))" },
  { label: "21–40", min: 21, max: 40, color: "hsl(var(--destructive))" },
  { label: "41–60", min: 41, max: 60, color: "hsl(var(--warning))" },
  { label: "61–80", min: 61, max: 80, color: "hsl(var(--warning))" },
  { label: "81–100", min: 81, max: 100, color: "hsl(var(--success))" },
];

const STATUS_COLORS: Record<string, string> = {
  not_applied: "hsl(var(--muted-foreground))",
  applied: "hsl(var(--info))",
  got_interview: "hsl(var(--warning))",
  got_online_exam: "hsl(var(--accent))",
  selected: "hsl(var(--success))",
  rejected: "hsl(var(--destructive))",
};

const STATUS_LABELS: Record<string, string> = {
  not_applied: "Not applied",
  applied: "Applied",
  got_interview: "Interview",
  got_online_exam: "Online exam",
  selected: "Selected",
  rejected: "Rejected",
};

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
  return Math.min(100, Math.max(0, Math.round(score)));
}

function dateMs(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function statusKey(value: unknown): string {
  return typeof value === "string" && value in STATUS_COLORS ? value : "not_applied";
}

function statusLabel(value: unknown): string {
  return STATUS_LABELS[statusKey(value)] ?? "Not applied";
}

function keywordTrendRows(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

export function Stats() {
  const [, setLocation] = useLocation();
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsIsError,
    error: statsError,
  } = useGetAnalysisStats();
  const {
    data: analyses,
    isLoading: analysesLoading,
    isError: analysesIsError,
    error: analysesError,
  } = useListAnalyses();
  const [drillBucket, setDrillBucket] = useState<null | { label: string; ids: number[] }>(null);

  const isLoading = statsLoading || analysesLoading;
  const isError = statsIsError || analysesIsError;
  const error = statsError ?? analysesError;
  const analysesList = analyses ?? [];

  const trendData = analysesList.length > 0
    ? [...analysesList]
        .reverse()
        .slice(-12)
        .map((a, i) => ({
          name: `#${i + 1}`,
          fit: safeScore(a.fitScore),
          ats: safeScore(a.atsScore),
          label: a.jobTitle,
          id: a.id,
        }))
    : [];

  const getFitColor = (score: number) => {
    if (score >= 80) return "hsl(var(--success))";
    if (score >= 60) return "hsl(var(--warning))";
    return "hsl(var(--destructive))";
  };

  const scoreDistData = analysesList.length > 0
    ? SCORE_BUCKETS.map((bucket) => ({
        ...bucket,
        count: analysesList.filter((a) => safeScore(a.fitScore) >= bucket.min && safeScore(a.fitScore) <= bucket.max).length,
        ids: analysesList
          .filter((a) => safeScore(a.fitScore) >= bucket.min && safeScore(a.fitScore) <= bucket.max)
          .map((a) => a.id),
      }))
    : [];

  const pipelineData = analysesList.length > 0
    ? (() => {
        const applied = analysesList.filter((a) => ["applied", "got_interview", "got_online_exam", "selected"].includes(statusKey(a.status))).length;
        const interview = analysesList.filter((a) => ["got_interview", "selected"].includes(statusKey(a.status))).length;
        const selected = analysesList.filter((a) => statusKey(a.status) === "selected").length;
        return [
          { name: "Applied", value: applied, fill: "hsl(var(--info))" },
          { name: "Interview", value: interview, fill: "hsl(var(--warning))" },
          { name: "Selected", value: selected, fill: "hsl(var(--success))" },
        ].filter((d) => d.value > 0);
      })()
    : [];

  const topMatchedKeywords = analysesList.length > 0
    ? (() => {
        const keywords = analysesList.flatMap((a) => stringArray(a.atsKeywordsMatched));
        return keywordTrendRows(keywords, 15)
          .map(([kw]) => kw);
      })()
    : [];

  const interviewRate =
    analysesList.filter((a) => statusKey(a.status) !== "not_applied").length > 0
      ? Math.round(
          (analysesList.filter((a) => ["got_interview", "selected"].includes(statusKey(a.status))).length /
            analysesList.filter((a) => statusKey(a.status) !== "not_applied").length) *
            100
        )
      : null;

  // T004: Keyword Trends
  const keywordTrends = analysesList.length > 0
    ? (() => {
        const keywords = analysesList.flatMap((a) => [
          ...stringArray(a.atsKeywordsMatched),
          ...stringArray(a.atsKeywordsMissing),
        ]);
        return keywordTrendRows(keywords, 10)
          .map(([name, count]) => ({ name, count }));
      })()
    : [];

  // T004: Time-in-Stage (Estimate from createdAt to now)
  const timeInStage = analysesList.length > 0
    ? (() => {
        const now = new Date().getTime();
        const stageTotals: Record<string, number> = {};
        const stageCounts: Record<string, number> = {};
        
        for (const a of analysesList) {
          const created = dateMs(a.createdAt);
          if (created === null) continue;
          const days = Math.max(0, (now - created) / (1000 * 60 * 60 * 24));
          const status = statusKey(a.status);
          stageTotals[status] = (stageTotals[status] ?? 0) + days;
          stageCounts[status] = (stageCounts[status] ?? 0) + 1;
        }

        return ["not_applied", "applied", "got_interview", "got_online_exam", "selected", "rejected"]
          .map(status => ({
            status: statusLabel(status),
            avgDays: stageCounts[status] ? Math.round(stageTotals[status] / stageCounts[status]) : 0,
            fill: STATUS_COLORS[status] || "hsl(var(--muted-foreground))"
          }))
          .filter(d => d.avgDays > 0);
      })()
    : [];

  // T004: Success Rate (Interview+ and Selected)
  const successMetrics = analysesList.length > 0
    ? (() => {
        const total = analysesList.length;
        if (total === 0) return { interviewRate: 0, offerRate: 0 };
        const interviewPlus = analysesList.filter(a => ["got_interview", "selected"].includes(statusKey(a.status))).length;
        const offers = analysesList.filter(a => statusKey(a.status) === "selected").length;
        return {
          interviewRate: Math.round((interviewPlus / total) * 100),
          offerRate: Math.round((offers / total) * 100),
        };
      })()
    : { interviewRate: 0, offerRate: 0 };

  // T004: Score Momentum
  const momentum = analysesList.length >= 2
    ? (() => {
        const sorted = [...analysesList].sort((a, b) => (dateMs(a.createdAt) ?? 0) - (dateMs(b.createdAt) ?? 0));
        const first5 = sorted.slice(0, 5);
        const last5 = sorted.slice(-5);
        const firstAvg = first5.reduce((sum, a) => sum + safeScore(a.fitScore), 0) / first5.length;
        const lastAvg = last5.reduce((sum, a) => sum + safeScore(a.fitScore), 0) / last5.length;
        return {
          improvement: Math.round(lastAvg - firstAvg),
          firstAvg: Math.round(firstAvg),
          lastAvg: Math.round(lastAvg),
        };
      })()
    : null;

  const drillAnalyses = drillBucket
    ? analysesList.filter((a) => drillBucket.ids.includes(a.id))
    : [];

  // Application timeline — scatter plot
  const timelineData = analysesList.length > 0
    ? analysesList.flatMap((a) => {
        const created = dateMs(a.createdAt);
        if (created === null) return [];
        return [{
          date: created,
          fit: safeScore(a.fitScore),
          label: a.jobTitle,
          status: statusKey(a.status),
          id: a.id,
        }];
      })
    : [];

  // Success rate by role (top job titles with >1 application)
  const roleSuccessData = analysesList.length > 0
    ? (() => {
        const roles: Record<string, { total: number; interview: number; offer: number }> = {};
        for (const a of analysesList) {
          const title = a.jobTitle;
          if (!roles[title]) roles[title] = { total: 0, interview: 0, offer: 0 };
          roles[title].total += 1;
          if (["got_interview", "selected"].includes(statusKey(a.status))) roles[title].interview += 1;
          if (statusKey(a.status) === "selected") roles[title].offer += 1;
        }
        return Object.entries(roles)
          .filter(([, v]) => v.total >= 1 && (v.interview > 0 || v.offer > 0))
          .sort((a, b) => b[1].interview - a[1].interview)
          .slice(0, 6);
      })()
    : [];

  // Benchmark message
  const avgFit = safeScore(stats?.averageFitScore);
  const avgAts = safeScore(stats?.averageAtsScore);
  const topMissingKeywords = stringArray(stats?.topMissingKeywords);
  const benchmarkMsg =
    avgFit >= 80 ? "Excellent — your resume matches these roles very well."
    : avgFit >= 65 ? "Good — you're competitive. A few targeted improvements could help."
    : avgFit >= 50 ? "Room to grow — focus on the skill gaps and ATS keywords."
    : "Getting started — tailor your resume more closely to each job description.";

  return (
    <div className="space-y-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Stats</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Aggregate insights across all resume targets, score movement, and application outcomes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/compare")}
          >
            <GitCompareArrows className="w-3.5 h-3.5 mr-1.5" />
            Compare
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-md" />
        </div>
      ) : isError ? (
        <Empty className="bg-surface-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>Could not load stats</EmptyTitle>
            <EmptyDescription>
              {error instanceof Error ? error.message : "Refresh the page or try again in a moment."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </EmptyContent>
        </Empty>
      ) : !stats || stats.totalAnalyses === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrendingUp />
            </EmptyMedia>
            <EmptyTitle>No data yet</EmptyTitle>
            <EmptyDescription>
              Run analyses to see aggregate stats here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setLocation("/")}>
              Start a new analysis
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Analyses" value={stats.totalAnalyses} icon={FileText} sub="all time" />
            <div className="col-span-1">
              <Card className="h-full shadow-sm">
                <CardContent className="pt-6 pb-5 flex flex-col items-center">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Avg Fit Score</p>
                  <ScoreCircle score={avgFit} size="md" />
                </CardContent>
              </Card>
            </div>
            <div className="col-span-1">
              <Card className="h-full shadow-sm">
                <CardContent className="pt-6 pb-5 flex flex-col items-center">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Avg ATS Score</p>
                  <ScoreCircle score={avgAts} size="md" />
                </CardContent>
              </Card>
            </div>
            <StatCard
              title="Interview Rate"
              value={interviewRate !== null ? `${interviewRate}%` : "—"}
              icon={Zap}
              sub="of applications submitted"
            />
            {momentum && (
              <StatCard
                title="Score Momentum"
                value={`${momentum.improvement > 0 ? "+" : ""}${momentum.improvement}`}
                icon={TrendingUp}
                sub={`Trend: ${momentum.firstAvg} → ${momentum.lastAvg}`}
                highlight={momentum.improvement > 0}
              />
            )}
          </div>

          {/* T004: Success Rate Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Card className="shadow-sm">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Interview Conversion</p>
                      <p className="text-3xl font-bold mt-1 tabular-nums">{successMetrics.interviewRate}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Analyses reaching Interview or Offer</p>
                    </div>
                    <div className="rounded-md bg-warning/10 p-2.5">
                      <Target className="w-5 h-5 text-warning" />
                    </div>
                  </div>
                </CardContent>
             </Card>
             <Card className="shadow-sm">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Offer Conversion</p>
                      <p className="text-3xl font-bold mt-1 tabular-nums">{successMetrics.offerRate}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Analyses resulting in an Offer</p>
                    </div>
                    <div className="rounded-md bg-success/10 p-2.5">
                      <Trophy className="w-5 h-5 text-success" />
                    </div>
                  </div>
                </CardContent>
             </Card>
          </div>

          {/* Benchmark message */}
          {stats.totalAnalyses >= 1 && (
            <Card className="border-accent/30 bg-accent/5 shadow-sm">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Trophy className="w-5 h-5 text-accent shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Performance Insight</p>
                  <p className="text-sm text-muted-foreground">{benchmarkMsg}</p>
                </div>
                <div className="ml-auto shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">Avg fit score</p>
                  <p className="text-2xl font-bold tabular-nums">{avgFit}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="border-t" />

          {/* T004: Keyword Trends and Time-in-Stage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {keywordTrends.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-accent" /> Top Keyword Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-4">
                    Most frequent keywords across all targeted jobs (matched & missing).
                  </p>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={keywordTrends} layout="vertical" margin={{ left: 40 }}>
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        tick={{ fontSize: 11 }} 
                        width={100}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--surface-3))', border: '1px solid hsl(var(--border-strong))', borderRadius: '6px', fontSize: '12px', color: 'hsl(var(--foreground))' }}
                        labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {timeInStage.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent" /> Avg Days in Stage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-4">
                    Estimated average time from creation until now per status.
                  </p>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={timeInStage}>
                      <XAxis dataKey="status" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--surface-3))', border: '1px solid hsl(var(--border-strong))', borderRadius: '6px', fontSize: '12px', color: 'hsl(var(--foreground))' }}
                        labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                        formatter={(val: number) => [`${val} days`, "Avg Time"]}
                      />
                      <Bar dataKey="avgDays" radius={[4, 4, 0, 0]}>
                        {timeInStage.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {trendData.length > 1 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" /> Fit Score Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Click any bar to open that analysis.</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={trendData}
                    barGap={4}
                    onClick={(payload) => {
                      const id = payload?.activePayload?.[0]?.payload?.id;
                      if (id) setLocation(`/analysis/${id}`);
                    }}
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip
                      formatter={(val: number, name: string) => [`${val}`, name === "fit" ? "Fit Score" : "ATS Score"]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.label ?? label}
                      contentStyle={{ backgroundColor: 'hsl(var(--surface-3))', border: '1px solid hsl(var(--border-strong))', borderRadius: '6px', fontSize: '12px', color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                    />
                    <Bar dataKey="fit" radius={[4, 4, 0, 0]} name="fit" cursor="pointer">
                      {trendData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getFitColor(entry.fit)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Application Timeline */}
          {timelineData.length > 1 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" /> Application Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Each dot is an analysis. Color = status. Click to open.</p>
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(v) => format(new Date(v), "MMM d")}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="fit"
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                      label={{ value: "Fit", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-card border rounded-lg p-2.5 text-xs shadow-lg">
                            <p className="font-semibold">{d.label}</p>
                            <p className="text-muted-foreground">{format(new Date(d.date), "MMM d, yyyy")}</p>
                            <p>Fit: <span className="font-bold">{d.fit}</span></p>
                            <p>Status: {statusLabel(d.status)}</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      data={timelineData}
                      cursor="pointer"
                      onClick={(d) => setLocation(`/analysis/${d.id}`)}
                    >
                      {timelineData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.status] ?? "hsl(var(--muted-foreground))"} r={7} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-2">
                  {Object.entries(STATUS_COLORS).map(([status, color]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs text-muted-foreground">{statusLabel(status)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Rate by Role */}
          {roleSuccessData.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-warning" /> Success Rate by Role
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4">
                  Roles where applications progressed to interview or offer.
                </p>
                <div className="space-y-3">
                  {roleSuccessData.map(([role, data]) => (
                    <div key={role} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate flex-1 mr-2">{role}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {data.interview}/{data.total} to interview
                          {data.offer > 0 && ` · ${data.offer} offer`}
                        </span>
                      </div>
                      <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-warning transition-all"
                          style={{ width: `${(data.interview / data.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {analysesList.length >= 3 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent" /> Fit Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-1">
                  How your resume-to-job fit scores are distributed.
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Click a bar to see which analyses are in that range.
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={scoreDistData}
                    onClick={(payload) => {
                      const d = payload?.activePayload?.[0]?.payload;
                      if (!d || d.count === 0) return;
                      if (drillBucket?.label === d.label) {
                        setDrillBucket(null);
                      } else {
                        setDrillBucket({ label: d.label, ids: d.ids });
                      }
                    }}
                  >
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={25} />
                    <Tooltip
                      formatter={(val: number) => [`${val} analyses`, "Count"]}
                      contentStyle={{ backgroundColor: 'hsl(var(--surface-3))', border: '1px solid hsl(var(--border-strong))', borderRadius: '6px', fontSize: '12px', color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer">
                      {scoreDistData.map((entry, index) => (
                        <Cell
                          key={`dist-${index}`}
                          fill={entry.color}
                          opacity={drillBucket && drillBucket.label !== entry.label ? 0.35 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {drillBucket && drillAnalyses.length > 0 && (
                  <div className="mt-5 border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold">
                        {drillBucket.label} — {drillAnalyses.length} {drillAnalyses.length === 1 ? "analysis" : "analyses"}
                      </p>
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setDrillBucket(null)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="space-y-2">
                      {drillAnalyses.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setLocation(`/analysis/${a.id}`)}
                          className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/60 transition-colors"
                        >
                          <span className="font-bold tabular-nums text-sm w-8 shrink-0">{safeScore(a.fitScore)}</span>
                          <span className="flex-1 text-sm font-medium truncate">{a.jobTitle}</span>
                          {a.companyName && (
                            <span className="text-xs text-muted-foreground truncate hidden sm:block">{a.companyName}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {pipelineData.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-accent" /> Application Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Track how many applications progressed through each stage.
                </p>
                <div className="space-y-2">
                  {pipelineData.map((stage, i) => {
                    const max = pipelineData[0].value;
                    const pct = max > 0 ? (stage.value / max) * 100 : 0;
                    return (
                      <div key={stage.name} className="flex items-center gap-3">
                        <div className="w-20 shrink-0 text-sm font-medium text-right">{stage.name}</div>
                        <div className="flex-1 bg-surface-2 rounded-full h-7 overflow-hidden">
                          <div
                            className="h-full rounded-full flex items-center px-3 transition-all"
                            style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: stage.fill }}
                          >
                            <span className="text-white text-xs font-bold">{stage.value}</span>
                          </div>
                        </div>
                        {i > 0 && pipelineData[i - 1].value > 0 && (
                          <div className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">
                            {Math.round((stage.value / pipelineData[i - 1].value) * 100)}%
                          </div>
                        )}
                        {i === 0 && <div className="w-12 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {topMatchedKeywords.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" /> Most Frequent Matched Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Skills and keywords you consistently have — your core strengths.
                </p>
                <div className="flex flex-wrap gap-2">
                  {topMatchedKeywords.map((kw, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="border-success/30 bg-success/10 text-success shadow-none"
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {topMissingKeywords.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-destructive" /> Most Missing ATS Keywords
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  These keywords appear most in job descriptions but are missing from your resumes.
                </p>
                <div className="flex flex-wrap gap-2">
                  {topMissingKeywords.map((kw, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 text-destructive shadow-none"
                      data-testid={`top-missing-keyword-${i}`}
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
