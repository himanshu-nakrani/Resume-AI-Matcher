import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, BriefcaseBusiness, MapPin, DollarSign, MousePointerClick, FileText } from "lucide-react";
import type { JobSearchResponse } from "@workspace/api-client-react";

type JobSearchHit = JobSearchResponse["results"][number];

interface JobDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hit: JobSearchHit | null;
  onImport?: (url: string) => void;
  matchScore?: number | null;
  matchLoading?: boolean;
}

function getHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "job source"; }
}

export function JobDetailModal({ open, onOpenChange, hit, onImport, matchScore, matchLoading }: JobDetailModalProps) {
  const [jdText, setJdText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && hit) {
      setJdText(null);
      setError(null);
      setLoading(true);
      fetch(`/api/job-search/pre-screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobUrl: hit.url, resumeText: "" }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error("Failed");
          // Fetch the actual job description
          return fetch(hit.url, { signal: AbortSignal.timeout(10000) })
            .then((htmlR) => htmlR.text())
            .then((html) => {
              const text = html
                .replace(/<script[\s\S]*?<\/script>/gi, " ")
                .replace(/<style[\s\S]*?<\/style>/gi, " ")
                .replace(/<[^>]+>/g, " ")
                .replace(/&nbsp;/g, " ")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\s{3,}/g, "\n\n")
                .trim()
                .slice(0, 8000);
              setJdText(text || null);
              if (!text) setError("Could not extract content from this page.");
            });
        })
        .catch(() => setError("Could not load job details. The page may block automated access."))
        .finally(() => setLoading(false));
    }
  }, [open, hit]);

  if (!hit) return null;

  const source = getHostname(hit.url);
  const displayTitle = hit.title;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg leading-snug pr-8">{displayTitle}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline">{source}</Badge>
            {hit.applyType === "ats" && (
              <Badge variant="secondary" className="text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <MousePointerClick className="w-3 h-3 mr-1" /> Easy Apply
              </Badge>
            )}
            {hit.salary && (
              <Badge variant="secondary" className="text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <DollarSign className="w-3 h-3 mr-1" /> {hit.salary}
              </Badge>
            )}
            {matchScore != null && (
              <Badge
                variant="secondary"
                className={
                  matchScore >= 70
                    ? "text-green-700 bg-green-50 border-green-200"
                    : matchScore >= 45
                      ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-red-700 bg-red-50 border-red-200"
                }
              >
                <BriefcaseBusiness className="w-3 h-3 mr-1" /> {matchScore}% match
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" asChild variant="outline">
              <a href={hit.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open original
              </a>
            </Button>
            {onImport && (
              <Button size="sm" onClick={() => onImport(hit.url)}>
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Import JD
              </Button>
            )}
          </div>

          {hit.highlights && hit.highlights.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Highlights</h4>
              <div className="space-y-1.5">
                {hit.highlights.slice(0, 5).map((h, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed">{h}</p>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Full Job Description</h4>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : error ? (
              <p className="text-sm text-muted-foreground">{error}</p>
            ) : jdText ? (
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line max-h-[60vh] overflow-y-auto border rounded-md p-4 bg-muted/20">
                {jdText}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No content extracted.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
