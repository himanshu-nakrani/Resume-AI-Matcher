import { useGenerateCareerPath, getGetAnalysisQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, GitPullRequest, ArrowRight, Target, Clock, Star } from "lucide-react";

export function CareerPathSection({ analysisId, existing }: { 
  analysisId: number; 
  existing: any; 
}) {
  const queryClient = useQueryClient();
  const generate = useGenerateCareerPath({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) }),
    },
  });

  const path = generate.data ?? existing;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-muted-foreground" /> Career Path Planner
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-generated growth trajectory based on this role.
          </p>
        </div>
        <Button
          size="sm"
          variant={path ? "outline" : "default"}
          onClick={() => generate.mutate({ id: analysisId })}
          disabled={generate.isPending}
          className="no-print shrink-0"
        >
          {generate.isPending ? (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Planning...</>
          ) : path ? "Refresh" : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Plan Career</>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {generate.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : path ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
              <Target className="w-4 h-4 text-foreground" />
              <p className="text-sm font-medium">
                Current Focus: <span className="text-foreground font-bold">{path.currentRoleInference}</span>
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Growth Trajectory</p>
              <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-border">
                {path.nextSteps.map((step: any, i: number) => (
                  <div key={i} className="relative flex items-start gap-4 pl-10">
                    <div className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-background border border-border text-foreground">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-bold text-foreground">{step.role}</h4>
                        <Badge variant="secondary" className="text-[10px] h-5 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {step.timelineEstimate}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-snug">{step.description}</p>
                    </div>
                  </div>
                ))}

                {path.stretchGoals.map((goal: string, i: number) => (
                  <div key={i} className="relative flex items-start gap-4 pl-10">
                    <div className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-background border-2 border-muted-foreground/40 text-muted-foreground shadow-sm">
                      <Star className="h-5 w-5" />
                    </div>
                    <div className="flex-1 pt-1">
                      <h4 className="text-sm font-bold text-foreground">{goal}</h4>
                      <p className="text-xs text-muted-foreground italic">Long-term aspirational goal</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Skills to Develop
              </p>
              <div className="flex flex-wrap gap-1.5">
                {path.skillsToDevelop.map((skill: string) => (
                  <Badge key={skill} variant="outline" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed rounded-lg">
            Click "Plan Career" to visualize your potential growth path from this role.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
