import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useListAnalyses,
  useUpdateAnalysis,
  getListAnalysesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScoreCircle } from "@/components/score-circle";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { useTheme } from "@/hooks/use-theme";

type Status = "not_applied" | "applied" | "interview" | "offer" | "rejected";

const STATUS_CONFIG: Record<Status, { label: string; className: string; headerColor: string }> = {
  not_applied: { 
    label: "Not Applied", 
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
    headerColor: "bg-muted/50"
  },
  applied: { 
    label: "Applied", 
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    headerColor: "bg-blue-500/10"
  },
  interview: { 
    label: "Interview", 
    className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
    headerColor: "bg-yellow-500/10"
  },
  offer: { 
    label: "Offer", 
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    headerColor: "bg-green-500/10"
  },
  rejected: { 
    label: "Rejected", 
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    headerColor: "bg-red-500/10"
  },
};

const COLUMNS: Status[] = ["not_applied", "applied", "interview", "offer", "rejected"];

export function Board() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const isEmberTheme = theme === "warm";

  const { data: analyses, isLoading } = useListAnalyses();
  const updateAnalysis = useUpdateAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
    },
  });

  const columns = useMemo(() => {
    const groups: Record<Status, typeof analyses> = {
      not_applied: [],
      applied: [],
      interview: [],
      offer: [],
      rejected: [],
    };

    if (analyses) {
      analyses.forEach((a) => {
        const status = (a.status as Status) || "not_applied";
        if (groups[status]) {
          groups[status].push(a);
        }
      });
    }

    return groups;
  }, [analyses]);

  const onDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("analysisId", id.toString());
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, targetStatus: Status) => {
    const id = parseInt(e.dataTransfer.getData("analysisId"), 10);
    if (isNaN(id)) return;

    updateAnalysis.mutate({ id, data: { status: targetStatus } });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-250px)]">
          {COLUMNS.map((col) => (
            <div key={col} className="w-72 shrink-0 space-y-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Board</h1>
        <p className="text-muted-foreground mt-1">Track your job search progress with kanban board.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0 items-start">
        {COLUMNS.map((status) => (
          <div
            key={status}
            className={`w-72 shrink-0 flex flex-col max-h-full rounded-2xl border ${
              isEmberTheme ? "bg-[#78350f]/5 border-[#92400e]/20" : "bg-muted/30"
            }`}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, status)}
          >
            <div className={`p-4 sticky top-0 z-10 rounded-t-2xl flex items-center justify-between ${
              isEmberTheme ? "bg-[#92400e] text-white" : STATUS_CONFIG[status].headerColor
            }`}>
              <h3 className="font-bold text-sm uppercase tracking-wider">
                {STATUS_CONFIG[status].label}
              </h3>
              <Badge variant="secondary" className={isEmberTheme ? "bg-[#78350f] text-white border-none" : ""}>
                {columns[status]?.length || 0}
              </Badge>
            </div>

            <div className="p-3 space-y-3 overflow-y-auto flex-1">
              {columns[status]?.map((a) => (
                <Card
                  key={a.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, a.id)}
                  className={`cursor-grab active:cursor-grabbing border shadow-sm hover:shadow-md transition-all ${
                    isEmberTheme ? "bg-[#fef3c7] border-[#92400e]/20 text-[#78350f]" : ""
                  }`}
                  onClick={() => setLocation(`/analysis/${a.id}`)}
                >
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm leading-tight truncate">
                          {a.jobTitle}
                        </h4>
                        {a.companyName && (
                          <p className={`text-xs mt-0.5 truncate ${isEmberTheme ? "text-[#92400e]/80" : "text-muted-foreground"}`}>
                            {a.companyName}
                          </p>
                        )}
                      </div>
                      <ScoreCircle score={a.fitScore} size="sm" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] h-5 ${isEmberTheme ? "border-[#92400e]/30 text-[#92400e]" : ""}`}
                      >
                        ATS {a.atsScore}
                      </Badge>
                      <span className={`text-[10px] ${isEmberTheme ? "text-[#92400e]/60" : "text-muted-foreground"}`}>
                        {format(new Date(a.createdAt), "MMM d")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {columns[status]?.length === 0 && (
                <div className="py-8 text-center border-2 border-dashed rounded-xl border-muted-foreground/10">
                  <p className="text-xs text-muted-foreground/50 italic">No items</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
