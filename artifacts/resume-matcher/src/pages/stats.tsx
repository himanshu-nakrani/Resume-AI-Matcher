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
  LineChart,
  Line,
} from "recharts";
import {
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
    <Card className={`border shadow-sm ${highlight ? "border-foreground/20" : ""}`} data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="p-2.5 rounded-xl bg-muted">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const SCORE_BUCKETS = [
  { label: "0–20", min: 0, max: 20, color: "#ef4444" },
  { label: "21–40", min: 21, max: 40, color: "#f97316" },
  { label: "41–60", min: 41, max: 60, color: "#eab308" },
  { label: "61–80", min: 61, max: 80, color: "#84cc16" },
  { label: "81–100", min: 81, max: 100, color: "#22c55e" },
];

const STATUS_COLORS: Record<string, string> = {
  not_applied: "#94a3b8",
  applied: "#3b82f6",
  got_interview: "#f59e0b",
  got_online_exam: "#a855f7",
  selected: "#22c55e",
  rejected: "#ef4444",
};

export function Stats() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = useGetAnalysisStats();
  const { data: analyses, isLoading: analysesLoading } = useListAnalyses();
  const [drillBucket, setDrillBucket] = useState<null | { label: string; ids: number[] }>(null);

  const isLoading = statsLoading || analysesLoading;

  const trendData = analyses
    ? [...analyses]
        .reverse()
        .slice(-12)
        .map((a, i) => ({
          name: `#${i + 1}`,
          fit: a.fitScore,
          ats: a.atsScore,
          label: a.jobTitle,
          id: a.id,
        }))
    : [];

  const getFitColor = (score: number) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#eab308";
    return "#ef4444";
  };

  const scoreDistData = analyses
    ? SCORE_BUCKETS.map((bucket) => ({
        ...bucket,
        count: analyses.filter((a) => a.fitScore >= bucket.min && a.fitScore <= bucket.max).length,
        ids: analyses
          .filter((a) => a.fitScore >= bucket.min && a.fitScore <= bucket.max)
          .map((a) => a.id),
      }))
    : [];

  const pipelineData = analyses
    ? (() => {
        const applied = analyses.filter((a) => ["applied", "got_interview", "got_online_exam", "selected"].includes(a.status)).length;
        const interview = analyses.filter((a) => ["got_interview", "selected"].includes(a.status)).length;
        const selected = analyses.filter((a) => a.status === "selected").length;
        return [
          { name: "Applied", value: applied, fill: "#3b82f6" },
          { name: "Interview", value: interview, fill: "#f59e0b" },
          { name: "Selected", value: selected, fill: "#22c55e" },
        ].filter((d) => d.value > 0);
      })()
    : [];

  const topMatchedKeywords = analyses
    ? (() => {
        const freq: Record<string, number> = {};
        for (const a of analyses) {
          for (const kw of (a.atsKeywordsMatched as string[]) ?? []) {
            freq[kw] = (freq[kw] ?? 0) + 1;
          }
        }
        return Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([kw]) => kw);
      })()
    : [];

  const interviewRate =
    analyses && analyses.filter((a) => a.status !== "not_applied").length > 0
      ? Math.round(
          (analyses.filter((a) => ["got_interview", "selected"].includes(a.status)).length /
            analyses.filter((a) => a.status !== "not_applied").length) *
            100
        )
      : null;

  // T004: Keyword Trends
  const keywordTrends = analyses
    ? (() => {
        const freq: Record<string, number> = {};
        for (const a of analyses) {
          const matched = (a.atsKeywordsMatched as string[]) ?? [];
          const missing = (a.atsKeywordsMissing as string[]) ?? [];
          for (const kw of [...matched, ...missing]) {
            freq[kw] = (freq[kw] ?? 0) + 1;
          }
        }
        return Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count }));
      })()
    : [];

  // T004: Time-in-Stage (Estimate from createdAt to now)
  const timeInStage = analyses
    ? (() => {
        const now = new Date().getTime();
        const stageTotals: Record<string, number> = {};
        const stageCounts: Record<string, number> = {};
        
        for (const a of analyses) {
          const created = new Date(a.createdAt).getTime();
          const days = Math.max(0, (now - created) / (1000 * 60 * 60 * 24));
          const status = a.status || "not_applied";
          stageTotals[status] = (stageTotals[status] ?? 0) + days;
          stageCounts[status] = (stageCounts[status] ?? 0) + 1;
        }

        return ["not_applied", "applied", "got_interview", "got_online_exam", "selected", "rejected"]
          .map(status => ({
            status: status.replace("_", " "),
            avgDays: stageCounts[status] ? Math.round(stageTotals[status] / stageCounts[status]) : 0,
            fill: STATUS_COLORS[status] || "#94a3b8"
          }))
          .filter(d => d.avgDays > 0);
      })()
    : [];

  // T004: Success Rate (Interview+ and Selected)
  const successMetrics = analyses
    ? (() => {
        const total = analyses.length;
        if (total === 0) return { interviewRate: 0, offerRate: 0 };
        const interviewPlus = analyses.filter(a => ["got_interview", "selected"].includes(a.status)).length;
        const offers = analyses.filter(a => a.status === "selected").length;
        return {
          interviewRate: Math.round((interviewPlus / total) * 100),
          offerRate: Math.round((offers / total) * 100),
        };
      })()
    : { interviewRate: 0, offerRate: 0 };

  // T004: Score Momentum
  const momentum = analyses && analyses.length >= 2
    ? (() => {
        const sorted = [...analyses].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const first5 = sorted.slice(0, 5);
        const last5 = sorted.slice(-5);
        const firstAvg = first5.reduce((sum, a) => sum + (a.fitScore || 0), 0) / first5.length;
        const lastAvg = last5.reduce((sum, a) => sum + (a.fitScore || 0), 0) / last5.length;
        return {
          improvement: Math.round(lastAvg - firstAvg),
          firstAvg: Math.round(firstAvg),
          lastAvg: Math.round(lastAvg),
        };
      })()
    : null;

  const drillAnalyses = drillBucket && analyses
    ? analyses.filter((a) => drillBucket.ids.includes(a.id))
    : [];

  // Application timeline — scatter plot
  const timelineData = analyses
    ? analyses.map((a) => ({
        date: new Date(a.createdAt).getTime(),
        fit: a.fitScore,
        label: a.jobTitle,
        status: a.status,
        id: a.id,
      }))
    : [];

  // Success rate by role (top job titles with >1 application)
  const roleSuccessData = analyses
    ? (() => {
        const roles: Record<string, { total: number; interview: number; offer: number }> = {};
        for (const a of analyses) {
          const title = a.jobTitle;
          if (!roles[title]) roles[title] = { total: 0, interview: 0, offer: 0 };
          roles[title].total += 1;
          if (["got_interview", "selected"].includes(a.status)) roles[title].interview += 1;
          if (a.status === "selected") roles[title].offer += 1;
        }
        return Object.entries(roles)
          .filter(([, v]) => v.total >= 1 && (v.interview > 0 || v.offer > 0))
          .sort((a, b) => b[1].interview - a[1].interview)
          .slice(0, 6);
      })()
    : [];

  // Benchmark message
  const avgFit = stats?.averageFitScore ?? 0;
  const benchmarkMsg =
    avgFit >= 80 ? "Excellent — your resume matches these roles very well."
    : avgFit >= 65 ? "Good — you're competitive. A few targeted improvements could help."
    : avgFit >= 50 ? "Room to grow — focus on the skill gaps and ATS keywords."
    : "Getting started — tailor your resume more closely to each job description.";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stats</h1>
          <p className="text-muted-foreground mt-1">Aggregate insights across all your analyses.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => setLocation("/compare")}
        >
          <GitCompareArrows className="w-3.5 h-3.5" />
          Compare
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : !stats || stats.totalAnalyses === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl">
          <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No data yet</p>
          <p className="text-sm mt-1">Run analyses to see aggregate stats here.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Analyses" value={stats.totalAnalyses} icon={FileText} sub="all time" />
            <div className="col-span-1">
              <Card className="border shadow-sm h-full">
                <CardContent className="pt-6 pb-5 flex flex-col items-center">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Avg Fit Score</p>
                  <ScoreCircle score={Math.round(stats.averageFitScore)} size="md" />
                </CardContent>
              </Card>
            </div>
            <div className="col-span-1">
              <Card className="border shadow-sm h-full">
                <CardContent className="pt-6 pb-5 flex flex-col items-center">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Avg ATS Score</p>
                  <ScoreCircle score={Math.round(stats.averageAtsScore)} size="md" />
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
             <Card className="border shadow-sm">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Interview Conversion</p>
                      <p className="text-3xl font-bold mt-1 tabular-nums">{successMetrics.interviewRate}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Analyses reaching Interview or Offer</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-500/10">
                      <Target className="w-5 h-5 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
             </Card>
             <Card className="border shadow-sm">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Offer Conversion</p>
                      <p className="text-3xl font-bold mt-1 tabular-nums">{successMetrics.offerRate}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Analyses resulting in an Offer</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-green-500/10">
                      <Trophy className="w-5 h-5 text-green-500" />
                    </div>
                  </div>
                </CardContent>
             </Card>
          </div>

          {/* Benchmark message */}
          {stats.totalAnalyses >= 1 && (
            <Card className="border shadow-sm border-primary/30 bg-primary/5">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Trophy className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Performance Insight</p>
                  <p className="text-sm text-muted-foreground">{benchmarkMsg}</p>
                </div>
                <div className="ml-auto shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">Avg fit score</p>
                  <p className="text-2xl font-bold tabular-nums">{Math.round(stats.averageFitScore)}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="border-t" />

          {/* T004: Keyword Trends and Time-in-Stage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {keywordTrends.length > 0 && (
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" /> Top Keyword Trends
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
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="count" fill="#8884d8" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {timeInStage.length > 0 && (
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" /> Avg Days in Stage
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
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
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
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Fit Score Trend
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
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
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
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" /> Application Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Each dot is an analysis. Color = status. Click to open.</p>
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
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
                      label={{ value: "Fit", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }}
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
                            <p className="capitalize">Status: {d.status.replace("_", " ")}</p>
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
                        <Cell key={i} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} r={7} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-2">
                  {Object.entries(STATUS_COLORS).map(([status, color]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs text-muted-foreground capitalize">{status.replace("_", " ")}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Rate by Role */}
          {roleSuccessData.length > 0 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" /> Success Rate by Role
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
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-yellow-400 transition-all"
                          style={{ width: `${(data.interview / data.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {analyses && analyses.length >= 3 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Fit Score Distribution
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
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
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
                          <span className="font-bold tabular-nums text-sm w-8 shrink-0">{a.fitScore}</span>
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
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" /> Application Pipeline
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
                        <div className="flex-1 bg-muted rounded-full h-7 overflow-hidden">
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
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Most Frequent Matched Skills
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
                      className="border-emerald-300 bg-emerald-50 text-emerald-950 shadow-none dark:border-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-50"
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {stats.topMissingKeywords.length > 0 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Most Missing ATS Keywords
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  These keywords appear most in job descriptions but are missing from your resumes.
                </p>
                <div className="flex flex-wrap gap-2">
                  {stats.topMissingKeywords.map((kw, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="border-rose-300 bg-rose-50 text-rose-950 shadow-none dark:border-rose-600 dark:bg-rose-950/45 dark:text-rose-50"
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
