import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetAnalysis,
  getGetAnalysisQueryKey,
  useGenerateCoverLetter,
  useGenerateLinkedinPost,
  useDeleteAnalysis,
  useRewriteBullet,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScoreCircle } from "@/components/score-circle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useCopy } from "@/hooks/use-copy";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  Copy,
  Check,
  FileText,
  Linkedin,
  Trash2,
  ArrowLeft,
  ChevronRight,
  Wand2,
  ArrowRightLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function BulletRewriter({ analysisId }: { analysisId: number }) {
  const [bulletText, setBulletText] = useState("");
  const [result, setResult] = useState<{ original: string; rewritten: string } | null>(null);
  const { copy, isCopied } = useCopy();

  const rewrite = useRewriteBullet({
    mutation: {
      onSuccess: (data) => setResult(data),
    },
  });

  const handleRewrite = () => {
    if (!bulletText.trim()) return;
    setResult(null);
    rewrite.mutate({ id: analysisId, data: { bulletText: bulletText.trim() } });
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-purple-500" /> AI Bullet Rewriter
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-0.5">
          Paste a resume bullet point and get a stronger version optimized for this role's missing keywords.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Worked on frontend features for the company website"
            value={bulletText}
            onChange={(e) => setBulletText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRewrite()}
            className="flex-1"
            data-testid="input-bullet-text"
          />
          <Button
            onClick={handleRewrite}
            disabled={rewrite.isPending || !bulletText.trim()}
            className="shrink-0"
            data-testid="button-rewrite"
          >
            {rewrite.isPending ? (
              <Wand2 className="w-4 h-4 animate-pulse" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            <span className="ml-2 hidden sm:inline">{rewrite.isPending ? "Rewriting..." : "Rewrite"}</span>
          </Button>
        </div>

        {rewrite.isPending && (
          <div className="space-y-2 pt-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        )}

        {result && !rewrite.isPending && (
          <div className="space-y-3 pt-1">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original</p>
              <p className="text-sm text-muted-foreground line-through">{result.original}</p>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-purple-400" />
            </div>
            <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">Rewritten</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-purple-600 dark:text-purple-400"
                  onClick={() => copy(result.rewritten, "Bullet copied")}
                  data-testid="button-copy-bullet"
                >
                  {isCopied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                  Copy
                </Button>
              </div>
              <p className="text-sm font-medium">{result.rewritten}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setBulletText("");
                setResult(null);
              }}
            >
              Try another bullet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Analysis() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { copy, isCopied } = useCopy();

  const { data: analysis, isLoading } = useGetAnalysis(id, {
    query: { enabled: !!id, queryKey: getGetAnalysisQueryKey(id) },
  });

  const generateCoverLetter = useGenerateCoverLetter({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) }),
    },
  });

  const generateLinkedinPost = useGenerateLinkedinPost({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) }),
    },
  });

  const deleteAnalysis = useDeleteAnalysis({
    mutation: {
      onSuccess: () => setLocation("/"),
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Analysis not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/")}>
          Go back
        </Button>
      </div>
    );
  }

  const strengths = (analysis.strengths as string[]) ?? [];
  const gaps = (analysis.gaps as string[]) ?? [];
  const improvements = (analysis.improvements as string[]) ?? [];
  const atsMatched = (analysis.atsKeywordsMatched as string[]) ?? [];
  const atsMissing = (analysis.atsKeywordsMissing as string[]) ?? [];

  return (
    <div className="space-y-8" data-testid={`analysis-${id}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <h1 className="text-2xl font-bold tracking-tight">{analysis.jobTitle}</h1>
          {analysis.companyName && (
            <p className="text-muted-foreground mt-0.5">{analysis.companyName}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => deleteAnalysis.mutate({ id })}
          disabled={deleteAnalysis.isPending}
          data-testid="button-delete"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
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
              How well your resume passes automated applicant tracking systems.
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
            {strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">No strengths identified.</p>
            ) : (
              strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm" data-testid={`strength-${i}`}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" /> Gaps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No critical gaps identified.</p>
            ) : (
              gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-sm" data-testid={`gap-${i}`}>
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                  <span>{g}</span>
                </div>
              ))
            )}
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
          {improvements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No improvement suggestions.</p>
          ) : (
            improvements.map((imp, i) => (
              <div key={i} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-muted/50" data-testid={`improvement-${i}`}>
                <ChevronRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <span>{imp}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ATS Keywords */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ATS Keywords</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-green-600 mb-2">Matched</p>
            <div className="flex flex-wrap gap-2">
              {atsMatched.length === 0 ? (
                <p className="text-sm text-muted-foreground">None matched</p>
              ) : (
                atsMatched.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" data-testid={`keyword-matched-${i}`}>
                    {kw}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-destructive mb-2">Missing</p>
            <div className="flex flex-wrap gap-2">
              {atsMissing.length === 0 ? (
                <p className="text-sm text-muted-foreground">No missing keywords</p>
              ) : (
                atsMissing.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" data-testid={`keyword-missing-${i}`}>
                    {kw}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Bullet Rewriter */}
      <BulletRewriter analysisId={id} />

      {/* Cover Letter */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Tailored Cover Letter
          </CardTitle>
          <div className="flex gap-2">
            {analysis.coverLetter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(analysis.coverLetter!, "Cover letter copied")}
                data-testid="button-copy-cover-letter"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                Copy
              </Button>
            )}
            <Button
              size="sm"
              variant={analysis.coverLetter ? "outline" : "default"}
              onClick={() => generateCoverLetter.mutate({ id, data: {} })}
              disabled={generateCoverLetter.isPending}
              data-testid="button-generate-cover-letter"
            >
              {generateCoverLetter.isPending ? "Generating..." : analysis.coverLetter ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {generateCoverLetter.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : analysis.coverLetter ? (
            <Textarea
              value={analysis.coverLetter}
              readOnly
              className="min-h-[300px] font-mono text-sm resize-none bg-muted/30"
              data-testid="textarea-cover-letter"
            />
          ) : (
            <p className="text-sm text-muted-foreground py-4">Click "Generate" to create a tailored cover letter for this role.</p>
          )}
        </CardContent>
      </Card>

      {/* LinkedIn Post */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Linkedin className="w-4 h-4 text-[#0077b5]" /> LinkedIn Post
          </CardTitle>
          <div className="flex gap-2">
            {analysis.linkedinPost && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(analysis.linkedinPost!, "LinkedIn post copied")}
                data-testid="button-copy-linkedin"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                Copy
              </Button>
            )}
            <Button
              size="sm"
              variant={analysis.linkedinPost ? "outline" : "default"}
              onClick={() => generateLinkedinPost.mutate({ id })}
              disabled={generateLinkedinPost.isPending}
              data-testid="button-generate-linkedin"
            >
              {generateLinkedinPost.isPending ? "Generating..." : analysis.linkedinPost ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {generateLinkedinPost.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : analysis.linkedinPost ? (
            <Textarea
              value={analysis.linkedinPost}
              readOnly
              className="min-h-[180px] text-sm resize-none bg-muted/30"
              data-testid="textarea-linkedin"
            />
          ) : (
            <p className="text-sm text-muted-foreground py-4">Click "Generate" to create a LinkedIn post announcing your job search.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
