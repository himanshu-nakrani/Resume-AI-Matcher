import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  BriefcaseBusiness,
  MapPin,
  DollarSign,
  MousePointerClick,
  FileText,
  Briefcase,
  Clock,
  ListChecks,
} from "lucide-react";
import {
  useEnrichJobContent,
  type EnrichJobResponse,
  type JobSearchResponse,
} from "@workspace/api-client-react";

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

export function JobDetailModal({ open, onOpenChange, hit, onImport, matchScore }: JobDetailModalProps) {
  const [enriched, setEnriched] = useState<EnrichJobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mutate: enrich, isPending } = useEnrichJobContent();

  useEffect(() => {
    if (!open || !hit) return;
    setEnriched(null);
    setError(null);
    enrich(
      { data: { url: hit.url, title: hit.title } },
      {
        onSuccess: (data) => setEnriched(data),
        onError: () => setError("Could not load job details. The page may block automated access."),
      },
    );
  }, [open, hit, enrich]);

  if (!hit) return null;

  const source = getHostname(hit.url);
  const displayTitle = hit.title;
  const hasStructured =
    enriched &&
    (enriched.employmentType ||
      enriched.location ||
      enriched.postedDate ||
      enriched.compensation);
  const hasRequirements = enriched && enriched.requirements.length > 0;
  const hasResponsibilities = enriched && enriched.responsibilities.length > 0;

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

          {enriched?.summary && (
            <p className="text-sm text-foreground/90 leading-relaxed italic border-l-2 border-primary/40 pl-3">
              {enriched.summary}
            </p>
          )}

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

          {hasStructured && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Job details</h4>
              <div className="flex flex-wrap gap-2">
                {enriched!.employmentType && (
                  <Badge variant="outline" className="font-normal">
                    <Briefcase className="w-3 h-3 mr-1" /> {enriched!.employmentType}
                  </Badge>
                )}
                {enriched!.location && (
                  <Badge variant="outline" className="font-normal">
                    <MapPin className="w-3 h-3 mr-1" /> {enriched!.location}
                  </Badge>
                )}
                {enriched!.postedDate && (
                  <Badge variant="outline" className="font-normal">
                    <Clock className="w-3 h-3 mr-1" /> {enriched!.postedDate}
                  </Badge>
                )}
                {enriched!.compensation && (
                  <Badge variant="outline" className="font-normal">
                    <DollarSign className="w-3 h-3 mr-1" /> {enriched!.compensation}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {hasRequirements && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <ListChecks className="w-4 h-4" /> Requirements
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                {enriched!.requirements.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed">{r}</li>
                ))}
              </ul>
            </div>
          )}

          {hasResponsibilities && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <ListChecks className="w-4 h-4" /> Responsibilities
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                {enriched!.responsibilities.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed">{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Full Job Description</h4>
            {isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : error ? (
              <p className="text-sm text-muted-foreground">{error}</p>
            ) : enriched?.fullDescription ? (
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line max-h-[60vh] overflow-y-auto border rounded-md p-4 bg-muted/20">
                {enriched.fullDescription}
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
