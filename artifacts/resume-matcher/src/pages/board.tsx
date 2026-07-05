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
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";
import { unknownErrorMessage } from "@/lib/api-error";
import {
  AlertCircle,
  Filter,
  X,
  MapPin,
  Tag,
  CalendarClock,
  SlidersHorizontal,
  LayoutGrid,
  RefreshCw,
} from "lucide-react";

type Status =
  | "not_applied"
  | "applied"
  | "got_interview"
  | "got_online_exam"
  | "selected"
  | "rejected";

const STATUS_CONFIG: Record<
  Status,
  { label: string; className: string; headerColor: string; borderColor: string }
> = {
  not_applied: {
    label: "Not Applied",
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
    headerColor: "bg-muted/50",
    borderColor: "border-muted-foreground/30",
  },
  applied: {
    label: "Applied",
    className:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    headerColor: "bg-blue-500/10",
    borderColor: "border-blue-400",
  },
  got_interview: {
    label: "Got Interview",
    className:
      "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
    headerColor: "bg-yellow-500/10",
    borderColor: "border-yellow-400",
  },
  got_online_exam: {
    label: "Got Online Exam",
    className:
      "bg-secondary text-secondary-foreground border-border dark:bg-secondary dark:text-secondary-foreground dark:border-border",
    headerColor: "bg-secondary/50",
    borderColor: "border-muted-foreground/40",
  },
  selected: {
    label: "Selected",
    className:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    headerColor: "bg-green-500/10",
    borderColor: "border-green-400",
  },
  rejected: {
    label: "Rejected",
    className:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    headerColor: "bg-red-500/10",
    borderColor: "border-red-400",
  },
};

const COLUMNS: Status[] = [
  "not_applied",
  "applied",
  "got_interview",
  "got_online_exam",
  "selected",
  "rejected",
];
const STATUS_SET = new Set<Status>(COLUMNS);

const STATUS_COLORS: Record<string, string> = {
  not_applied: "hsl(var(--muted-foreground))",
  applied: "hsl(var(--info))",
  got_interview: "hsl(var(--warning))",
  got_online_exam: "hsl(var(--accent))",
  selected: "hsl(var(--success))",
  rejected: "hsl(var(--destructive))",
};

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return stringArray(parsed);
    } catch {
      return [trimmed];
    }

    return [trimmed];
  }

  return [];
}

function statusKey(value: unknown): Status {
  return typeof value === "string" && STATUS_SET.has(value as Status)
    ? (value as Status)
    : "not_applied";
}

function safeScore(value: unknown): number {
  const score = numberValue(value) ?? 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizedMinScore(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(0, parsed));
}

type BoardAnalysis = {
  id: number;
  jobTitle: string;
  companyName: string | null;
  fitScore: number;
  status: Status;
  tags: string[];
  location: string | null;
  deadline: string | null;
};

function normalizeAnalysis(value: unknown): BoardAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const analysis = value as Record<string, unknown>;
  const id = numberValue(analysis.id);
  if (id === null) return null;

  return {
    id,
    jobTitle: stringValue(analysis.jobTitle) || "Untitled role",
    companyName: stringValue(analysis.companyName) || null,
    fitScore: safeScore(analysis.fitScore),
    status: statusKey(analysis.status),
    tags: stringArray(analysis.tags),
    location: stringValue(analysis.location) || null,
    deadline: stringValue(analysis.deadline) || null,
  };
}

export function Board() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(false);
  const [minScore, setMinScore] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [hasDeadlineOnly, setHasDeadlineOnly] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [movingIds, setMovingIds] = useState<Set<number>>(new Set());

  const {
    data: allAnalyses,
    isLoading,
    error,
    refetch: refetchAnalyses,
    isFetching,
  } = useListAnalyses();
  const analysesList = useMemo(
    () =>
      (Array.isArray(allAnalyses) ? allAnalyses : [])
        .map(normalizeAnalysis)
        .filter((analysis): analysis is BoardAnalysis => analysis != null),
    [allAnalyses],
  );
  const updateAnalysis = useUpdateAnalysis({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        toast({ title: "Status updated" });
      },
      onError: (err) => {
        toast({
          title: "Could not update status",
          description:
            err instanceof Error ? err.message : "Try again in a moment.",
          variant: "destructive",
        });
      },
    },
  });

  const allTags = useMemo(() => {
    const set = new Set<string>();
    analysesList.forEach((a) => {
      a.tags.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [analysesList]);

  const filtered = useMemo(() => {
    const scoreFilter = normalizedMinScore(minScore);
    const locationFilter = filterLocation.trim().toLowerCase();
    const searchFilter = searchText.trim().toLowerCase();

    return analysesList.filter((a) => {
      if (scoreFilter !== null && a.fitScore < scoreFilter) return false;
      if (filterTag && !a.tags.includes(filterTag)) return false;
      if (filterLocation) {
        const loc = a.location ?? "";
        if (!loc.toLowerCase().includes(locationFilter)) return false;
      }
      if (hasDeadlineOnly && !a.deadline) return false;
      if (searchFilter) {
        const title = stringValue(a.jobTitle).toLowerCase();
        const company = stringValue(a.companyName).toLowerCase();
        if (!title.includes(searchFilter) && !company.includes(searchFilter))
          return false;
      }
      return true;
    });
  }, [
    analysesList,
    minScore,
    filterTag,
    filterLocation,
    hasDeadlineOnly,
    searchText,
  ]);

  const activeFilterCount = [
    minScore,
    filterTag,
    filterLocation,
    hasDeadlineOnly,
    searchText,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setMinScore("");
    setFilterTag("");
    setFilterLocation("");
    setHasDeadlineOnly(false);
    setSearchText("");
  };

  const columns = useMemo(() => {
    const groups: Record<Status, BoardAnalysis[]> = {
      not_applied: [],
      applied: [],
      got_interview: [],
      got_online_exam: [],
      selected: [],
      rejected: [],
    };
    filtered.forEach((a) => {
      groups[statusKey(a.status)].push(a);
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
    moveAnalysis(id, targetStatus);
  };

  const moveAnalysis = (id: number, targetStatus: Status) => {
    if (movingIds.has(id)) return;
    const analysis = analysesList.find((item) => item.id === id);
    const currentStatus = statusKey(analysis?.status);
    if (currentStatus === targetStatus) return;

    setMovingIds((prev) => new Set(prev).add(id));
    updateAnalysis.mutate(
      { id, data: { status: targetStatus } },
      {
        onSettled: () => {
          setMovingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="flex h-[calc(100vh-14rem)] min-h-[28rem] gap-4 overflow-x-auto rounded-lg border border-border bg-surface-2/20 p-3">
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
    <div className="flex h-full min-w-0 flex-col space-y-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Application tracker
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Pipeline of every analysis in flight.
            {activeFilterCount > 0 && (
              <span className="ml-2 text-accent font-medium">
                {filtered.length} of {analysesList.length} shown
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
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Clear all
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Search
                </label>
                <Input
                  placeholder="Job title or company..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              {/* Min Score */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Min Fit Score
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 70"
                    value={minScore}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        setMinScore("");
                        return;
                      }
                      const parsed = Number(value);
                      if (Number.isFinite(parsed))
                        setMinScore(String(Math.min(100, Math.max(0, parsed))));
                    }}
                    className="h-8 text-xs pr-8"
                  />
                  {minScore && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setMinScore("")}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {/* Tag Filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Tag
                </label>
                <select
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                >
                  <option value="">All tags</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {/* Location */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Location
                </label>
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
                className={
                  "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors " +
                  (hasDeadlineOnly
                    ? "border-warning/30 bg-warning/10 text-warning"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground")
                }
              >
                <CalendarClock className="w-3.5 h-3.5" />
                Has deadline only
              </button>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {minScore && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                    Fit ≥ {minScore}%
                    <button onClick={() => setMinScore("")}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
                {filterTag && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                    Tag: {filterTag}
                    <button onClick={() => setFilterTag("")}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
                {filterLocation && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                    <MapPin className="w-2.5 h-2.5" /> {filterLocation}
                    <button onClick={() => setFilterLocation("")}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
                {hasDeadlineOnly && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                    Has deadline
                    <button onClick={() => setHasDeadlineOnly(false)}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
                {searchText && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                    "{searchText}"
                    <button onClick={() => setSearchText("")}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      {error ? (
        <Empty className="bg-surface-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>Could not load tracker</EmptyTitle>
            <EmptyDescription>
              {unknownErrorMessage(
                error,
                "Refresh the page or try again in a moment.",
              )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              onClick={() => void refetchAnalyses()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
              />
              {isFetching ? "Retrying..." : "Retry"}
            </Button>
          </EmptyContent>
        </Empty>
      ) : analysesList.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGrid />
            </EmptyMedia>
            <EmptyTitle>No analyses in your pipeline</EmptyTitle>
            <EmptyDescription>
              Run an analysis from the Optimize page to start tracking
              applications.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setLocation("/")}>
              Start a new analysis
            </Button>
          </EmptyContent>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty className="bg-surface-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Filter />
            </EmptyMedia>
            <EmptyTitle>No applications match these filters</EmptyTitle>
            <EmptyDescription>
              Clear one or more filters to bring analyses back into the tracker.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="min-w-0 max-w-full flex-1 overflow-hidden">
          <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-subtle-foreground">
            <span>{filtered.length} applications across 6 stages</span>
          </div>
          <div className="flex h-[calc(100vh-14rem)] min-h-[28rem] items-stretch gap-4 overflow-x-auto rounded-lg border border-border bg-surface-2/20 p-3">
            {COLUMNS.map((status) => (
              <div
                key={status}
                className="flex h-full w-72 shrink-0 flex-col"
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, status)}
              >
                <div className="mb-2 shrink-0 border-b border-border pb-2">
                  <h3 className="text-[13px] font-semibold flex items-center gap-2">
                    {STATUS_CONFIG[status].label}
                    <Badge variant="default" size="sm">
                      {columns[status]?.length ?? 0}
                    </Badge>
                  </h3>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-border bg-surface-1 p-3">
                  {columns[status]?.length === 0 ? (
                    <p className="text-[12px] text-subtle-foreground text-center py-4">
                      Drag analyses here
                    </p>
                  ) : (
                    columns[status]?.map((a) => {
                      const isMoving = movingIds.has(a.id);
                      const currentStatus = a.status;
                      const score = a.fitScore;
                      return (
                        <Card
                          key={a.id}
                          padding="sm"
                          draggable={!isMoving}
                          onDragStart={(e) => onDragStart(e, a.id)}
                          className={`cursor-pointer hover:border-border-strong transition-colors border-l-2 ${isMoving ? "pointer-events-none opacity-60" : ""}`}
                          style={{
                            borderLeftColor:
                              STATUS_COLORS[status] ||
                              "hsl(var(--muted-foreground))",
                          }}
                          onClick={() => setLocation(`/analysis/${a.id}`)}
                          aria-busy={isMoving}
                        >
                          <CardContent className="flex items-center justify-between gap-3 p-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium truncate">
                                {a.jobTitle}
                              </p>
                              {a.companyName && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {a.companyName}
                                </p>
                              )}
                              {isMoving && (
                                <p className="text-[10px] text-muted-foreground">
                                  Updating status...
                                </p>
                              )}
                              <select
                                className="mt-2 h-7 max-w-full rounded-md border border-input bg-background px-2 text-[11px] text-muted-foreground"
                                value={currentStatus}
                                disabled={isMoving}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  moveAnalysis(
                                    a.id,
                                    event.target.value as Status,
                                  );
                                }}
                                aria-label={`Move ${a.jobTitle} to status`}
                                data-testid={`board-status-${a.id}`}
                              >
                                {COLUMNS.map((nextStatus) => (
                                  <option key={nextStatus} value={nextStatus}>
                                    {STATUS_CONFIG[nextStatus].label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <ScoreCircle score={score} size="sm" />
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
