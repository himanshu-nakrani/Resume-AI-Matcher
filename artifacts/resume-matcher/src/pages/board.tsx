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
import { format } from "date-fns";
import { Filter, X, MapPin, DollarSign, Tag, CalendarClock, SlidersHorizontal } from "lucide-react";

type Status = "not_applied" | "applied" | "got_interview" | "got_online_exam" | "selected" | "rejected";

const STATUS_CONFIG: Record<Status, { label: string; className: string; headerColor: string; accentGradient: string }> = {
  not_applied: { 
    label: "Not Applied", 
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
    headerColor: "bg-muted/50",
    accentGradient: "from-slate-400 to-slate-500"
  },
  applied: { 
    label: "Applied", 
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    headerColor: "bg-blue-500/10",
    accentGradient: "from-blue-400 to-blue-600"
  },
  got_interview: { 
    label: "Got Interview", 
    className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
    headerColor: "bg-yellow-500/10",
    accentGradient: "from-yellow-400 to-amber-500"
  },
  got_online_exam: { 
    label: "Got Online Exam", 
    className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
    headerColor: "bg-purple-500/10",
    accentGradient: "from-purple-400 to-purple-600"
  },
  selected: { 
    label: "Selected", 
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    headerColor: "bg-green-500/10",
    accentGradient: "from-green-400 to-emerald-500"
  },
  rejected: { 
    label: "Rejected", 
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    headerColor: "bg-red-500/10",
    accentGradient: "from-red-400 to-red-600"
  },
};

const COLUMNS: Status[] = ["not_applied", "applied", "got_interview", "got_online_exam", "selected", "rejected"];

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
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Application Tracker
          </h1>
          <p className="text-muted-foreground text-base">
            Tracker entries are created automatically after every resume optimization.
            {activeFilterCount > 0 && (
              <span className="ml-2 text-primary font-semibold">
                {filtered.length} of {allAnalyses?.length ?? 0} shown
              </span>
            )}
          </p>
        </div>
        <Button
          variant={showFilters ? "gradient" : "outline"}
          size="lg"
          className="gap-2 shrink-0 shadow-md"
          onClick={() => setShowFilters((p) => !p)}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" size="sm" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="rounded-2xl border border-border bg-gradient-to-br from-muted/50 to-muted/30 p-6 space-y-4 shadow-lg backdrop-blur-sm animate-slide-in-bottom">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Filter className="w-5 h-5 text-primary" />
              </div>
              Advanced Filters
            </p>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-sm h-9 hover:bg-destructive/10 hover:text-destructive">
                <X className="w-4 h-4" /> Clear all
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
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex gap-6 overflow-x-auto pb-6 flex-1 min-h-0 items-start">
        {COLUMNS.map((status) => (
          <div
            key={status}
            className="w-80 shrink-0 flex flex-col max-h-full rounded-2xl border-2 border-border bg-card shadow-xl transition-all duration-300 hover:shadow-2xl"
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, status)}
          >
            <div
              className={`sticky top-0 z-10 flex flex-col rounded-t-xl border-b border-border backdrop-blur-sm ${STATUS_CONFIG[status].headerColor}`}
            >
              <div className={`h-[3px] w-full rounded-full bg-gradient-to-r ${STATUS_CONFIG[status].accentGradient}`} />
              <div className="flex items-center justify-between px-4 py-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
                {STATUS_CONFIG[status].label}
              </h3>
              <Badge variant="secondary" className="h-7 min-w-7 justify-center rounded-lg px-2 text-xs font-bold tabular-nums shadow-sm">
                {columns[status]?.length || 0}
              </Badge>
              </div>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {columns[status]?.map((a) => {
                const aLocation = (a as any).location as string | null;
                const aSalary = (a as any).salaryExpectation as string | null;
                const aVersion = (a as any).versionLabel as string | null;
                return (
                  <Card
                    key={a.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, a.id)}
                    variant="elevated"
                    hover="lift"
                    className="group cursor-grab active:cursor-grabbing active:opacity-50 active:rotate-2 transition-all duration-200"
                    onClick={() => setLocation(`/analysis/${a.id}`)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-base leading-tight truncate group-hover:text-primary transition-colors">
                            {a.jobTitle}
                          </h4>
                          {a.companyName && (
                            <p className="mt-1 truncate text-sm text-muted-foreground">
                              {a.companyName}
                            </p>
                          )}
                        </div>
                        <div className="relative">
                          <ScoreCircle score={a.fitScore} size="sm" />
                          <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-success border-2 border-background animate-pulse" />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="h-5 text-[10px] font-medium tabular-nums">
                          ATS {a.atsScore}
                        </Badge>
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {format(new Date(a.createdAt), "MMM d")}
                        </span>
                        {aVersion && (
                          <Badge variant="secondary" className="text-[10px] h-5 bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800">
                            {aVersion}
                          </Badge>
                        )}
                      </div>

                      {/* Location / salary chips */}
                      {(aLocation || aSalary) && (
                        <div className="flex flex-wrap gap-1">
                          {aLocation && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <MapPin className="w-2.5 h-2.5" />
                              {aLocation}
                            </span>
                          )}
                          {aSalary && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <DollarSign className="w-2.5 h-2.5" />
                              {aSalary}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Deadline chip */}
                      {a.deadline && (
                        <div className="flex items-center gap-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                          <CalendarClock className="w-2.5 h-2.5" />
                          Due {format(new Date(a.deadline), "MMM d")}
                        </div>
                      )}

                      {/* Tags */}
                      {Array.isArray(a.tags) && (a.tags as string[]).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(a.tags as string[]).slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-primary/20 bg-primary/5 px-1.5 py-0 text-[10px] text-primary"
                            >
                              {tag}
                            </span>
                          ))}
                          {(a.tags as string[]).length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{(a.tags as string[]).length - 3}</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {columns[status]?.length === 0 && (
                <div className="py-12 text-center border-2 border-dashed rounded-2xl border-muted-foreground/20 bg-muted/20 transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 hover:shadow-[0_0_15px_-3px] hover:shadow-primary/20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full bg-gradient-to-br from-muted to-muted/50 p-3">
                      <svg className="w-6 h-6 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">No applications</p>
                    <p className="text-xs text-muted-foreground/70">Drag cards here</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
