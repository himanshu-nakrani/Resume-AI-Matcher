import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, Trash2, ExternalLink, Search, X, MousePointerClick, DollarSign, Save } from "lucide-react";

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

type ApiErrorPayload = {
  error?: string | { message?: string };
  message?: string;
};

function apiErrorMessage(payload: ApiErrorPayload | null, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload.error === "string") return payload.error;
  if (payload.error?.message) return payload.error.message;
  if (payload.message) return payload.message;
  return fallback;
}

export function SavedJobsPage() {
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
      const data = await res.json().catch(() => null) as SavedJob[] | ApiErrorPayload | null;
      if (!res.ok) {
        throw new Error(apiErrorMessage(data as ApiErrorPayload | null, "Could not load saved jobs."));
      }
      setSavedJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({
        title: "Could not load saved jobs",
        description: err instanceof Error ? err.message : "Try again in a moment.",
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
        const data = await res.json().catch(() => null) as ApiErrorPayload | null;
        throw new Error(apiErrorMessage(data, "Could not remove this job."));
      }
      setSavedJobs((prev) => prev.filter((j) => j.id !== id));
      toast({ title: "Job removed" });
    } catch (err) {
      toast({
        title: "Could not remove job",
        description: err instanceof Error ? err.message : "Try again in a moment.",
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
        const data = await res.json().catch(() => null) as ApiErrorPayload | null;
        throw new Error(apiErrorMessage(data, "Could not save notes."));
      }
      setSavedJobs((prev) => prev.map((j) => (j.id === id ? { ...j, notes: notesDraft } : j)));
      setEditingNotes(null);
      toast({ title: "Notes saved" });
    } catch (err) {
      toast({
        title: "Could not save notes",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const removeTag = async (id: number, tag: string) => {
    const job = savedJobs.find((j) => j.id === id);
    if (!job) return;
    const newTags = job.tags.filter((t) => t !== tag);
    try {
      const res = await fetch(`/api/saved-jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as ApiErrorPayload | null;
        throw new Error(apiErrorMessage(data, "Could not remove tag."));
      }
      setSavedJobs((prev) => prev.map((j) => (j.id === id ? { ...j, tags: newTags } : j)));
    } catch (err) {
      toast({
        title: "Could not remove tag",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const filtered = savedJobs.filter((j) =>
    !searchTerm || j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (j.company ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (j.source ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-muted p-3">
            <Bookmark className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Saved Jobs</h1>
            <p className="text-muted-foreground text-lg mt-1">
              <Badge variant="secondary" className="mr-2">{savedJobs.length}</Badge>
              bookmarked listings
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by title, company, or source..."
            className="pl-12 h-12 text-base rounded-xl border-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bookmark className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{searchTerm ? "No matches" : "No saved jobs yet"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchTerm ? "Try a different search term" : "Save jobs from search results to track them here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <Card key={job.id} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {job.source && <Badge variant="outline" className="truncate max-w-[200px]">{job.source}</Badge>}
                      {job.applyType === "ats" && (
                        <Badge variant="secondary" className="text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                          <MousePointerClick className="w-3 h-3 mr-1" /> Easy Apply
                        </Badge>
                      )}
                      {job.salary && (
                        <Badge variant="secondary" className="text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                          <DollarSign className="w-3 h-3 mr-1" /> {job.salary}
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
                    {job.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {job.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[11px] gap-1 cursor-pointer" onClick={() => removeTag(job.id, tag)}>
                            {tag} <X className="w-2.5 h-2.5" />
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
                          <Button size="sm" onClick={() => saveNotes(job.id)}><Save className="w-3 h-3 mr-1" /> Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : job.notes ? (
                      <p className="text-sm text-muted-foreground line-clamp-2 cursor-pointer" onClick={() => { setEditingNotes(job.id); setNotesDraft(job.notes ?? ""); }}>{job.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!job.notes && !editingNotes && (
                      <Button size="sm" variant="ghost" onClick={() => { setEditingNotes(job.id); setNotesDraft(""); }}>
                        <Save className="w-3.5 h-3.5 mr-1" /> Notes
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteJob(job.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
