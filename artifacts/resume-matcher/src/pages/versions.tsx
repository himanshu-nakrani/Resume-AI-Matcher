import { useMemo } from "react";
import { useLocation } from "wouter";
import { useListAnalyses } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { AlertCircle, ChevronRight, GitBranch, MapPin, PlusCircle, Tag } from "lucide-react";

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

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function groupKey(a: AnalysisItem) {
  return (a.jobTitle ?? "Unknown").toLowerCase().trim() + "|||" + (a.companyName ?? "").toLowerCase().trim();
}

function statusColor(status: string) {
  switch (status) {
    case "selected": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400";
    case "got_interview": return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "got_online_exam": return "bg-secondary text-secondary-foreground border-border dark:bg-secondary dark:text-secondary-foreground";
    case "applied": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
    case "rejected": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : format(date, "MMM d, yyyy");
}

export function Versions() {
  const [, setLocation] = useLocation();
  const { data: analyses = [], isLoading, error } = useListAnalyses();

  const groups = useMemo(() => {
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
        items: [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      }))
      .filter((g) => g.items.length > 0)
      .sort((a, b) => new Date(b.items[0].createdAt).getTime() - new Date(a.items[0].createdAt).getTime());
  }, [analyses]);

  const multiGroups = groups.filter((g) => g.items.length > 1);
  const singleGroups = groups.filter((g) => g.items.length === 1);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-20 rounded-md" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-md" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Resume versions</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Applications grouped by role so you can review how each targeted resume evolved.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
          New analysis
        </Button>
      </header>

      {error ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>Could not load versions</EmptyTitle>
            <EmptyDescription>
              {error instanceof Error ? error.message : "Try again in a moment."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : groups.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GitBranch />
            </EmptyMedia>
            <EmptyTitle>No analyses yet</EmptyTitle>
            <EmptyDescription>
              Create your first analysis to start tracking resume versions by role and company.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setLocation("/")}>
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              Start a new analysis
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card padding="sm">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Analyses</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{analyses.length}</p>
              </CardContent>
            </Card>
            <Card padding="sm">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Role groups</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{groups.length}</p>
              </CardContent>
            </Card>
            <Card padding="sm">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Versioned roles</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{multiGroups.length}</p>
              </CardContent>
            </Card>
          </div>

          {multiGroups.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-subtle-foreground">
                <GitBranch className="h-3.5 w-3.5" />
                Multiple versions ({multiGroups.length} roles)
              </h2>
              {multiGroups.map((group) => (
                <Card key={group.jobTitle + group.companyName} className="overflow-hidden">
                  <CardHeader className="border-b bg-surface-1 pb-3">
                    <CardTitle className="flex items-center justify-between gap-3 text-[14px]">
                      <div className="min-w-0">
                        <span className="block truncate">{group.jobTitle}</span>
                        {group.companyName && (
                          <span className="mt-0.5 block truncate text-[12px] font-normal text-muted-foreground">{group.companyName}</span>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {group.items.length} versions
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {group.items.map((item, idx) => {
                      const vLabel = item.versionLabel;
                      const loc = item.location;
                      const isLatest = idx === 0;
                      const tags = stringArray(item.tags).slice(0, 2);
                      return (
                        <button
                          key={item.id}
                          className="group flex w-full flex-col gap-3 border-b p-4 text-left transition-colors hover:bg-surface-1 last:border-b-0 sm:flex-row sm:items-center"
                          onClick={() => setLocation("/analysis/" + item.id)}
                        >
                          <div className="flex items-start gap-3 sm:flex-1">
                            <div className="mt-1 flex shrink-0 flex-col items-center gap-1">
                              <div className={isLatest ? "h-2.5 w-2.5 rounded-full border-2 border-accent bg-accent" : "h-2.5 w-2.5 rounded-full border-2 border-muted-foreground/30 bg-surface-2"} />
                              {idx < group.items.length - 1 && <div className="h-7 w-px bg-border" />}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {vLabel ? (
                                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                                    <Tag className="h-3 w-3" />{vLabel}
                                  </span>
                                ) : (
                                  <span className="text-sm font-medium text-muted-foreground">Version {group.items.length - idx}</span>
                                )}
                                {isLatest && <Badge variant="soft" size="sm">Latest</Badge>}
                                <span className="text-xs text-muted-foreground">{formatCreatedAt(item.createdAt)}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={"text-[10px] h-5 " + statusColor(item.status)}>
                                  {statusLabel(item.status)}
                                </Badge>
                                {loc && (
                                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />{loc}
                                  </span>
                                )}
                                {tags.map((tag) => (
                                  <Badge key={tag} variant="soft" size="sm">{tag}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <div className="text-right">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Fit</p>
                              <p className="text-sm font-semibold tabular-nums">{item.fitScore}%</p>
                            </div>
                            <ScoreCircle score={item.fitScore} size="sm" />
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {singleGroups.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-subtle-foreground">
                Single version ({singleGroups.length} roles)
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {singleGroups.map((group) => {
                  const item = group.items[0];
                  const tags = stringArray(item.tags).slice(0, 2);
                  return (
                    <button
                      key={item.id}
                      className="group flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-surface-1"
                      onClick={() => setLocation("/analysis/" + item.id)}
                    >
                      <ScoreCircle score={item.fitScore} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.jobTitle}</p>
                        {item.companyName && <p className="truncate text-xs text-muted-foreground">{item.companyName}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={"text-[10px] h-4 " + statusColor(item.status)}>
                            {statusLabel(item.status)}
                          </Badge>
                          {item.versionLabel && <span className="text-[10px] font-medium text-muted-foreground">{item.versionLabel}</span>}
                          {item.location && <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"><MapPin className="h-2.5 w-2.5" />{item.location}</span>}
                          {tags.map((tag) => (
                            <Badge key={tag} variant="soft" size="sm">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
