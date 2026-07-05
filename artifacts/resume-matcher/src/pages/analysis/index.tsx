import { useState } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import {
  useGetAnalysis,
  getGetAnalysisQueryKey,
  getListAnalysesQueryKey,
  useDeleteAnalysis,
  useUpdateAnalysis,
  useDuplicateAnalysis,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { unknownErrorMessage } from "@/lib/api-error";
import {
  ArrowLeft,
  Heart,
  Trash2,
  GitCompareArrows,
  CalendarClock,
  Tag,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ShareSection } from "./shared";
import { OverviewTab } from "./overview-tab";
import { CoverLetterTab } from "./cover-letter-tab";
import { LinkedInTab } from "./linkedin-tab";
import { PipelineTab } from "./pipeline-tab";
import { NotesTab } from "./notes-tab";

const TAB_VALUES = [
  "overview",
  "cover-letter",
  "linkedin",
  "pipeline",
  "notes",
] as const;
type TabValue = (typeof TAB_VALUES)[number];
const ANALYSIS_TAB_CONTENT_CLASS = "pt-1";

function isTabValue(v: string | null | undefined): v is TabValue {
  return v != null && (TAB_VALUES as readonly string[]).includes(v);
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

function dateValue(value: unknown): Date | null {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function relativeDate(value: unknown): string {
  const date = dateValue(value);
  return date
    ? formatDistanceToNow(date, { addSuffix: true })
    : "Date unavailable";
}

function shortDate(value: unknown): string | null {
  const date = dateValue(value);
  return date ? format(date, "MMM d") : null;
}

export function Analysis() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const {
    data: analysis,
    isLoading,
    error,
    refetch: refetchAnalysis,
    isFetching,
  } = useGetAnalysis(id, {
    query: { enabled: !!id, queryKey: getGetAnalysisQueryKey(id) },
  });

  const tabParam = new URLSearchParams(search).get("tab");
  const activeTab: TabValue = isTabValue(tabParam) ? tabParam : "overview";
  const setTab = (next: string) => {
    setLocation(`/analysis/${id}?tab=${next}`, { replace: true });
  };

  const deleteAnalysis = useDeleteAnalysis({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        toast({ title: "Analysis deleted" });
        setLocation("/history");
      },
      onError: (err) => {
        toast({
          title: "Could not delete analysis",
          description: unknownErrorMessage(err),
          variant: "destructive",
        });
      },
    },
  });

  const updateAnalysis = useUpdateAnalysis({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        toast({
          title: analysis?.isFavorite
            ? "Removed from favorites"
            : "Added to favorites",
        });
      },
      onError: (err) => {
        toast({
          title: "Could not update analysis",
          description: unknownErrorMessage(err),
          variant: "destructive",
        });
      },
    },
  });

  const duplicateAnalysis = useDuplicateAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        toast({
          title: "Analysis duplicated",
          description: "Opening the copy now.",
        });
        setLocation(`/analysis/${data.id}`);
      },
      onError: (err) => {
        toast({
          title: "Could not duplicate analysis",
          description: unknownErrorMessage(err),
          variant: "destructive",
        });
      },
    },
  });

  const handleDelete = () => {
    setIsDeleteOpen(true);
  };

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

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-sm font-medium text-destructive">
          Could not load analysis.
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {unknownErrorMessage(error)}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => setLocation("/history")}>
            Back to analyses
          </Button>
          <Button onClick={() => void refetchAnalysis()} disabled={isFetching}>
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            {isFetching ? "Retrying..." : "Retry"}
          </Button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-20">
        <p className="text-[13px] text-muted-foreground">Analysis not found.</p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => setLocation("/history")}
        >
          Go back
        </Button>
      </div>
    );
  }

  const tags = stringArray(analysis.tags);
  const isSampled = tags.includes("sample");
  const visibleTags = tags.filter((tag) => tag !== "sample");
  const deadlineLabel = shortDate(analysis.deadline);
  const followUpLabel = shortDate(analysis.followUpDate);

  return (
    <div className="space-y-0" data-testid={`analysis-${id}`}>
      <Tabs value={activeTab} onValueChange={setTab}>
        <div className="z-30 -mx-4 mb-6 border-b border-border bg-background/95 px-4 pb-3 backdrop-blur sm:-mx-6 sm:px-6 md:sticky md:top-12 md:pt-4 md:shadow-[0_1px_0_0_hsl(var(--border))]">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-2 transition-colors no-print"
            data-testid="button-back"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">
                  {analysis.jobTitle}
                </h1>
                {isSampled && (
                  <Badge variant="soft" size="sm">
                    Sample
                  </Badge>
                )}
              </div>
              {analysis.companyName && (
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {analysis.companyName}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                {relativeDate(analysis.createdAt)}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {deadlineLabel && (
                  <Badge variant="warning" size="sm">
                    <CalendarClock className="w-3 h-3 mr-1" />
                    Due {deadlineLabel}
                  </Badge>
                )}
                {followUpLabel && (
                  <Badge variant="info" size="sm">
                    <CalendarClock className="w-3 h-3 mr-1" />
                    Follow-up {followUpLabel}
                  </Badge>
                )}
                {visibleTags.map((tag) => (
                  <Badge key={tag} variant="soft" size="sm">
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end no-print">
              <Button
                variant="ghost"
                size="sm"
                className={
                  analysis.isFavorite
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
                onClick={() =>
                  updateAnalysis.mutate({
                    id,
                    data: { isFavorite: !analysis.isFavorite },
                  })
                }
                disabled={updateAnalysis.isPending}
                title={
                  analysis.isFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                aria-label={
                  analysis.isFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                data-testid="button-favorite"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${analysis.isFavorite ? "fill-destructive" : ""}`}
                />
              </Button>
              <ShareSection
                analysisId={id}
                isPublic={analysis.isPublic ?? false}
                shareToken={analysis.shareToken ?? null}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => duplicateAnalysis.mutate({ id })}
                disabled={duplicateAnalysis.isPending}
                title="Duplicate this analysis"
                aria-label="Duplicate this analysis"
              >
                <GitCompareArrows className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteAnalysis.isPending}
                title="Delete this analysis"
                aria-label="Delete this analysis"
                data-testid="button-delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <TabsList className="mt-4 flex max-w-full gap-3 overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cover-letter">Cover Letter</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className={ANALYSIS_TAB_CONTENT_CLASS}>
          <OverviewTab analysis={analysis} id={id} />
        </TabsContent>
        <TabsContent
          value="cover-letter"
          className={ANALYSIS_TAB_CONTENT_CLASS}
        >
          <CoverLetterTab analysis={analysis} id={id} />
        </TabsContent>
        <TabsContent value="linkedin" className={ANALYSIS_TAB_CONTENT_CLASS}>
          <LinkedInTab analysis={analysis} id={id} />
        </TabsContent>
        <TabsContent value="pipeline" className={ANALYSIS_TAB_CONTENT_CLASS}>
          <PipelineTab analysis={analysis} id={id} />
        </TabsContent>
        <TabsContent value="notes" className={ANALYSIS_TAB_CONTENT_CLASS}>
          <NotesTab analysis={analysis} id={id} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              "{analysis.jobTitle}" will be permanently removed from your
              workspace. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAnalysis.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAnalysis.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteAnalysis.mutate({ id });
              }}
            >
              {deleteAnalysis.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
