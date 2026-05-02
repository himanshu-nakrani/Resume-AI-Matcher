import { useLocation } from "wouter";
import { useListAnalyses, useDeleteAnalysis, getListAnalysesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScoreCircle } from "@/components/score-circle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Trash2, ArrowRight } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export function History() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: analyses, isLoading } = useListAnalyses();
  const deleteAnalysis = useDeleteAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-1">All your resume analyses, most recent first.</p>
      </div>

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
              <CardContent className="p-4 flex items-center gap-5">
                <ScoreCircle score={a.fitScore} size="sm" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{a.jobTitle}</p>
                    {a.companyName && (
                      <span className="text-sm text-muted-foreground">@ {a.companyName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      ATS {a.atsScore}
                    </Badge>
                    {a.coverLetter && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Cover Letter
                      </Badge>
                    )}
                    {a.linkedinPost && (
                      <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        LinkedIn Post
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
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
