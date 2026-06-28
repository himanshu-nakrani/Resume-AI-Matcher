import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListAnalyses,
  useDeleteAnalysis,
  useUpdateAnalysis,
  useDuplicateAnalysis,
  getListAnalysesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScoreCircle } from "@/components/score-circle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sparkles,
  Trash2,
  ArrowRight,
  ChevronDown,
  Search,
  Heart,
  Filter,
  X,
  Download,
  Copy,
  Bookmark,
  BookmarkCheck,
  Pencil,
  Check,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Status = "not_applied" | "applied" | "got_interview" | "got_online_exam" | "selected" | "rejected";

const STATUS_CONFIG: Record<Status, { label: string; className: string; icon?: string }> = {
  not_applied: { label: "Not Applied", className: "bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80 transition-colors" },
  applied: { label: "Applied", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 transition-colors" },
  got_interview: { label: "Got Interview", className: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800 transition-colors" },
  got_online_exam: { label: "Got Online Exam", className: "bg-secondary text-secondary-foreground border-border dark:bg-secondary dark:text-secondary-foreground dark:border-border transition-colors" },
  selected: { label: "Selected", className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800 transition-colors" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800 transition-colors" },
};

const ALL_STATUSES: Status[] = ["not_applied", "applied", "got_interview", "got_online_exam", "selected", "rejected"];
const SAVED_SEARCHES_KEY = "optimatch_saved_searches";

type SavedSearch = {
  id: string;
  name: string;
  query: string;
  status: Status | "all";
  favoritesOnly: boolean;
};

function loadSavedSearches(): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveSavedSearches(searches: SavedSearch[]) {
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(searches));
}

function StatusPicker({ analysisId, currentStatus }: { analysisId: number; currentStatus: string }) {
  const queryClient = useQueryClient();
  const updateAnalysis = useUpdateAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
    },
  });
  const status = (currentStatus as Status) in STATUS_CONFIG ? (currentStatus as Status) : "not_applied";
  const config = STATUS_CONFIG[status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-opacity hover:opacity-80 ${config.className}`}
          data-testid={`status-picker-${analysisId}`}
        >
          {config.label}
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {ALL_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            className="cursor-pointer"
            onSelect={() => updateAnalysis.mutate({ id: analysisId, data: { status: s } })}
            data-testid={`status-option-${s}`}
          >
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_CONFIG[s].className}`}>
              {STATUS_CONFIG[s].label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FavoriteButton({ analysisId, isFavorite }: { analysisId: number; isFavorite: boolean }) {
  const queryClient = useQueryClient();
  const update = useUpdateAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
    },
  });
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        update.mutate({ id: analysisId, data: { isFavorite: !isFavorite } });
      }}
      className={`p-1 rounded transition-colors ${isFavorite ? "text-pink-500" : "text-muted-foreground hover:text-pink-400"}`}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-pink-500" : ""}`} />
    </button>
  );
}

function InlineEdit({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={commit}
          className="text-sm font-semibold bg-transparent border-b border-primary outline-none w-full"
        />
        <button onClick={commit} className="text-primary shrink-0"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground shrink-0"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 group/edit ${className}`}>
      <span>{value}</span>
      <button
        onClick={start}
        className="opacity-0 group-hover/edit:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5 rounded"
        title="Edit"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

export function History() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(loadSavedSearches);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: analyses, isLoading } = useListAnalyses();
  const deleteAnalysis = useDeleteAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
    },
  });
  const updateAnalysis = useUpdateAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
    },
  });
  const duplicateAnalysis = useDuplicateAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        toast({ title: "Analysis duplicated", description: "Opening the duplicate now." });
        setLocation(`/analysis/${data.id}`);
      },
    },
  });

  const filtered = useMemo(() => {
    if (!analyses) return [];
    return analyses.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        a.jobTitle.toLowerCase().includes(q) ||
        (a.companyName ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      const matchesFavorite = !favoritesOnly || a.isFavorite;
      return matchesSearch && matchesStatus && matchesFavorite;
    });
  }, [analyses, search, statusFilter, favoritesOnly]);

  useEffect(() => {
    // Drop selections that are no longer visible after filter change.
    setSelectedIds((prev) => {
      const next = new Set<number>();
      for (const id of prev) {
        if (filtered.some((a) => a.id === id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  const statusCounts = analyses
    ? ALL_STATUSES.reduce((acc, s) => {
        acc[s] = analyses.filter((a) => a.status === s).length;
        return acc;
      }, {} as Record<Status, number>)
    : null;

  const hasFilters = search || statusFilter !== "all" || favoritesOnly;

  const exportCSV = useCallback(() => {
    if (!filtered.length) return;
    const headers = ["ID", "Job Title", "Company", "Fit Score", "ATS Score", "Status", "Favorite", "Deadline", "Notes", "Created At"];
    const rows = filtered.map((a) => [
      a.id,
      '"' + a.jobTitle.replace(/"/g, '""') + '"',
      '"' + (a.companyName ?? "").replace(/"/g, '""') + '"',
      a.fitScore,
      a.atsScore,
      a.status,
      a.isFavorite ? "Yes" : "No",
      a.deadline ?? "",
      '"' + (a.notes ?? "").replace(/"/g, '""') + '"',
      format(new Date(a.createdAt), "yyyy-MM-dd"),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "optimatch-analyses-" + format(new Date(), "yyyy-MM-dd") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", description: `${filtered.length} analyses downloaded.` });
  }, [filtered, toast]);

  const saveCurrentSearch = useCallback(() => {
    if (!hasFilters) {
      toast({ title: "Nothing to save", description: "Set a search or filter first.", variant: "destructive" });
      return;
    }
    const name = window.prompt("Name this saved search:");
    if (!name?.trim()) return;
    const newSearch: SavedSearch = {
      id: crypto.randomUUID(),
      name: name.trim(),
      query: search,
      status: statusFilter,
      favoritesOnly,
    };
    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    saveSavedSearches(updated);
    toast({ title: "Search saved", description: `"${newSearch.name}" saved for quick access.` });
  }, [hasFilters, search, statusFilter, favoritesOnly, savedSearches, toast]);

  const applySavedSearch = useCallback((s: SavedSearch) => {
    setSearch(s.query);
    setStatusFilter(s.status);
    setFavoritesOnly(s.favoritesOnly);
    setShowSavedSearches(false);
  }, []);

  const deleteSavedSearch = useCallback((id: string) => {
    const updated = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(updated);
    saveSavedSearches(updated);
  }, [savedSearches]);

  const toggleSelect = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleId = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filtered.map((a) => a.id)));
  }, [filtered]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const confirmed = window.confirm(`Delete ${count} selected ${count === 1 ? "analysis" : "analyses"}? This cannot be undone.`);
    if (!confirmed) return;
    Promise.all(Array.from(selectedIds).map((id) => deleteAnalysis.mutateAsync({ id })))
      .then(() => {
        setSelectedIds(new Set());
        toast({ title: `${count} ${count === 1 ? "analysis" : "analyses"} deleted` });
      })
      .catch(() => toast({ title: "Some deletions failed", variant: "destructive" }));
  }, [selectedIds, deleteAnalysis, toast]);

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Analyses
            {analyses && analyses.length > 0 && (
              <Badge variant="default" size="sm" className="ml-3 align-middle">
                {analyses.length}
              </Badge>
            )}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            All your resume analyses, most recent first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedSearches.length > 0 && (
            <DropdownMenu open={showSavedSearches} onOpenChange={setShowSavedSearches}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <BookmarkCheck className="w-3.5 h-3.5 mr-1.5" />
                  Saved
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Saved searches</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {savedSearches.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                    onSelect={() => applySavedSearch(s)}
                  >
                    <span className="flex-1 truncate text-sm">{s.name}</span>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-destructive p-0.5 rounded"
                      onClick={(e) => { e.stopPropagation(); deleteSavedSearch(s.id); }}
                      aria-label="Delete saved search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {filtered.length > 0 && (
            <Button variant="secondary" size="sm" onClick={exportCSV}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
          )}
        </div>
      </header>

      {/* BULK SELECTION BAR */}
      {selectedIds.size > 0 && (
        <div className="sticky top-12 z-20 -mx-6 -my-2 flex items-center justify-between gap-3 border-b border-border bg-surface-1 px-6 py-2 backdrop-blur-md">
          <span className="text-[13px] text-muted-foreground">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={deleteSelected}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete {selectedIds.size}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      {analyses && analyses.length > 0 && (
        <Card padding="sm">
          <CardContent className="flex flex-wrap items-center gap-3 p-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by title or company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setStatusFilter("all")}
                className={cn(
                  "h-7 rounded-[4px] px-2 text-[11px] font-medium tracking-[0.04em] transition-colors",
                  statusFilter === "all"
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
                )}
              >
                All
              </button>
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                  className={cn(
                    "h-7 rounded-[4px] px-2 text-[11px] font-medium tracking-[0.04em] transition-colors",
                    statusFilter === s
                      ? "bg-accent-soft text-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
                  )}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
            <Button
              variant={favoritesOnly ? "default" : "ghost"}
              size="sm"
              onClick={() => setFavoritesOnly(!favoritesOnly)}
            >
              <Heart className={cn("w-3.5 h-3.5 mr-1.5", favoritesOnly && "fill-current")} />
              Favorites
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setFavoritesOnly(false); }}>
                <X className="w-3.5 h-3.5 mr-1.5" />Clear
              </Button>
            )}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={saveCurrentSearch} title="Save this search">
                <Bookmark className="w-3.5 h-3.5 mr-1.5" />Save
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* LOADING STATE */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 rounded-md" />
          ))}
        </div>
      )}

      {/* EMPTY: NO ANALYSES AT ALL */}
      {!isLoading && analyses && analyses.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sparkles />
            </EmptyMedia>
            <EmptyTitle>No analyses yet</EmptyTitle>
            <EmptyDescription>
              Paste a resume and a job description on the home page to see your first analysis.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setLocation("/")} data-testid="button-new-analysis">
              Start a new analysis
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {/* EMPTY: NO MATCHES FOR CURRENT FILTERS */}
      {!isLoading && analyses && analyses.length > 0 && filtered.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No matches</EmptyTitle>
            <EmptyDescription>No analyses match your filters.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="secondary" onClick={() => { setSearch(""); setStatusFilter("all"); setFavoritesOnly(false); }}>
              Clear filters
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {/* DESKTOP TABLE (md+) */}
      {!isLoading && filtered.length > 0 && (
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Title</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Company</th>
                <th className="w-16 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Fit</th>
                <th className="w-16 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">ATS</th>
                <th className="w-32 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Status</th>
                <th className="hidden lg:table-cell w-28 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Created</th>
                <th className="w-12 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const isSampled = (a.tags ?? []).includes("sample");
                return (
                  <tr
                    key={a.id}
                    className="border-b border-border hover:bg-surface-2 cursor-pointer group"
                    onClick={() => setLocation(`/analysis/${a.id}`)}
                    title={`Created ${format(new Date(a.createdAt), "PPp")}`}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-border"
                        checked={selectedIds.has(a.id)}
                        onChange={() => toggleId(a.id)}
                        aria-label="Select row"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FavoriteButton analysisId={a.id} isFavorite={a.isFavorite} />
                        <span className="text-[13px] font-medium truncate">{a.jobTitle}</span>
                        {isSampled && <Badge variant="soft" size="sm">Sample</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[13px] text-muted-foreground truncate">{a.companyName ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[13px]" style={{ color: a.fitScore >= 80 ? "hsl(var(--success))" : a.fitScore >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))" }}>
                      {a.fitScore}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[13px] text-muted-foreground">{a.atsScore}</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <StatusPicker analysisId={a.id} currentStatus={a.status} />
                    </td>
                    <td className="hidden lg:table-cell px-3 py-2 text-[12px] text-muted-foreground">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setLocation(`/analysis/${a.id}`)}>
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => duplicateAnalysis.mutate({ id: a.id })}>
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => deleteAnalysis.mutate({ id: a.id })}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MOBILE CARDS (below md) */}
      {!isLoading && filtered.length > 0 && (
        <div className="md:hidden space-y-3">
          {filtered.map((a) => {
            const isSampled = (a.tags ?? []).includes("sample");
            return (
              <Card
                key={a.id}
                padding="sm"
                className="cursor-pointer hover:border-border-strong transition-colors"
                onClick={() => setLocation(`/analysis/${a.id}`)}
              >
                <CardContent className="flex items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border shrink-0"
                    checked={selectedIds.has(a.id)}
                    onChange={(e) => { e.stopPropagation(); toggleId(a.id); }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Select row"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-medium truncate">{a.jobTitle}</p>
                          {isSampled && <Badge variant="soft" size="sm">Sample</Badge>}
                        </div>
                        {a.companyName && <p className="text-[12px] text-muted-foreground truncate">{a.companyName}</p>}
                      </div>
                      <FavoriteButton analysisId={a.id} isFavorite={a.isFavorite} />
                    </div>
                    <div className="flex items-center gap-3 text-[12px]">
                      <span className="font-mono tabular-nums" style={{ color: a.fitScore >= 80 ? "hsl(var(--success))" : a.fitScore >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))" }}>
                        Fit {a.fitScore}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">ATS {a.atsScore}</span>
                      <span className="text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <StatusPicker analysisId={a.id} currentStatus={a.status} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
