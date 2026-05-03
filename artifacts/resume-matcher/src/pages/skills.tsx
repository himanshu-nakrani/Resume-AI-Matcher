import { useState } from "react";
import { useLocation } from "wouter";
import { useListAnalyses } from "@workspace/api-client-react";
import type { LearningPlanItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  GraduationCap,
  Target,
  Sparkles,
  BookOpen,
  Award,
  Hammer,
  BookMarked,
  FileText,
  TrendingUp,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import type { LearningResource } from "@workspace/api-client-react";

function resourceTypeIcon(type: string) {
  switch (type) {
    case "course": return <BookOpen className="w-3.5 h-3.5" />;
    case "certification": return <Award className="w-3.5 h-3.5" />;
    case "project": return <Hammer className="w-3.5 h-3.5" />;
    case "book": return <BookMarked className="w-3.5 h-3.5" />;
    case "article": return <FileText className="w-3.5 h-3.5" />;
    default: return <BookOpen className="w-3.5 h-3.5" />;
  }
}

const PRIORITY_CONFIG = {
  high: { label: "High", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
};

export function Skills() {
  const [, setLocation] = useLocation();
  const { data: analyses, isLoading } = useListAnalyses();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const allAnalyses = analyses ?? [];
  const withLearningPlan = allAnalyses.filter((a) => (a.learningPlan as LearningPlanItem[]).length > 0);

  // Aggregate skill gap frequency across all learning plans
  const skillFreq: Record<string, { count: number; priority: string; analyses: string[]; resources: LearningResource[] }> = {};
  for (const a of allAnalyses) {
    const plan = (a.learningPlan as LearningPlanItem[]) ?? [];
    for (const item of plan) {
      if (!skillFreq[item.skill]) {
        skillFreq[item.skill] = { count: 0, priority: item.priority, analyses: [], resources: item.resources ?? [] };
      }
      skillFreq[item.skill].count += 1;
      skillFreq[item.skill].analyses.push(a.jobTitle);
      if (item.priority === "high" && skillFreq[item.skill].priority !== "high") {
        skillFreq[item.skill].priority = "high";
      }
      if (item.resources && item.resources.length > skillFreq[item.skill].resources.length) {
        skillFreq[item.skill].resources = item.resources;
      }
    }
  }

  const topSkills = Object.entries(skillFreq)
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const pDiff = (priorityOrder[b[1].priority as keyof typeof priorityOrder] ?? 0) - (priorityOrder[a[1].priority as keyof typeof priorityOrder] ?? 0);
      if (pDiff !== 0) return pDiff;
      return b[1].count - a[1].count;
    });

  const displayedSkills = showAll ? topSkills : topSkills.slice(0, 8);

  // Aggregate missing keywords frequency
  const keywordFreq: Record<string, number> = {};
  for (const a of allAnalyses) {
    for (const kw of (a.atsKeywordsMissing as string[]) ?? []) {
      keywordFreq[kw] = (keywordFreq[kw] ?? 0) + 1;
    }
  }
  const topKeywords = Object.entries(keywordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // Progress: analyses with learning plans generated
  const coveragePct = allAnalyses.length > 0 ? Math.round((withLearningPlan.length / allAnalyses.length) * 100) : 0;

  if (allAnalyses.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skills Dashboard</h1>
          <p className="text-muted-foreground mt-1">Aggregate skill gaps and learning priorities across all your analyses.</p>
        </div>
        <div className="text-center py-20 border border-dashed rounded-xl text-muted-foreground">
          <GraduationCap className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No analyses yet</p>
          <p className="text-sm mt-1">Run your first analysis to see skill insights here.</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>
            Start New Analysis
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Skills Dashboard</h1>
        <p className="text-muted-foreground mt-1">Aggregate skill gaps and learning priorities across all your analyses.</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Analyses</p>
            <p className="text-3xl font-bold mt-1">{allAnalyses.length}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unique Skill Gaps</p>
            <p className="text-3xl font-bold mt-1">{topSkills.length}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">High Priority</p>
            <p className="text-3xl font-bold mt-1 text-red-600">
              {topSkills.filter(([, v]) => v.priority === "high").length}
            </p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Learning Plans</p>
            <p className="text-3xl font-bold mt-1">{withLearningPlan.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{coveragePct}% coverage</p>
          </CardContent>
        </Card>
      </div>

      {/* Learning Plan Coverage */}
      {allAnalyses.length > 0 && (
        <Card className="border shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Learning Plan Coverage
              </p>
              <span className="text-xs text-muted-foreground">{withLearningPlan.length} of {allAnalyses.length} analyses</span>
            </div>
            <Progress value={coveragePct} className="h-2" />
            {withLearningPlan.length < allAnalyses.length && (
              <p className="text-xs text-muted-foreground mt-2">
                {allAnalyses.length - withLearningPlan.length} {allAnalyses.length - withLearningPlan.length === 1 ? "analysis" : "analyses"} still need learning plans generated.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top Skill Gaps */}
      {topSkills.length > 0 ? (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Top Skill Gaps
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Skills you need most across all your target roles, sorted by priority and frequency.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {displayedSkills.map(([skill, data]) => {
              const priorityConfig = PRIORITY_CONFIG[data.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
              return (
                <div key={skill} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{skill}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${priorityConfig.className}`}>
                          {priorityConfig.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Needed in {data.count} {data.count === 1 ? "analysis" : "analyses"}
                        {data.analyses.length > 0 && ` · ${data.analyses.slice(0, 2).join(", ")}${data.analyses.length > 2 ? ` +${data.analyses.length - 2}` : ""}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-2xl font-bold text-primary">{data.count}</span>
                    </div>
                  </div>
                  {data.resources.length > 0 && (
                    <div className="space-y-1.5">
                      {data.resources.slice(0, 2).map((res, j) => (
                        <div key={j} className="flex items-start gap-2.5 bg-muted/40 rounded-lg px-3 py-2">
                          <span className="mt-0.5 text-muted-foreground shrink-0">
                            {resourceTypeIcon(res.type)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-semibold">{res.title}</p>
                              {res.platform && (
                                <span className="text-xs text-muted-foreground">· {res.platform}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{res.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {topSkills.length > 8 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setShowAll(!showAll)}
              >
                <ChevronRight className={`w-3.5 h-3.5 mr-1 transition-transform ${showAll ? "rotate-90" : ""}`} />
                {showAll ? "Show less" : `Show ${topSkills.length - 8} more skills`}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No skill gap data yet</p>
            <p className="text-sm mt-1">Generate learning plans on your analysis pages to see aggregated skills here.</p>
          </CardContent>
        </Card>
      )}

      {/* Missing ATS Keywords */}
      {topKeywords.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" /> Most Missing ATS Keywords
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Keywords appearing in job descriptions but missing from your resumes, ranked by frequency.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topKeywords.map(([kw, count], i) => (
                <div key={i} className="inline-flex items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                  >
                    {kw}
                  </Badge>
                  <span className="text-xs text-muted-foreground">×{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation to individual analyses */}
      {withLearningPlan.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-blue-500" /> Analyses with Learning Plans
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {withLearningPlan.map((a) => (
              <button
                key={a.id}
                onClick={() => setLocation(`/analysis/${a.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/60 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.jobTitle}</p>
                  {a.companyName && <p className="text-xs text-muted-foreground">{a.companyName}</p>}
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {(a.learningPlan as LearningPlanItem[]).length} skills
                </Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
