import { useState } from "react";
import type { Analysis } from "@workspace/api-client-react";
import {
  useGenerateCoverLetter,
  getGetAnalysisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/hooks/use-copy";
import { FileText, Copy, Check, Sparkles, Wand2 } from "lucide-react";
import { TONE_OPTIONS, type CoverLetterTone } from "./shared";
import { cn } from "@/lib/utils";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function CoverLetterTab({ analysis, id }: TabProps) {
  const { copy, isCopied } = useCopy();
  const queryClient = useQueryClient();
  const [coverLetterTone, setCoverLetterTone] =
    useState<CoverLetterTone>("professional");
  const [coverLetterVariation, setCoverLetterVariation] = useState<
    string | null
  >(null);

  const generateCoverLetter = useGenerateCoverLetter({
    mutation: {
      onSuccess: (data) => {
        if (generateCoverLetter.variables?.data?.tone !== coverLetterTone) {
          setCoverLetterVariation(data.content);
        } else {
          queryClient.invalidateQueries({
            queryKey: getGetAnalysisQueryKey(id),
          });
        }
      },
    },
  });

  const generateVariation = () => {
    const currentIndex = TONE_OPTIONS.findIndex(
      (t) => t.value === coverLetterTone,
    );
    const nextTone =
      TONE_OPTIONS[(currentIndex + 1) % TONE_OPTIONS.length].value;
    generateCoverLetter.mutate({ id, data: { tone: nextTone } });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px] flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-accent" /> Tailored cover
            letter
          </CardTitle>
          <div className="flex gap-2 no-print">
            {analysis.coverLetter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  copy(analysis.coverLetter!, "Cover letter copied")
                }
                aria-label="Copy tailored cover letter"
                data-testid="button-copy-cover-letter"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 mr-1" />
                ) : (
                  <Copy className="w-3.5 h-3.5 mr-1" />
                )}
                Copy
              </Button>
            )}
            <Button
              size="sm"
              variant={analysis.coverLetter ? "secondary" : "default"}
              onClick={() =>
                generateCoverLetter.mutate({
                  id,
                  data: { tone: coverLetterTone },
                })
              }
              disabled={generateCoverLetter.isPending}
              aria-label={
                analysis.coverLetter
                  ? "Regenerate tailored cover letter"
                  : "Generate tailored cover letter"
              }
              data-testid="button-generate-cover-letter"
            >
              {generateCoverLetter.isPending
                ? "Generating..."
                : analysis.coverLetter
                  ? "Regenerate"
                  : "Generate"}
            </Button>
          </div>
        </div>
        <div className="mt-4 no-print">
          <p
            id="cover-letter-tone-label"
            className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground mb-2"
          >
            Tone
          </p>
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            role="group"
            aria-labelledby="cover-letter-tone-label"
          >
            {TONE_OPTIONS.map((tone) => (
              <button
                type="button"
                key={tone.value}
                onClick={() => setCoverLetterTone(tone.value)}
                aria-pressed={coverLetterTone === tone.value}
                className={cn(
                  "rounded-md border px-3 py-2 text-left transition-colors",
                  coverLetterTone === tone.value
                    ? "border-accent bg-accent-soft"
                    : "border-border hover:border-border-strong",
                )}
                data-testid={`tone-${tone.value}`}
              >
                <p
                  className={cn(
                    "text-[12px] font-semibold",
                    coverLetterTone === tone.value && "text-accent",
                  )}
                >
                  {tone.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {tone.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {generateCoverLetter.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : analysis.coverLetter ? (
          <>
            <label htmlFor="cover-letter-output" className="sr-only">
              Tailored cover letter content
            </label>
            <Textarea
              id="cover-letter-output"
              value={analysis.coverLetter}
              readOnly
              className="min-h-[300px] font-mono text-[13px] resize-none"
              data-testid="textarea-cover-letter"
            />
            <div className="pt-2 flex flex-col gap-4">
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={generateVariation}
                disabled={generateCoverLetter.isPending}
                aria-label="Generate second cover letter variation"
              >
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Generate 2nd variation
              </Button>
              {coverLetterVariation && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-subtle-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Wand2 className="w-3 h-3" /> Alternative variation
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copy(coverLetterVariation, "Variation copied")
                      }
                      aria-label="Copy cover letter variation"
                    >
                      {isCopied ? (
                        <Check className="w-3 h-3 mr-1" />
                      ) : (
                        <Copy className="w-3 h-3 mr-1" />
                      )}
                      Copy variation
                    </Button>
                  </div>
                  <label
                    htmlFor="cover-letter-variation-output"
                    className="sr-only"
                  >
                    Alternative cover letter variation content
                  </label>
                  <Textarea
                    id="cover-letter-variation-output"
                    value={coverLetterVariation}
                    readOnly
                    className="min-h-[300px] font-mono text-[13px] resize-none border-accent/30 bg-accent-soft"
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground py-4">
            Select a tone above, then click "Generate" to create a tailored
            cover letter.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
