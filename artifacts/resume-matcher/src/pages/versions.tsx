import { useMemo } from "react";
import { useLocation } from "wouter";
import { useListAnalyses } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { GitBranch, ChevronRight, Tag, Building2, MapPin } from "lucide-react";

type AnalysisItem = {
  id: number;
  jobTitle: string;
  companyName: string | null;
  fitScore: number;
  atsScore: number;
  status: string;
  createdAt: string;
  tags: string[] | null;
  versionLabel?: string | null;
  location?: string | null;
};

function groupKey(a: AnalysisItem) {
  return (a.jobTitle ?? "Unknown").toLowerCase().trim() + "|||" + (a.companyName ?? "").toLowerCase().trim();
}

function statusColor(status: string) {
  switch (status) {
    case "offer": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400";
    case "interview": return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "applied": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
    case "rejected": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Versions() {
  const [, setLocation] = useLocation();
  const { data: analyses, isLoading } = useListAnalyses();

  const groups = useMemo(() => {
    if (!analyses) return [];
    const map = new Map<string, AnalysisItem[]>();
    for (const a of analyses) {
      const k = groupKey(a as AnalysisItem);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a as AnalysisItem);
    }
    return Array.from(map.entries())
      .map(([, items]) => ({
        jobTitle: items[0].jobTitle,
        companyName: items[0].companyName,
        items: items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      }))
      .filter((g) => g.items.length > 0)
      .sort((a, b) => new Date(b.items[0].createdAt).getTime() - new Date(a.items[0].createdAt).getTime());
  }, [analyses]);

  const multiGroups = groups.filter((g) => g.items.length > 1);
  const singleGroups = groups.filter((g) => g.items.length === 1);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-64" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <GitBranch className="w-7 h-7 text-violet-500" />
          Resume Versions
        </h1>
        <p className="text-muted-foreground mt-1">
          Applications grouped by role — compare how your resume evolved across versions.
        </p>
      </div>

      {groups.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No analyses yet</p>
          <p className="text-sm mt-1">Create your first analysis to start tracking versions.</p>
        </div>
      )}

      {/* Multi-version groups */}
      {multiGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-500" />
            Multiple Versions ({multiGroups.length} roles)
          </h2>
          {multiGroups.map((group) => (
            <Card key={group.jobTitle + group.companyName} className="border shadow-sm overflow-hidden">
              <CardHeader className="pb-2 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800/40">
                <CardTitle className="text-base flex items-center justify-between">
                  <div>
                    <span>{group.jobTitle}</span>
                    {group.companyName && (
                      <span className="text-muted-foreground font-normal ml-2 text-sm">@ {group.companyName}</span>
                    )}
                  </div>
                  <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-400">
                    {group.items.length} versions
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {group.items.map((item, idx) => {
                  const vLabel = (item as any).versionLabel as string | null;
                  const loc = (item as any).location as string | null;
                  const isLatest = idx === 0;
                  return (
                    <button
                      key={item.id}
                      className="w-full text-left flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors border-b last:border-b-0 group"
                      onClick={() => setLocation("/analysis/" + item.id)}
                    >
                      {/* Timeline indicator */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className={"w-2.5 h-2.5 rounded-full border-2 " + (isLatest ? "bg-violet-500 border-violet-500" : "bg-muted border-muted-foreground/30")} />
                        {idx < group.items.length - 1 && <div className="w-0.5 h-4 bg-muted-foreground/20" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {vLabel ? (
                            <span className="text-sm font-semibold text-violet-700 dark:text-violet-400 flex items-center gap-1">
                              <Tag className="w-3 h-3" />{vLabel}
                            </span>
                          ) : (
                            <span className="text-sm font-medium text-muted-foreground">Version {group.items.length - idx}</span>
                          )}
                          {isLatest && <Badge variant="outline" className="text-[10px] h-4 bg-violet-50 text-violet-700 border-violet-200">Latest</Badge>}
                          <span className="text-xs text-muted-foreground">{format(new Date(item.createdAt), "MMM d, yyyy")}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <Badge variant="outline" className={"text-[10px] h-5 " + statusColor(item.status)}>
                            {statusLabel(item.status)}
                          </Badge>
                          {loc && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />{loc}
                            </span>
                          )}
                          {Array.isArray(item.tags) && (item.tags as string[]).slice(0, 2).map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0 rounded-full bg-primary/5 text-primary border border-primary/20">{t}</span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Fit</p>
                          <p className="text-sm font-bold">{item.fitScore}%</p>
                        </div>
                        <ScoreCircle score={item.fitScore} size="sm" />
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Single-version roles */}
      {singleGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Single Version ({singleGroups.length} roles)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {singleGroups.map((group) => {
              const item = group.items[0];
              const vLabel = (item as any).versionLabel as string | null;
              const loc = (item as any).location as string | null;
              return (
                <button
                  key={item.id}
                  className="text-left flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors group shadow-sm"
                  onClick={() => setLocation("/analysis/" + item.id)}
                >
                  <ScoreCircle score={item.fitScore} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.jobTitle}</p>
                    {item.companyName && <p className="text-xs text-muted-foreground truncate">{item.companyName}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={"text-[10px] h-4 " + statusColor(item.status)}>
                        {statusLabel(item.status)}
                      </Badge>
                      {vLabel && <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">{vLabel}</span>}
                      {loc && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{loc}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
