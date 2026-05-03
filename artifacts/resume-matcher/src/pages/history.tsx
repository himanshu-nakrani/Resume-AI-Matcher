import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useListAnalyses,
  useDeleteAnalysis,
  useUpdateAnalysis,
  getListAnalysesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScoreCircle } from "@/components/score-circle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Trash2, ArrowRight, ChevronDown, Search, Heart, Filter, X } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type Status = "not_applied" | "applied" | "interview" | "offer" | "rejected";

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  not_applied: { label: "Not Applied", className: "bg-muted text-muted-foreground border-muted-foreground/20" },
  applied: { label: "Applied", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
  interview: { label: "Interview", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800" },
  offer: { label: "Offer", className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" },
};

const ALL_STATUSES: Status[] = ["not_applied", "applied", "interview", "offer", "rejected"];

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

export function History() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const { data: analyses, isLoading } = useListAnalyses();
  const deleteAnalysis = useDeleteAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-1">All your resume analyses, most recent first.</p>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(""); setStatusFilter("all"); setFavoritesOnly(false); }}
              className="text-muted-foreground gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
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
          <p className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "analysis" : "analyses"}</p>
          {filtered.map((a) => (
            <Card
              key={a.id}
              className="group border shadow-sm hover:shadow-md transition-all cursor-pointer"
              onClick={() => setLocation(`/analysis/${a.id}`)}
              data-testid={`row-analysis-${a.id}`}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <ScoreCircle score={a.fitScore} size="sm" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{a.jobTitle}</p>
                    {a.companyName && (
                      <span className="text-sm text-muted-foreground truncate">@ {a.companyName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <StatusPicker analysisId={a.id} currentStatus={a.status} />
                    <Badge variant="outline" className="text-xs">ATS {a.atsScore}</Badge>
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
