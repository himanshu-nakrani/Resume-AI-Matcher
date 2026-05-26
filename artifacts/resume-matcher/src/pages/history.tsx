import { useState, useMemo, useCallback, useRef } from "react";
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
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Status = "not_applied" | "applied" | "got_interview" | "got_online_exam" | "selected" | "rejected";

const STATUS_CONFIG: Record<Status, { label: string; className: string; icon?: string }> = {
  not_applied: { label: "Not Applied", className: "bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80 transition-colors" },
  applied: { label: "Applied", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 transition-colors" },
  got_interview: { label: "Got Interview", className: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800 transition-colors" },
  got_online_exam: { label: "Got Online Exam", className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800 transition-colors" },
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

  const inSelectionMode = selectedIds.size > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground mt-1">All your resume analyses, most recent first.</p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {inSelectionMode && (
            <>
              <span className="text-sm text-muted-foreground self-center">{selectedIds.size} selected</span>
              <Button variant="destructive" size="sm" className="gap-1.5" onClick={deleteSelected}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete {selectedIds.size}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </>
          )}
          {!inSelectionMode && savedSearches.length > 0 && (
            <DropdownMenu open={showSavedSearches} onOpenChange={setShowSavedSearches}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  Saved
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Saved Searches</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {savedSearches.map((s) => (
                  <DropdownMenuItem key={s.id} className="flex items-center justify-between gap-2 cursor-pointer" onSelect={() => applySavedSearch(s)}>
                    <span className="flex-1 truncate text-sm">{s.name}</span>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-destructive p-0.5 rounded"
                      onClick={(e) => { e.stopPropagation(); deleteSavedSearch(s.id); }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!inSelectionMode && filtered.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Pipeline summary */}
      {statusCounts && analyses && analyses.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ALL_STATUSES.filter((s) => s !== "not_applied").map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={`rounded-lg border px-3 py-2 text-center transition-all ${STATUS_CONFIG[s].className} ${statusFilter === s ? "ring-2 ring-offset-1 ring-current" : "hover:opacity-80"}`}
            >
              <p className="text-2xl font-bold tabular-nums">{statusCounts[s]}</p>
              <p className="text-xs font-medium mt-0.5">{STATUS_CONFIG[s].label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search + Filter bar */}
      {analyses && analyses.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by title or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <Button
            variant={favoritesOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className="gap-1.5"
          >
            <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? "fill-current" : ""}`} />
            Favorites
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                {statusFilter === "all" ? "All statuses" : STATUS_CONFIG[statusFilter].label}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setStatusFilter("all")}>All statuses</DropdownMenuItem>
              {ALL_STATUSES.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => setStatusFilter(s)}>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_CONFIG[s].className}`}>
                    {STATUS_CONFIG[s].label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {hasFilters && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setStatusFilter("all"); setFavoritesOnly(false); }}
                className="text-muted-foreground gap-1"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={saveCurrentSearch}
                className="text-muted-foreground gap-1"
                title="Save this search"
              >
                <Bookmark className="w-3.5 h-3.5" /> Save
              </Button>
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : !analyses || analyses.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No analyses yet</p>
          <p className="text-sm mt-1">Run your first analysis to see it here.</p>
          <Button className="mt-4" onClick={() => setLocation("/")} data-testid="button-new-analysis">
            Start New Analysis
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
          <Search className="w-6 h-6 mx-auto mb-2 opacity-30" />
          <p className="font-medium">No matches</p>
          <p className="text-sm mt-1">Try adjusting your search or filters.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(""); setStatusFilter("all"); setFavoritesOnly(false); }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="space-y-3" data-testid="analysis-list">
          {/* Batch select header */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div
              role="button"
              tabIndex={0}
              onClick={inSelectionMode ? clearSelection : selectAll}
              onKeyDown={(e) => e.key === "Enter" && (inSelectionMode ? clearSelection() : selectAll())}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
            >
              <Checkbox
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onCheckedChange={(v) => v ? selectAll() : clearSelection()}
                className="w-3.5 h-3.5"
              />
              {inSelectionMode ? `${selectedIds.size} selected` : `${filtered.length} ${filtered.length === 1 ? "analysis" : "analyses"}`}
            </div>
            {inSelectionMode && selectedIds.size < filtered.length && (
              <button onClick={selectAll} className="hover:text-foreground transition-colors">Select all {filtered.length}</button>
            )}
          </div>

          {filtered.map((a) => (
            <Card
              key={a.id}
              className={`group border shadow-sm hover:shadow-md transition-all cursor-pointer ${selectedIds.has(a.id) ? "ring-2 ring-primary border-primary" : ""}`}
              onClick={() => !inSelectionMode && setLocation(`/analysis/${a.id}`)}
              data-testid={`row-analysis-${a.id}`}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div onClick={(e) => toggleSelect(a.id, e)} className="shrink-0">
                  <Checkbox
                    checked={selectedIds.has(a.id)}
                    onCheckedChange={() => setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(a.id)) next.delete(a.id);
                      else next.add(a.id);
                      return next;
                    })}
                    className="w-4 h-4 opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
                  />
                </div>
                <ScoreCircle score={a.fitScore} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <InlineEdit
                      value={a.jobTitle}
                      onSave={(v) => updateAnalysis.mutate({ id: a.id, data: { status: a.status } })}
                      className="font-semibold text-sm"
                    />
                    {a.companyName && (
                      <span className="text-sm text-muted-foreground truncate">@ {a.companyName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <StatusPicker analysisId={a.id} currentStatus={a.status} />
                    <Badge variant="outline" className="text-xs">ATS {a.atsScore}</Badge>
                    {a.deadline && (
                      <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400">
                        Due {format(new Date(a.deadline), "MMM d")}
                      </Badge>
                    )}
                    {a.coverLetter && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Cover Letter
                      </Badge>
                    )}
                    {a.isPublic && (
                      <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        Shared
                      </Badge>
                    )}
                    {a.notes && (
                      <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Note
                      </Badge>
                    )}
                    {Array.isArray(a.tags) && a.tags.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {(a.tags as string[])[0]}
                        {(a.tags as string[]).length > 1 && ` +${(a.tags as string[]).length - 1}`}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-sm font-medium text-muted-foreground">{format(new Date(a.createdAt), "MMM d, yyyy")}</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <FavoriteButton analysisId={a.id} isFavorite={a.isFavorite} />
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateAnalysis.mutate({ id: a.id });
                      }}
                      title="Duplicate analysis"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAnalysis.mutate({ id: a.id });
                      }}
                      data-testid={`button-delete-${a.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
