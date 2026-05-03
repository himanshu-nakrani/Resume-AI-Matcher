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
import { useTheme } from "@/hooks/use-theme";
import { Filter, X, MapPin, DollarSign, Tag, CalendarClock, SlidersHorizontal } from "lucide-react";

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
      interview: [],
      offer: [],
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
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Board</h1>
          <p className="text-muted-foreground mt-1">
            Track your job search progress with drag-and-drop kanban.
            {activeFilterCount > 0 && (
              <span className="ml-2 text-primary font-medium text-sm">
                {filtered.length} of {allAnalyses?.length ?? 0} shown
              </span>
            )}
          </p>
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => setShowFilters((p) => !p)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 bg-white/20 text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className={`rounded-xl border p-4 space-y-3 ${isEmberTheme ? "bg-[#fef3c7]/50 border-[#92400e]/20" : "bg-muted/30"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Filter className="w-4 h-4" /> Advanced Filters
            </p>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs h-7">
                <X className="w-3 h-3" /> Clear all
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
              {columns[status]?.map((a) => {
                const aLocation = (a as any).location as string | null;
                const aSalary = (a as any).salaryExpectation as string | null;
                const aVersion = (a as any).versionLabel as string | null;
                return (
                  <Card
                    key={a.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, a.id)}
                    className={`cursor-grab active:cursor-grabbing border shadow-sm hover:shadow-md transition-all ${
                      isEmberTheme ? "bg-[#fef3c7] border-[#92400e]/20 text-[#78350f]" : ""
                    }`}
                    onClick={() => setLocation(`/analysis/${a.id}`)}
                  >
                    <CardContent className="p-3 space-y-2.5">
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

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] h-5 ${isEmberTheme ? "border-[#92400e]/30 text-[#92400e]" : ""}`}
                        >
                          ATS {a.atsScore}
                        </Badge>
                        <span className={`text-[10px] ${isEmberTheme ? "text-[#92400e]/60" : "text-muted-foreground"}`}>
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
                            <span className={`inline-flex items-center gap-0.5 text-[10px] ${isEmberTheme ? "text-[#92400e]/70" : "text-muted-foreground"}`}>
                              <MapPin className="w-2.5 h-2.5" />{aLocation}
                            </span>
                          )}
                          {aSalary && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] ${isEmberTheme ? "text-[#92400e]/70" : "text-muted-foreground"}`}>
                              <DollarSign className="w-2.5 h-2.5" />{aSalary}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Deadline chip */}
                      {a.deadline && (
                        <div className={`text-[10px] flex items-center gap-0.5 font-medium ${isEmberTheme ? "text-[#92400e]" : "text-orange-600 dark:text-orange-400"}`}>
                          <CalendarClock className="w-2.5 h-2.5" />
                          Due {format(new Date(a.deadline), "MMM d")}
                        </div>
                      )}

                      {/* Tags */}
                      {Array.isArray(a.tags) && (a.tags as string[]).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(a.tags as string[]).slice(0, 3).map((tag) => (
                            <span key={tag} className={`text-[10px] px-1.5 py-0 rounded-full border ${isEmberTheme ? "border-[#92400e]/30 text-[#92400e]" : "bg-primary/5 text-primary border-primary/20"}`}>
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
