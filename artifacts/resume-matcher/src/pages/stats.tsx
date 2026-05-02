import { useGetAnalysisStats, useListAnalyses } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, FileText, Target, Zap } from "lucide-react";

function StatCard({ title, value, icon: Icon, sub }: { title: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <Card className="border shadow-sm" data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
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

export function Stats() {
  const { data: stats, isLoading: statsLoading } = useGetAnalysisStats();
  const { data: analyses, isLoading: analysesLoading } = useListAnalyses();

  const isLoading = statsLoading || analysesLoading;

  const chartData = analyses
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stats</h1>
        <p className="text-muted-foreground mt-1">Aggregate insights across all your analyses.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
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
              title="Analyses with Cover Letter"
              value={analyses?.filter((a) => a.coverLetter).length ?? 0}
              icon={Zap}
              sub={`of ${stats.totalAnalyses} total`}
            />
          </div>

          {/* Score Trend Chart */}
          {chartData.length > 1 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Fit Score Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barGap={4}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip
                      formatter={(val: number, name: string) => [`${val}`, name === "fit" ? "Fit Score" : "ATS Score"]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.label ?? label}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="fit" radius={[4, 4, 0, 0]} name="fit">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getFitColor(entry.fit)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
                <p className="text-sm text-muted-foreground mb-3">These keywords appear most frequently in job descriptions but are missing from your resumes.</p>
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
