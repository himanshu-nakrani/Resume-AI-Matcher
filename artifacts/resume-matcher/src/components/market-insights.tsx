import { useGenerateMarketInsights, getGetAnalysisQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, TrendingUp, Briefcase, Zap } from "lucide-react";

export function MarketInsightsSection({ analysisId, existing }: { 
  analysisId: number; 
  existing: any; 
}) {
  const queryClient = useQueryClient();
  const generate = useGenerateMarketInsights({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) }),
    },
  });

  const insights = generate.data ?? existing;

  const demandColors = {
    High: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200",
    Medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200",
    Low: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200",
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Market Insights
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-powered market analysis for this role and industry.
          </p>
        </div>
        <Button
          size="sm"
          variant={insights ? "outline" : "default"}
          onClick={() => generate.mutate({ id: analysisId })}
          disabled={generate.isPending}
          className="no-print shrink-0"
        >
          {generate.isPending ? (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Analyzing...</>
          ) : insights ? "Refresh" : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Get Insights</>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {generate.isPending ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-6 w-20" />)}
            </div>
          </div>
        ) : insights ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Role Demand</p>
                <Badge variant="outline" className={demandColors[insights.demandLevel as keyof typeof demandColors] || ""}>
                  {insights.demandLevel}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Salary Range</p>
                <p className="text-sm font-bold">
                  {insights.salaryRange.min.toLocaleString()} - {insights.salaryRange.max.toLocaleString()} 
                  <span className="text-xs font-normal text-muted-foreground ml-1">/{insights.salaryPeriod}</span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> In-Demand Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {insights.topSkills.map((skill: string) => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Market Context
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">
                {insights.context}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed rounded-lg">
            Click "Get Insights" to see current market trends, demand, and salary data for this role.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
