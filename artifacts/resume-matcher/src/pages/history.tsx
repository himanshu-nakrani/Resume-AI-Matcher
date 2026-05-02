import { useLocation } from "wouter";
import {
  useListAnalyses,
  useDeleteAnalysis,
  useUpdateAnalysis,
  getListAnalysesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScoreCircle } from "@/components/score-circle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Trash2, ArrowRight, ChevronDown } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type Status = "not_applied" | "applied" | "interview" | "offer" | "rejected";

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  not_applied: { label: "Not Applied", className: "bg-muted text-muted-foreground border-muted-foreground/20" },
  applied: { label: "Applied", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
  interview: { label: "Interview", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800" },
  offer: { label: "Offer", className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" },
};

const ALL_STATUSES: Status[] = ["not_applied", "applied", "interview", "offer", "rejected"];

function StatusPicker({ analysisId, currentStatus }: { analysisId: number; currentStatus: string }) {
  const queryClient = useQueryClient();
  const updateAnalysis = useUpdateAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
    },
  });

  const status = (currentStatus as Status) in STATUS_CONFIG ? (currentStatus as Status) : "not_applied";
  const config = STATUS_CONFIG[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-opacity hover:opacity-80 ${config.className}`}
          data-testid={`status-picker-${analysisId}`}
        >
          {config.label}
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {ALL_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            className="cursor-pointer"
            onSelect={() => updateAnalysis.mutate({ id: analysisId, data: { status: s } })}
            data-testid={`status-option-${s}`}
          >
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_CONFIG[s].className}`}>
              {STATUS_CONFIG[s].label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function History() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: analyses, isLoading } = useListAnalyses();
  const deleteAnalysis = useDeleteAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
    },
  });

  const statusCounts = analyses
    ? ALL_STATUSES.reduce((acc, s) => {
        acc[s] = analyses.filter((a) => a.status === s).length;
        return acc;
      }, {} as Record<Status, number>)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-1">All your resume analyses, most recent first.</p>
      </div>

      {/* Pipeline summary */}
      {statusCounts && analyses && analyses.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {ALL_STATUSES.filter((s) => s !== "not_applied").map((s) => (
            <div key={s} className={`rounded-lg border px-3 py-2 text-center ${STATUS_CONFIG[s].className}`}>
              <p className="text-2xl font-bold tabular-nums">{statusCounts[s]}</p>
              <p className="text-xs font-medium mt-0.5">{STATUS_CONFIG[s].label}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : !analyses || analyses.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No analyses yet</p>
          <p className="text-sm mt-1">Run your first analysis to see it here.</p>
          <Button className="mt-4" onClick={() => setLocation("/")} data-testid="button-new-analysis">
            Start New Analysis
          </Button>
        </div>
      ) : (
        <div className="space-y-3" data-testid="analysis-list">
          {analyses.map((a) => (
            <Card
              key={a.id}
              className="group border shadow-sm hover:shadow-md transition-all cursor-pointer"
              onClick={() => setLocation(`/analysis/${a.id}`)}
              data-testid={`row-analysis-${a.id}`}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <ScoreCircle score={a.fitScore} size="sm" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{a.jobTitle}</p>
                    {a.companyName && (
                      <span className="text-sm text-muted-foreground truncate">@ {a.companyName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <StatusPicker analysisId={a.id} currentStatus={a.status} />
                    <Badge variant="outline" className="text-xs">ATS {a.atsScore}</Badge>
                    {a.coverLetter && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Cover Letter
                      </Badge>
                    )}
                    {a.linkedinPost && (
                      <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        LinkedIn
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-sm font-medium text-muted-foreground">{format(new Date(a.createdAt), "MMM d, yyyy")}</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAnalysis.mutate({ id: a.id });
                    }}
                    data-testid={`button-delete-${a.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
