import { useState } from "react";
import type { Analysis } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCopy } from "@/hooks/use-copy";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/api-error";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  ChevronRight,
  FileText,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { BulletRewriter, InterviewChecklist } from "./shared";

interface TabProps {
  analysis: Analysis;
  id: number;
}

function safeFileName(
  parts: Array<string | null | undefined>,
  ext: string,
): string {
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

async function pdfErrorMessageFromResponse(
  response: Response,
): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    return apiErrorMessage(payload, "Could not compile optimized resume PDF.");
  }

  const text = await response.text().catch(() => "");
  const message = text.trim();
  return (
    message ||
    `Could not compile optimized resume PDF. Server returned ${response.status}.`
  );
}

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

function EmptyLine({ children }: { children: string }) {
  return (
    <p className="rounded-md bg-surface-2 px-3 py-2 text-[13px] text-muted-foreground">
      {children}
    </p>
  );
}

export function OverviewTab({ analysis, id }: TabProps) {
  const { copy, isCopied } = useCopy();
  const { toast } = useToast();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const strengths = stringArray(analysis.strengths);
  const gaps = stringArray(analysis.gaps);
  const improvements = stringArray(analysis.improvements);
  const atsMatched = stringArray(analysis.atsKeywordsMatched);
  const atsMissing = stringArray(analysis.atsKeywordsMissing);
  const fitScore = safeScore(analysis.fitScore);
  const atsScore = safeScore(analysis.atsScore);
  const fitRationale =
    typeof analysis.fitRationale === "string" && analysis.fitRationale.trim()
      ? analysis.fitRationale.trim()
      : "No fit rationale was returned for this analysis.";
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
      const response = await fetch(`/api/analyses/${id}/resume.pdf?repair=1`, {
        headers: {
          Accept: "application/pdf, application/json",
        },
      });
      if (!response.ok) {
        throw new Error(await pdfErrorMessageFromResponse(response));
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/pdf")) {
        throw new Error(await pdfErrorMessageFromResponse(response));
      }

      const blob = await response.blob();
      const fileName = safeFileName(
        [analysis.companyName, analysis.jobTitle],
        "pdf",
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "PDF downloaded",
        description: "Compiled from optimized LaTeX.",
      });
    } catch (err) {
      toast({
        title: "Could not download PDF",
        description:
          err instanceof Error
            ? err.message
            : "Could not compile optimized resume PDF.",
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-[15px] flex min-w-0 items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-accent" /> Optimized
                resume LaTeX
              </CardTitle>
              <div className="flex flex-wrap gap-2 no-print sm:justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(optimizedLatex, "Optimized LaTeX copied")}
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1" />
                  )}
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    downloadTextFile(
                      optimizedLatex,
                      safeFileName(
                        [analysis.companyName, analysis.jobTitle],
                        "tex",
                      ),
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
              AI-tailored LaTeX resume for{" "}
              {analysis.companyName ?? "this company"} and {analysis.jobTitle}.
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              value={optimizedLatex}
              readOnly
              className="min-h-[360px] font-mono text-[12px] resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-3 no-print">
              Download PDF validates and repairs this optimized LaTeX with AI,
              then compiles it on the API server.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-2">
            <ScoreCircle score={fitScore} size="lg" label="Fit Score" />
            <p className="text-[13px] text-muted-foreground text-center max-w-xs mt-2">
              {fitRationale}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-2">
            <ScoreCircle score={atsScore} size="lg" label="ATS Score" />
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
              <EmptyLine>
                No strengths were returned for this analysis.
              </EmptyLine>
            ) : (
              strengths.map((s, i) => (
                <div
                  key={`${s}-${i}`}
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
              <EmptyLine>
                No critical gaps were returned for this analysis.
              </EmptyLine>
            ) : (
              gaps.map((g, i) => (
                <div
                  key={`${g}-${i}`}
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
            <Lightbulb className="w-3.5 h-3.5 text-warning" /> Resume
            improvements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {improvements.length === 0 ? (
            <EmptyLine>
              No improvement suggestions were returned for this analysis.
            </EmptyLine>
          ) : (
            improvements.map((imp, i) => (
              <div
                key={`${imp}-${i}`}
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
                <EmptyLine>No matched ATS keywords were returned.</EmptyLine>
              ) : (
                atsMatched.map((kw, i) => (
                  <Badge
                    key={`${kw}-${i}`}
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
                <EmptyLine>No missing ATS keywords were returned.</EmptyLine>
              ) : (
                atsMissing.map((kw, i) => (
                  <Badge
                    key={`${kw}-${i}`}
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
