import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  apiErrorMessage,
  unknownErrorMessage,
  type ApiErrorPayload,
} from "@/lib/api-error";
import {
  Bookmark,
  Trash2,
  ExternalLink,
  Search,
  X,
  MousePointerClick,
  DollarSign,
  Save,
  PlusCircle,
  StickyNote,
} from "lucide-react";

interface SavedJob {
  id: number;
  url: string;
  title: string;
  company: string | null;
  source: string | null;
  publishedDate: string | null;
  highlights: string[] | null;
  salary: string | null;
  applyType: "ats" | "external" | "unknown" | null;
  notes: string | null;
  tags: string[];
  savedAt: string;
}

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

function dateTime(value: unknown): number {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function shortDate(value: unknown): string | null {
  const time = dateTime(value);
  if (!time) return null;
  return new Date(time).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function normalizeJob(value: unknown): SavedJob | null {
  if (!value || typeof value !== "object") return null;
  const job = value as Partial<SavedJob>;
  if (
    typeof job.id !== "number" ||
    typeof job.url !== "string" ||
    typeof job.title !== "string"
  ) {
    return null;
  }

  const applyType =
    job.applyType === "ats" ||
    job.applyType === "external" ||
    job.applyType === "unknown"
      ? job.applyType
      : "unknown";

  return {
    id: job.id,
    url: job.url,
    title: job.title,
    company: typeof job.company === "string" ? job.company : null,
    source: typeof job.source === "string" ? job.source : null,
    publishedDate:
      typeof job.publishedDate === "string" ? job.publishedDate : null,
    highlights: stringArray(job.highlights),
    salary: typeof job.salary === "string" ? job.salary : null,
    applyType,
    notes: typeof job.notes === "string" ? job.notes : null,
    tags: stringArray(job.tags),
    savedAt: typeof job.savedAt === "string" ? job.savedAt : "",
  };
}

export function SavedJobsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const fetchSavedJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-jobs");
      const data = (await res.json().catch(() => null)) as
        | SavedJob[]
        | ApiErrorPayload
        | null;
      if (!res.ok) {
        throw new Error(
          apiErrorMessage(
            data as ApiErrorPayload | null,
            "Could not load saved jobs.",
          ),
        );
      }
      setSavedJobs(
        Array.isArray(data)
          ? data.map(normalizeJob).filter((job): job is SavedJob => job != null)
          : [],
      );
    } catch (err) {
      toast({
        title: "Could not load saved jobs",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSavedJobs();
  }, []);

  const deleteJob = async (id: number) => {
    try {
      const res = await fetch(`/api/saved-jobs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        throw new Error(apiErrorMessage(data, "Could not remove this job."));
      }
      setSavedJobs((prev) => prev.filter((j) => j.id !== id));
      toast({ title: "Job removed" });
    } catch (err) {
      toast({
        title: "Could not remove job",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const saveNotes = async (id: number) => {
    try {
      const res = await fetch(`/api/saved-jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (!res.ok) {
        const data = (await res
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        throw new Error(apiErrorMessage(data, "Could not save notes."));
      }
      setSavedJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, notes: notesDraft } : j)),
      );
      setEditingNotes(null);
      toast({ title: "Notes saved" });
    } catch (err) {
      toast({
        title: "Could not save notes",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const removeTag = async (id: number, tag: string) => {
    const job = savedJobs.find((j) => j.id === id);
    if (!job) return;
    const newTags = stringArray(job.tags).filter((t) => t !== tag);
    try {
      const res = await fetch(`/api/saved-jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      if (!res.ok) {
        const data = (await res
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        throw new Error(apiErrorMessage(data, "Could not remove tag."));
      }
      setSavedJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, tags: newTags } : j)),
      );
    } catch (err) {
      toast({
        title: "Could not remove tag",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const visibleJobs = useMemo(
    () =>
      [...savedJobs].sort(
        (a, b) => dateTime(b.savedAt) - dateTime(a.savedAt) || b.id - a.id,
      ),
    [savedJobs],
  );

  const stats = useMemo(
    () => ({
      total: visibleJobs.length,
      easyApply: visibleJobs.filter((job) => job.applyType === "ats").length,
      withNotes: visibleJobs.filter((job) => Boolean(job.notes?.trim())).length,
      sources: new Set(visibleJobs.map((job) => job.source).filter(Boolean))
        .size,
    }),
    [visibleJobs],
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = visibleJobs.filter(
    (job) =>
      !normalizedSearch ||
      job.title.toLowerCase().includes(normalizedSearch) ||
      (job.company ?? "").toLowerCase().includes(normalizedSearch) ||
      (job.source ?? "").toLowerCase().includes(normalizedSearch),
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 md:py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-1">
            <Bookmark className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Saved Jobs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep high-signal listings, notes, and apply paths in one review
              queue.
            </p>
          </div>
        </div>
        <Button onClick={() => setLocation("/?panel=jobs")}>
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
          Find jobs
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Saved" value={stats.total} />
        <MetricCard label="Easy apply" value={stats.easyApply} />
        <MetricCard label="With notes" value={stats.withNotes} />
        <MetricCard label="Sources" value={stats.sources} />
      </div>

      <div className="flex gap-3 rounded-lg border border-border bg-surface-1 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, company, or source..."
            className="h-9 pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-7 w-7"
              onClick={() => setSearchTerm("")}
              aria-label="Clear saved job search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Empty className="bg-surface-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {searchTerm ? <Search /> : <Bookmark />}
            </EmptyMedia>
            <EmptyTitle>
              {searchTerm ? "No matches" : "No saved jobs yet"}
            </EmptyTitle>
            <EmptyDescription>
              {searchTerm
                ? "Try a different title, company, or source."
                : "Save jobs from search results to build a focused shortlist."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {searchTerm ? (
              <Button variant="outline" onClick={() => setSearchTerm("")}>
                Clear search
              </Button>
            ) : (
              <Button onClick={() => setLocation("/?panel=jobs")}>
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                Search jobs
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => {
            const tags = stringArray(job.tags);
            const savedAt = shortDate(job.savedAt);
            return (
              <Card key={job.id} padding="lg" className="bg-surface-1">
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {job.source && (
                          <Badge
                            variant="outline"
                            size="lg"
                            className="truncate max-w-[200px]"
                          >
                            {job.source}
                          </Badge>
                        )}
                        {job.applyType === "ats" && (
                          <Badge
                            variant="success"
                            size="lg"
                            icon={<MousePointerClick className="h-3 w-3" />}
                          >
                            Easy Apply
                          </Badge>
                        )}
                        {job.salary && (
                          <Badge
                            variant="info"
                            size="lg"
                            icon={<DollarSign className="h-3 w-3" />}
                          >
                            {job.salary}
                          </Badge>
                        )}
                        {savedAt && (
                          <Badge variant="secondary" size="lg">
                            Saved {savedAt}
                          </Badge>
                        )}
                      </div>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-start gap-1.5 text-base font-semibold leading-snug hover:text-primary"
                      >
                        {job.title}
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                      </a>
                      {(job.company || job.publishedDate) && (
                        <p className="text-[13px] text-muted-foreground">
                          {[job.company, job.publishedDate]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-[11px]"
                              onRemove={() => removeTag(job.id, tag)}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {editingNotes === job.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={notesDraft}
                            onChange={(e) => setNotesDraft(e.target.value)}
                            placeholder="Add notes..."
                            className="min-h-[60px] text-sm"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveNotes(job.id)}>
                              <Save className="w-3 h-3 mr-1" /> Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingNotes(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : job.notes ? (
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => {
                            setEditingNotes(job.id);
                            setNotesDraft(job.notes ?? "");
                          }}
                        >
                          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="line-clamp-2">{job.notes}</span>
                        </button>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!job.notes && !editingNotes && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingNotes(job.id);
                            setNotesDraft("");
                          }}
                        >
                          <Save className="w-3.5 h-3.5 mr-1" /> Notes
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteJob(job.id)}
                        aria-label={`Remove saved job ${job.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card padding="sm" className="bg-surface-1">
      <CardContent className="p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
          {label}
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
