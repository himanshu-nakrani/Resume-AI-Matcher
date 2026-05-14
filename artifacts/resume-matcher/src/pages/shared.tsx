import { useParams } from "wouter";
import { useGetSharedAnalysis } from "@workspace/api-client-react";
import type { LearningPlanItem, LearningResource } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  ChevronRight,
  BookOpen,
  Award,
  Hammer,
  BookMarked,
  FileText,
  GraduationCap,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function resourceTypeIcon(type: LearningResource["type"]) {
  switch (type) {
    case "course": return <BookOpen className="w-3.5 h-3.5" />;
    case "certification": return <Award className="w-3.5 h-3.5" />;
    case "project": return <Hammer className="w-3.5 h-3.5" />;
    case "book": return <BookMarked className="w-3.5 h-3.5" />;
    default: return <BookOpen className="w-3.5 h-3.5" />;
  }
}

const PRIORITY_CONFIG = {
  high: { label: "High Priority", className: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
};

export function SharedAnalysis() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data: analysis, isLoading, isError } = useGetSharedAnalysis(token, {
    query: { enabled: !!token, queryKey: ["shared", token] },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (isError || !analysis) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Sparkles className="w-10 h-10 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-semibold">Analysis Not Found</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          This shared analysis is either no longer public or the link is invalid.
        </p>
      </div>
    );
  }

  const strengths = (analysis.strengths as string[]) ?? [];
  const gaps = (analysis.gaps as string[]) ?? [];
  const improvements = (analysis.improvements as string[]) ?? [];
  const atsMatched = (analysis.atsKeywordsMatched as string[]) ?? [];
  const atsMissing = (analysis.atsKeywordsMissing as string[]) ?? [];
  const interviewQuestions = (analysis.interviewQuestions as string[]) ?? [];
  const learningPlan = (analysis.learningPlan as LearningPlanItem[]) ?? [];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="bg-card border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 font-bold text-lg text-primary">
          <Sparkles className="w-4 h-4" />
          <span>OptiMatch</span>
        </div>
        <Badge variant="secondary" className="text-xs">Shared Analysis</Badge>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{analysis.jobTitle}</h1>
          {analysis.companyName && (
            <p className="text-muted-foreground mt-0.5">{analysis.companyName}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Analyzed {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
          </p>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border shadow-sm">
            <CardContent className="pt-6 flex flex-col items-center gap-2 pb-6">
              <ScoreCircle score={analysis.fitScore} size="lg" label="Fit Score" />
              <p className="text-sm text-muted-foreground text-center max-w-xs mt-2">{analysis.fitRationale}</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="pt-6 flex flex-col items-center gap-2 pb-6">
              <ScoreCircle score={analysis.atsScore} size="lg" label="ATS Score" />
              <p className="text-sm text-muted-foreground text-center max-w-xs mt-2">
                How well the resume passes automated applicant tracking systems.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Strengths & Gaps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Strengths
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" /> Gaps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                  <span>{g}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Improvements */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" /> Resume Improvements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {improvements.map((imp, i) => (
              <div key={i} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-muted/50">
                <ChevronRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <span>{imp}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ATS Keywords */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ATS Keywords</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-200 mb-2">Matched</p>
              <div className="flex flex-wrap gap-2">
                {atsMatched.map((kw, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="border-emerald-300 bg-emerald-50 text-emerald-950 shadow-none dark:border-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-50"
                  >
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-200 mb-2">Missing</p>
              <div className="flex flex-wrap gap-2">
                {atsMissing.map((kw, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="border-rose-300 bg-rose-50 text-rose-950 shadow-none dark:border-rose-600 dark:bg-rose-950/45 dark:text-rose-50"
                  >
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interview Questions (if any) */}
        {interviewQuestions.length > 0 && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-orange-500" /> Interview Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {interviewQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm">{q}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Learning Plan (if any) */}
        {learningPlan.length > 0 && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-500" /> Learning Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {learningPlan.map((item, i) => {
                  const priority = PRIORITY_CONFIG[item.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
                  return (
                    <div key={i} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{item.skill}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.why}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${priority.className}`}>
                          {priority.label}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {item.resources.map((res, j) => (
                          <div key={j} className="flex items-start gap-2.5 bg-muted/40 rounded-lg px-3 py-2">
                            <span className="mt-0.5 text-muted-foreground shrink-0">
                              {resourceTypeIcon(res.type as LearningResource["type"])}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-semibold">{res.title}</p>
                                {res.platform && <span className="text-xs text-muted-foreground">· {res.platform}</span>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{res.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cover Letter */}
        {analysis.coverLetter && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Cover Letter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm font-mono bg-muted/30 rounded-lg p-4">
                {analysis.coverLetter}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Created with <span className="font-semibold text-primary">OptiMatch</span> · AI Resume & Job Matcher
        </p>
      </div>
    </div>
  );
}
