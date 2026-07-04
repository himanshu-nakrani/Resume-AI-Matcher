import { useParams, useLocation, useSearch } from "wouter";
import {
  useGetAnalysis,
  getGetAnalysisQueryKey,
  useDeleteAnalysis,
  useUpdateAnalysis,
  useDuplicateAnalysis,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Heart, Trash2, GitCompareArrows, CalendarClock, Tag,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ShareSection } from "./shared";
import { OverviewTab } from "./overview-tab";
import { CoverLetterTab } from "./cover-letter-tab";
import { LinkedInTab } from "./linkedin-tab";
import { PipelineTab } from "./pipeline-tab";
import { NotesTab } from "./notes-tab";

const TAB_VALUES = ["overview", "cover-letter", "linkedin", "pipeline", "notes"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null | undefined): v is TabValue {
  return v != null && (TAB_VALUES as readonly string[]).includes(v);
}

export function Analysis() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: analysis, isLoading } = useGetAnalysis(id, {
    query: { enabled: !!id, queryKey: getGetAnalysisQueryKey(id) },
  });

  const tabParam = new URLSearchParams(search).get("tab");
  const activeTab: TabValue = isTabValue(tabParam) ? tabParam : "overview";
  const setTab = (next: string) => {
    setLocation(`/analysis/${id}?tab=${next}`, { replace: true });
  };

  const deleteAnalysis = useDeleteAnalysis({
    mutation: { onSuccess: () => setLocation("/") },
  });

  const updateAnalysis = useUpdateAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) }),
    },
  });

  const duplicateAnalysis = useDuplicateAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
        toast({ title: "Analysis duplicated", description: "Opening the copy now." });
        setLocation(`/analysis/${data.id}`);
      },
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
        <p className="text-[13px] text-muted-foreground">Analysis not found.</p>
        <Button variant="secondary" className="mt-4" onClick={() => setLocation("/")}>
          Go back
        </Button>
      </div>
    );
  }

  const isSampled = ((analysis.tags as string[] | undefined) ?? []).includes("sample");

  return (
    <div className="space-y-0" data-testid={`analysis-${id}`}>
      <Tabs value={activeTab} onValueChange={setTab}>
        <div className="sticky top-12 z-30 bg-background border-b border-border pb-3 mb-6 -mx-6 px-6">
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
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{analysis.jobTitle}</h1>
                {isSampled && <Badge variant="soft" size="sm">Sample</Badge>}
              </div>
              {analysis.companyName && (
                <p className="text-[13px] text-muted-foreground mt-0.5">{analysis.companyName}</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {analysis.deadline && (
                  <Badge variant="warning" size="sm">
                    <CalendarClock className="w-3 h-3 mr-1" />
                    Due {format(new Date(analysis.deadline), "MMM d")}
                  </Badge>
                )}
                {analysis.followUpDate && (
                  <Badge variant="info" size="sm">
                    <CalendarClock className="w-3 h-3 mr-1" />
                    Follow-up {format(new Date(analysis.followUpDate), "MMM d")}
                  </Badge>
                )}
                {Array.isArray(analysis.tags) &&
                  (analysis.tags as string[])
                    .filter((tag) => tag !== "sample")
                    .map((tag) => (
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
                className={analysis.isFavorite ? "text-destructive" : "text-muted-foreground"}
                onClick={() => updateAnalysis.mutate({ id, data: { isFavorite: !analysis.isFavorite } })}
                data-testid="button-favorite"
              >
                <Heart className={`w-3.5 h-3.5 ${analysis.isFavorite ? "fill-destructive" : ""}`} />
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
              >
                <GitCompareArrows className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => deleteAnalysis.mutate({ id })}
                disabled={deleteAnalysis.isPending}
                data-testid="button-delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <TabsList className="mt-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cover-letter">Cover Letter</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview"><OverviewTab analysis={analysis} id={id} /></TabsContent>
        <TabsContent value="cover-letter"><CoverLetterTab analysis={analysis} id={id} /></TabsContent>
        <TabsContent value="linkedin"><LinkedInTab analysis={analysis} id={id} /></TabsContent>
        <TabsContent value="pipeline"><PipelineTab analysis={analysis} id={id} /></TabsContent>
        <TabsContent value="notes"><NotesTab analysis={analysis} id={id} /></TabsContent>
      </Tabs>
    </div>
  );
}
