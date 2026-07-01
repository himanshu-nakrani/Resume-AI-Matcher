import { useState } from "react";
import type { Analysis } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCopy } from "@/hooks/use-copy";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, Lightbulb, ChevronRight, FileText, Copy, Check, Download,
} from "lucide-react";
import { BulletRewriter, InterviewChecklist } from "./shared";

interface TabProps {
  analysis: Analysis;
  id: number;
}

function safeFileName(parts: Array<string | null | undefined>, ext: string): string {
  const base = parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "resume"}.${ext}`;
}

function downloadTextFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function OverviewTab({ analysis, id }: TabProps) {
  const { copy, isCopied } = useCopy();
  const { toast } = useToast();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const strengths = (analysis.strengths as string[]) ?? [];
  const gaps = (analysis.gaps as string[]) ?? [];
  const improvements = (analysis.improvements as string[]) ?? [];
  const atsMatched = (analysis.atsKeywordsMatched as string[]) ?? [];
  const atsMissing = (analysis.atsKeywordsMissing as string[]) ?? [];
  const optimizedLatex =
    (analysis as { optimizedLatex?: string | null }).optimizedLatex ?? null;

  const downloadOptimizedPdf = async () => {
    if (!optimizedLatex) {
      toast({
        title: "PDF unavailable",
        description: "This analysis does not have optimized LaTeX to compile.",
        variant: "destructive",
      });
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const response = await fetch(`/api/analyses/${id}/resume.pdf`, {
        headers: {
          Accept: "application/pdf, application/json",
        },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not compile optimized resume PDF.");
      }
      const blob = await response.blob();
      const fileName = safeFileName([analysis.companyName, analysis.jobTitle], "pdf");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({
        title: "PDF downloaded",
        description: "Validated by AI, then compiled from optimized LaTeX.",
      });
    } catch (err) {
      toast({
        title: "Could not download PDF",
        description:
          err instanceof Error ? err.message : "Could not compile optimized resume PDF.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {optimizedLatex && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[15px] flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-accent" /> Optimized resume LaTeX
              </CardTitle>
              <div className="flex gap-2 no-print">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(optimizedLatex, "Optimized LaTeX copied")}
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    downloadTextFile(
                      optimizedLatex,
                      safeFileName([analysis.companyName, analysis.jobTitle], "tex"),
                    )
                  }
                >
                  Download LaTeX
                </Button>
                <Button
                  size="sm"
                  onClick={downloadOptimizedPdf}
                  disabled={isDownloadingPdf}
                  data-testid="button-export-pdf"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  {isDownloadingPdf ? "Validating…" : "PDF"}
                </Button>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground mt-1">
              AI-tailored LaTeX resume for {analysis.companyName ?? "this company"} and {analysis.jobTitle}.
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              value={optimizedLatex}
              readOnly
              className="min-h-[360px] font-mono text-[12px] resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-3 no-print">
              Download PDF validates and repairs this optimized LaTeX with AI, then compiles it on the API server.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-2">
            <ScoreCircle score={analysis.fitScore} size="lg" label="Fit Score" />
            <p className="text-[13px] text-muted-foreground text-center max-w-xs mt-2">
              {analysis.fitRationale}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-2">
            <ScoreCircle score={analysis.atsScore} size="lg" label="ATS Score" />
            <p className="text-[13px] text-muted-foreground text-center max-w-xs mt-2">
              How well your resume passes automated applicant tracking systems.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Strengths & Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Strengths
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {strengths.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No strengths identified.</p>
            ) : (
              strengths.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-[13px]"
                  data-testid={`strength-${i}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] flex items-center gap-2">
              <XCircle className="w-3.5 h-3.5 text-destructive" /> Gaps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {gaps.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No critical gaps identified.</p>
            ) : (
              gaps.map((g, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-[13px]"
                  data-testid={`gap-${i}`}
                >
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                  <span>{g}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Improvements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-warning" /> Resume improvements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {improvements.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No improvement suggestions.</p>
          ) : (
            improvements.map((imp, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-[13px] p-3 rounded-md bg-surface-2"
                data-testid={`improvement-${i}`}
              >
                <ChevronRight className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                <span>{imp}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ATS Keywords */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px]">ATS keywords</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground mb-2">
              Matched
            </p>
            <div className="flex flex-wrap gap-2">
              {atsMatched.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">None matched</p>
              ) : (
                atsMatched.map((kw, i) => (
                  <Badge
                    key={i}
                    variant="success"
                    size="sm"
                    data-testid={`keyword-matched-${i}`}
                  >
                    {kw}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground mb-2">
              Missing
            </p>
            <div className="flex flex-wrap gap-2">
              {atsMissing.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No missing keywords</p>
              ) : (
                atsMissing.map((kw, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    size="sm"
                    data-testid={`keyword-missing-${i}`}
                  >
                    {kw}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bullet rewriter */}
      <BulletRewriter analysisId={id} />

      {/* Interview checklist */}
      <InterviewChecklist analysisId={id} />
    </div>
  );
}
