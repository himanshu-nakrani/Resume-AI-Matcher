import { useGetAnalysisStats, useListAnalyses } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import { TrendingUp, FileText, Target, Zap, GitBranch, CheckCircle2 } from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card
      className="border shadow-sm"
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10">
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

export function Stats() {
  const { data: stats, isLoading: statsLoading } = useGetAnalysisStats();
  const { data: analyses, isLoading: analysesLoading } = useListAnalyses();

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
        count: analyses.filter(
          (a) => a.fitScore >= bucket.min && a.fitScore <= bucket.max
        ).length,
      }))
    : [];

  const pipelineData = analyses
    ? (() => {
        const applied = analyses.filter((a) =>
          ["applied", "interview", "offer"].includes(a.status)
        ).length;
        const interview = analyses.filter((a) =>
          ["interview", "offer"].includes(a.status)
        ).length;
        const offer = analyses.filter((a) => a.status === "offer").length;
        return [
          { name: "Applied", value: applied, fill: "#3b82f6" },
          { name: "Interview", value: interview, fill: "#f59e0b" },
          { name: "Offer", value: offer, fill: "#22c55e" },
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
          (analyses.filter((a) => ["interview", "offer"].includes(a.status)).length /
            analyses.filter((a) => a.status !== "not_applied").length) *
            100
        )
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stats</h1>
        <p className="text-muted-foreground mt-1">
          Aggregate insights across all your analyses.
        </p>
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
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Analyses"
              value={stats.totalAnalyses}
              icon={FileText}
              sub="all time"
            />
            <div className="col-span-1">
              <Card className="border shadow-sm h-full">
                <CardContent className="pt-6 pb-5 flex flex-col items-center">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Avg Fit Score
                  </p>
                  <ScoreCircle score={Math.round(stats.averageFitScore)} size="md" />
                </CardContent>
              </Card>
            </div>
            <div className="col-span-1">
              <Card className="border shadow-sm h-full">
                <CardContent className="pt-6 pb-5 flex flex-col items-center">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Avg ATS Score
                  </p>
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
          </div>

          {/* Score Trend */}
          {trendData.length > 1 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Fit Score Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendData} barGap={4}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      formatter={(val: number, name: string) => [
                        `${val}`,
                        name === "fit" ? "Fit Score" : "ATS Score",
                      ]}
                      labelFormatter={(label, payload) =>
                        payload?.[0]?.payload?.label ?? label
                      }
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="fit" radius={[4, 4, 0, 0]} name="fit">
                      {trendData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getFitColor(entry.fit)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Score Distribution */}
          {analyses && analyses.length >= 3 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Fit Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  How your resume-to-job fit scores are distributed across all analyses.
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={scoreDistData}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={25}
                    />
                    <Tooltip
                      formatter={(val: number) => [`${val} analyses`, "Count"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {scoreDistData.map((entry, index) => (
                        <Cell key={`dist-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Application Pipeline Funnel */}
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
                        <div className="w-20 shrink-0 text-sm font-medium text-right">
                          {stage.name}
                        </div>
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

          {/* Top Matched Keywords */}
          {topMatchedKeywords.length > 0 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Most Frequent Matched Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Skills and keywords you consistently have — your core strengths across all applications.
                </p>
                <div className="flex flex-wrap gap-2">
                  {topMatchedKeywords.map((kw, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Missing Keywords */}
          {stats.topMissingKeywords.length > 0 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Most Missing ATS Keywords
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  These keywords appear most frequently in job descriptions but are missing
                  from your resumes.
                </p>
                <div className="flex flex-wrap gap-2">
                  {stats.topMissingKeywords.map((kw, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
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
