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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Filter, X, MapPin, Tag, CalendarClock, SlidersHorizontal, LayoutGrid } from "lucide-react";

type Status = "not_applied" | "applied" | "got_interview" | "got_online_exam" | "selected" | "rejected";

const STATUS_CONFIG: Record<Status, { label: string; className: string; headerColor: string; borderColor: string }> = {
  not_applied: {
    label: "Not Applied",
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
    headerColor: "bg-muted/50",
    borderColor: "border-muted-foreground/30"
  },
  applied: {
    label: "Applied",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    headerColor: "bg-blue-500/10",
    borderColor: "border-blue-400"
  },
  got_interview: {
    label: "Got Interview",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
    headerColor: "bg-yellow-500/10",
    borderColor: "border-yellow-400"
  },
  got_online_exam: {
    label: "Got Online Exam",
    className: "bg-secondary text-secondary-foreground border-border dark:bg-secondary dark:text-secondary-foreground dark:border-border",
    headerColor: "bg-secondary/50",
    borderColor: "border-muted-foreground/40"
  },
  selected: {
    label: "Selected",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    headerColor: "bg-green-500/10",
    borderColor: "border-green-400"
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    headerColor: "bg-red-500/10",
    borderColor: "border-red-400"
  },
};

const COLUMNS: Status[] = ["not_applied", "applied", "got_interview", "got_online_exam", "selected", "rejected"];

const STATUS_COLORS: Record<string, string> = {
  not_applied: "hsl(var(--muted-foreground))",
  applied: "hsl(var(--info))",
  got_interview: "hsl(var(--warning))",
  got_online_exam: "hsl(var(--accent))",
  selected: "hsl(var(--success))",
  rejected: "hsl(var(--destructive))",
};

export function Board() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [minScore, setMinScore] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [hasDeadlineOnly, setHasDeadlineOnly] = useState(false);
  const [searchText, setSearchText] = useState("");

  const { data: allAnalyses, isLoading } = useListAnalyses();
  const updateAnalysis = useUpdateAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
    },
  });

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (allAnalyses ?? []).forEach((a) => {
      ((a.tags as string[]) ?? []).forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [allAnalyses]);

  const filtered = useMemo(() => {
    return (allAnalyses ?? []).filter((a) => {
      if (minScore && a.fitScore < Number(minScore)) return false;
      if (filterTag && !((a.tags as string[]) ?? []).includes(filterTag)) return false;
      if (filterLocation) {
        const loc = ((a as any).location as string | null) ?? "";
        if (!loc.toLowerCase().includes(filterLocation.toLowerCase())) return false;
      }
      if (hasDeadlineOnly && !a.deadline) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const title = (a.jobTitle ?? "").toLowerCase();
        const company = (a.companyName ?? "").toLowerCase();
        if (!title.includes(q) && !company.includes(q)) return false;
      }
      return true;
    });
  }, [allAnalyses, minScore, filterTag, filterLocation, hasDeadlineOnly, searchText]);

  const activeFilterCount = [minScore, filterTag, filterLocation, hasDeadlineOnly, searchText].filter(Boolean).length;

  const clearFilters = () => {
    setMinScore("");
    setFilterTag("");
    setFilterLocation("");
    setHasDeadlineOnly(false);
    setSearchText("");
  };

  const columns = useMemo(() => {
    const groups: Record<Status, typeof filtered> = {
      not_applied: [],
      applied: [],
      got_interview: [],
      got_online_exam: [],
      selected: [],
      rejected: [],
    };
    filtered.forEach((a) => {
      const status = (a.status as Status) || "not_applied";
      if (groups[status]) groups[status].push(a);
    });
    return groups;
  }, [filtered]);

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
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <header className="flex items-baseline justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Application tracker</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Pipeline of every analysis in flight.
            {activeFilterCount > 0 && (
              <span className="ml-2 text-accent font-medium">
                {filtered.length} of {allAnalyses?.length ?? 0} shown
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowFilters((p) => !p)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="soft" size="sm" className="ml-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      {/* Filter Bar */}
      {showFilters && (
        <Card padding="sm" className="mb-6">
          <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              Advanced filters
            </p>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-3.5 h-3.5 mr-1.5" />Clear all
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <Input
                placeholder="Job title or company..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            {/* Min Score */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Min Fit Score</label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 70"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                  className="h-8 text-xs pr-8"
                />
                {minScore && (
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setMinScore("")}>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            {/* Tag Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Tag className="w-3 h-3" /> Tag</label>
              <select
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
              >
                <option value="">All tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {/* Location */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</label>
              <Input
                placeholder="e.g. Remote, NYC..."
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          {/* Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHasDeadlineOnly((p) => !p)}
              className={"flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all " + (hasDeadlineOnly ? "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700" : "text-muted-foreground border-muted hover:border-muted-foreground/40")}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Has deadline only
            </button>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {minScore && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Fit ≥ {minScore}%
                  <button onClick={() => setMinScore("")}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {filterTag && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Tag: {filterTag}
                  <button onClick={() => setFilterTag("")}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {filterLocation && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <MapPin className="w-2.5 h-2.5" /> {filterLocation}
                  <button onClick={() => setFilterLocation("")}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {hasDeadlineOnly && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700">
                  Has deadline
                  <button onClick={() => setHasDeadlineOnly(false)}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {searchText && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  "{searchText}"
                  <button onClick={() => setSearchText("")}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
            </div>
          )}
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      {(allAnalyses ?? []).length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGrid />
            </EmptyMedia>
            <EmptyTitle>No analyses in your pipeline</EmptyTitle>
            <EmptyDescription>
              Run an analysis from the Optimize page to start tracking applications.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setLocation("/")}>Start a new analysis</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-6 flex-1 min-h-0 items-start">
          {COLUMNS.map((status) => (
            <div
              key={status}
              className="w-80 shrink-0 flex flex-col"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, status)}
            >
              <div className="sticky top-12 z-10 bg-background border-b border-border pb-2 mb-3">
                <h3 className="text-[13px] font-semibold flex items-center gap-2">
                  {STATUS_CONFIG[status].label}
                  <Badge variant="default" size="sm">{columns[status]?.length ?? 0}</Badge>
                </h3>
              </div>

              <div className="bg-surface-1 rounded-md border border-border p-3 space-y-2 min-h-[120px]">
                {columns[status]?.length === 0 ? (
                  <p className="text-[12px] text-subtle-foreground text-center py-4">Drag analyses here</p>
                ) : (
                  columns[status]?.map((a) => (
                    <Card
                      key={a.id}
                      padding="sm"
                      draggable
                      onDragStart={(e) => onDragStart(e, a.id)}
                      className="cursor-pointer hover:border-border-strong transition-colors border-l-2"
                      style={{ borderLeftColor: STATUS_COLORS[status] || "hsl(var(--muted-foreground))" }}
                      onClick={() => setLocation(`/analysis/${a.id}`)}
                    >
                      <CardContent className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate">{a.jobTitle}</p>
                          {a.companyName && <p className="text-[11px] text-muted-foreground truncate">{a.companyName}</p>}
                        </div>
                        <ScoreCircle score={a.fitScore} size="sm" />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
