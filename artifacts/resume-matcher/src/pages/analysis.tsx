import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetAnalysis,
  getGetAnalysisQueryKey,
  useGenerateCoverLetter,
  useGenerateLinkedinPost,
  useDeleteAnalysis,
  useRewriteBullet,
  useUpdateAnalysis,
  useShareAnalysis,
  useUnshareAnalysis,
  useDuplicateAnalysis,
  useListAnalyses,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScoreCircle } from "@/components/score-circle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DEEPSEEK_KEY_STORAGE_KEY } from "@/lib/deepseek-storage";
import { useCopy } from "@/hooks/use-copy";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  Copy,
  Check,
  FileText,
  Linkedin,
  Trash2,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Wand2,
  ArrowRightLeft,
  Sparkles,
  ClipboardCheck,
  Download,
  Heart,
  Share2,
  Link2,
  ExternalLink,
  EyeOff,
  StickyNote,
  CalendarClock,
  User,
  Mail,
  Tag,
  DollarSign,
  GitCompareArrows,
  X,
  Plus,
  Building2,
  Calendar,
  Send,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type CoverLetterTone = "professional" | "friendly" | "enthusiastic" | "concise";

const TONE_OPTIONS: { value: CoverLetterTone; label: string; desc: string }[] = [
  { value: "professional", label: "Professional", desc: "Formal & polished" },
  { value: "friendly", label: "Friendly", desc: "Warm & personable" },
  { value: "enthusiastic", label: "Enthusiastic", desc: "Energetic & passionate" },
  { value: "concise", label: "Concise", desc: "Brief & to the point" },
];

function downloadICS(data: {
  id: number;
  jobTitle: string;
  companyName: string | null;
  deadline: string | null;
  followUpDate: string | null;
}) {
  const events: string[] = [];
  const toICSDate = (s: string) => s.replace(/-/g, "");
  const title = data.jobTitle + (data.companyName ? " @ " + data.companyName : "");

  if (data.deadline) {
    const d = toICSDate(data.deadline);
    events.push([
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:" + d,
      "DTEND;VALUE=DATE:" + d,
      "SUMMARY:Application Deadline: " + title,
      "DESCRIPTION:Job application deadline. Track it in OptiMatch.",
      "UID:deadline-" + data.id + "-" + d + "@optimatch",
      "END:VEVENT",
    ].join("\r\n"));
  }

  if (data.followUpDate) {
    const d = toICSDate(data.followUpDate);
    events.push([
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:" + d,
      "DTEND;VALUE=DATE:" + d,
      "SUMMARY:Follow-up: " + title,
      "DESCRIPTION:Follow-up on this job application. Track it in OptiMatch.",
      "UID:followup-" + data.id + "-" + d + "@optimatch",
      "END:VEVENT",
    ].join("\r\n"));
  }

  if (events.length === 0) return;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OptiMatch//AI Career Intelligence//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "optimatch-" + data.jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + ".ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadTextFile(content: string, fileName: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  downloadBlob(blob, fileName);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeFileName(parts: Array<string | null | undefined>, extension: string) {
  const base = parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base || "optimized-resume"}.${extension}`;
}

function filenameFromDisposition(value: string | null): string | null {
  const match = value?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

// --- Job Tracking Section ---
function JobTrackingSection({ analysisId, analysis }: {
  analysisId: number;
  analysis: {
    deadline: string | null;
    contactName: string | null;
    contactEmail: string | null;
    followUpDate: string | null;
    tags: string[] | null;
    portfolioLinks: string[] | null;
    jobTitle: string;
    companyName: string | null;
    versionLabel: string | null;
    location: string | null;
    salaryExpectation: string | null;
  };
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [linkInput, setLinkInput] = useState("");

  const { data: allAnalyses } = useListAnalyses();

  const allExistingTags = Array.from(new Set(
    (allAnalyses ?? []).flatMap((a) => (a.tags as string[]) ?? [])
  )).filter((t) => !(analysis.tags ?? []).includes(t));

  const suggestions = tagInput.trim()
    ? allExistingTags.filter((t) => t.toLowerCase().includes(tagInput.toLowerCase()))
    : allExistingTags.slice(0, 6);

  const update = useUpdateAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) }),
      onError: () => toast({ title: "Save failed", variant: "destructive" }),
    },
  });

  const save = useCallback((field: string, value: string | string[]) => {
    update.mutate({ id: analysisId, data: { [field]: value } });
  }, [analysisId, update]);

  const tags = (analysis.tags as string[]) ?? [];
  const portfolioLinks = (analysis.portfolioLinks as string[]) ?? [];

  const addTag = (t?: string) => {
    const tag = (t ?? tagInput).trim();
    if (!tag || tags.includes(tag)) { setTagInput(""); setShowSuggestions(false); return; }
    save("tags", [...tags, tag]);
    setTagInput("");
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    save("tags", tags.filter((t) => t !== tag));
  };

  const addLink = () => {
    const link = linkInput.trim();
    if (!link || portfolioLinks.includes(link)) { setLinkInput(""); return; }
    if (portfolioLinks.length >= 3) {
      toast({ title: "Maximum 3 links allowed", variant: "destructive" });
      return;
    }
    save("portfolioLinks", [...portfolioLinks, link]);
    setLinkInput("");
  };

  const removeLink = (link: string) => {
    save("portfolioLinks", portfolioLinks.filter((l) => l !== link));
  };

  const emailLink = analysis.contactEmail
    ? "mailto:" + analysis.contactEmail + "?subject=Re: " + encodeURIComponent("Application inquiry")
    : null;

  const canExportICS = !!(analysis.deadline || analysis.followUpDate);

  return (
    <Card className="border shadow-sm no-print">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-orange-500" /> Job Tracking
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track deadlines, contacts, and follow-ups for this application.
          </p>
        </div>
        {canExportICS && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 no-print"
            onClick={() => downloadICS({
              id: analysisId,
              jobTitle: analysis.jobTitle,
              companyName: analysis.companyName,
              deadline: analysis.deadline,
              followUpDate: analysis.followUpDate,
            })}
          >
            <Calendar className="w-3.5 h-3.5" />
            Export to Calendar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" /> Application Deadline
            </label>
            <Input
              type="date"
              defaultValue={analysis.deadline ?? ""}
              onBlur={(e) => save("deadline", e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" /> Follow-up Date
            </label>
            <Input
              type="date"
              defaultValue={analysis.followUpDate ?? ""}
              onBlur={(e) => save("followUpDate", e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Contact Name
            </label>
            <Input
              type="text"
              placeholder="Recruiter or hiring manager..."
              defaultValue={analysis.contactName ?? ""}
              onBlur={(e) => save("contactName", e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Contact Email
            </label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@company.com..."
                defaultValue={analysis.contactEmail ?? ""}
                onBlur={(e) => save("contactEmail", e.target.value)}
                className="text-sm flex-1"
              />
              {emailLink && (
                <a href={emailLink} target="_blank" rel="noreferrer" className="shrink-0">
                  <Button variant="outline" size="sm" type="button">
                    <Mail className="w-3.5 h-3.5 mr-1" /> Email
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Portfolio & Project Links
          </label>
          <div className="flex flex-wrap gap-2 min-h-[28px]">
            {portfolioLinks.map((link) => (
              <div key={link} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-muted border group">
                <a
                  href={link.startsWith("http") ? link : `https://${link}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-primary transition-colors max-w-[200px] truncate"
                >
                  <ExternalLink className="w-3 h-3" />
                  {link.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
                <button
                  onClick={() => removeLink(link)}
                  className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add GitHub, portfolio, or case study URL..."
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addLink(); }
              }}
              className="text-sm flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addLink}
              disabled={!linkInput.trim() || portfolioLinks.length >= 3}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Up to 3 relevant links for this application.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> Tags
          </label>
          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                {tag}
                <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag (e.g. remote, fintech, senior)..."
                value={tagInput}
                onChange={(e) => { setTagInput(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(); }
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
                className="text-sm flex-1"
              />
              <Button variant="outline" size="sm" onClick={() => addTag()} disabled={!tagInput.trim()}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 z-50 mt-1 w-full bg-card border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                {tagInput.trim() === "" && (
                  <p className="text-xs text-muted-foreground px-3 py-1.5">Tags from your other analyses:</p>
                )}
                {suggestions.map((t) => (
                  <button
                    key={t}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors flex items-center gap-2"
                    onMouseDown={() => addTag(t)}
                  >
                    <Tag className="w-3 h-3 text-muted-foreground" />
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Version Label, Location, Salary Expectation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Version Label
            </label>
            <Input
              type="text"
              placeholder="e.g. v1, tailored, senior..."
              defaultValue={analysis.versionLabel ?? ""}
              onBlur={(e) => save("versionLabel", e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Job Location
            </label>
            <Input
              type="text"
              placeholder="e.g. Remote, New York, Hybrid..."
              defaultValue={analysis.location ?? ""}
              onBlur={(e) => save("location", e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Salary Expectation
            </label>
            <Input
              type="text"
              placeholder="e.g. $120k–$150k..."
              defaultValue={analysis.salaryExpectation ?? ""}
              onBlur={(e) => save("salaryExpectation", e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        {(analysis.deadline || analysis.followUpDate) && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {analysis.deadline && (
              <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 font-medium">
                <CalendarClock className="w-3.5 h-3.5" />
                Deadline: {format(new Date(analysis.deadline), "MMM d, yyyy")}
              </div>
            )}
            {analysis.followUpDate && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
                <CalendarClock className="w-3.5 h-3.5" />
                Follow-up: {format(new Date(analysis.followUpDate), "MMM d, yyyy")}
              </div>
            )}
            {/* Phase 21 — Email Reminder */}
            {analysis.contactEmail && (analysis.deadline || analysis.followUpDate) && (
              <a
                href={"mailto:" + analysis.contactEmail + "?subject=" + encodeURIComponent("Following up: " + analysis.jobTitle + (analysis.companyName ? " at " + analysis.companyName : "")) + "&body=" + encodeURIComponent("Hi,\n\nI wanted to follow up regarding my application for the " + analysis.jobTitle + " position" + (analysis.companyName ? " at " + analysis.companyName : "") + ".\n\nPlease let me know if you need anything further from my side.\n\nBest regards,\n[Your Name]")}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 ml-auto"
              >
                <Button variant="outline" size="sm" type="button" className="gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Email Reminder
                </Button>
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Bullet Rewriter ---
function BulletRewriter({ analysisId }: { analysisId: number }) {
  const [bulletText, setBulletText] = useState("");
  const [result, setResult] = useState<{ original: string; rewritten: string } | null>(null);
  const { copy, isCopied } = useCopy();

  const rewrite = useRewriteBullet({
    mutation: { onSuccess: (data) => setResult(data) },
  });

  return (
    <Card className="border shadow-sm print-break-inside-avoid">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-muted-foreground" /> AI Bullet Rewriter
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-0.5">
          Paste any resume bullet to make it stronger and more ATS-friendly.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Managed a team and improved performance..."
            value={bulletText}
            onChange={(e) => setBulletText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && bulletText.trim()) {
                rewrite.mutate({ id: analysisId, data: { bulletText } });
              }
            }}
            data-testid="input-bullet"
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => rewrite.mutate({ id: analysisId, data: { bulletText } })}
            disabled={rewrite.isPending || !bulletText.trim()}
            data-testid="button-rewrite-bullet"
            className="no-print"
          >
            {rewrite.isPending ? (
              <><Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Rewriting...</>
            ) : (
              <><ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />Rewrite</>
            )}
          </Button>
        </div>

        {result && (
          <div className="space-y-3 pt-2">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Original</p>
              <p className="line-through text-muted-foreground">{result.original}</p>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">Rewritten</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green-700 dark:text-green-400 no-print"
                  onClick={() => copy(result.rewritten, "Bullet copied")}
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p className="font-medium text-green-800 dark:text-green-300">{result.rewritten}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground no-print"
              onClick={() => { setBulletText(result.original); setResult(null); }}
            >
              Try another bullet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Notes ---
function NotesSection({ analysisId, initialNotes }: { analysisId: number; initialNotes: string | null }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const update = useUpdateAnalysis({
    mutation: {
      onSuccess: () => {
        setIsDirty(false);
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
      },
      onError: () => toast({ title: "Could not save notes", variant: "destructive" }),
    },
  });

  const handleChange = (value: string) => {
    setNotes(value);
    setIsDirty(true);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      update.mutate({ id: analysisId, data: { notes: value } });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
  }, []);

  return (
    <Card className="border shadow-sm no-print">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-yellow-500" /> Notes
        </CardTitle>
        <span className={`text-xs transition-opacity ${isDirty || update.isPending ? "opacity-100 text-muted-foreground" : "opacity-0"}`}>
          {update.isPending ? "Saving..." : "Unsaved changes"}
        </span>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Add private notes about this role, follow-ups, contacts, deadlines..."
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          className="min-h-[120px] text-sm resize-none bg-muted/30"
          data-testid="textarea-notes"
        />
      </CardContent>
    </Card>
  );
}

// --- Share Section ---
function ShareSection({ analysisId, isPublic, shareToken }: { analysisId: number; isPublic: boolean; shareToken: string | null }) {
  const queryClient = useQueryClient();
  const { copy, isCopied } = useCopy();
  const { toast } = useToast();

  const share = useShareAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
        copy(data.shareUrl, "Share link copied!");
        toast({ title: "Share link copied!", description: "Anyone with the link can view this analysis." });
      },
    },
  });

  const unshare = useUnshareAnalysis({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
        toast({ title: "Link disabled", description: "This analysis is no longer public." });
      },
    },
  });

  const buildShareUrl = () => {
    if (!shareToken) return "";
    const base = window.location.origin + (import.meta.env.BASE_URL?.replace(/\/$/, "") || "");
    return base + "/share/" + shareToken;
  };

  if (isPublic && shareToken) {
    const url = buildShareUrl();
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border no-print">
        <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">Shared publicly</p>
          <p className="text-xs text-muted-foreground truncate">{url}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => copy(url, "Link copied!")}
        >
          {isCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
          Copy
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground"
          onClick={() => unshare.mutate({ id: analysisId })}
          disabled={unshare.isPending}
        >
          <EyeOff className="w-3.5 h-3.5 mr-1" />
          Disable
        </Button>
        <a
          href={`mailto:?subject=${encodeURIComponent("Check out my resume analysis")}&body=${encodeURIComponent("I ran an AI analysis of my resume for a " + "job. Here's the result: " + url)}`}
          className="shrink-0"
        >
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Mail className="w-3.5 h-3.5 mr-1" />
            Email
          </Button>
        </a>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="no-print"
      onClick={() => share.mutate({ id: analysisId })}
      disabled={share.isPending}
      data-testid="button-share"
    >
      {share.isPending ? (
        <><Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Creating link...</>
      ) : (
        <><Share2 className="w-3.5 h-3.5 mr-1.5" />Share</>
      )}
    </Button>
  );
}

// --- Interview Checklist ---
const CHECKLIST_ITEMS = [
  "Research the company's products, mission, and recent news",
  "Review the job description and prepare examples for each key requirement",
  "Prepare 3–5 STAR-format behavioral stories using the STAR Helper above",
  "Prepare 5 thoughtful questions to ask the interviewer",
  "Review your resume — be ready to walk through every bullet point",
  "Research the typical salary range for this role and location",
  "Confirm logistics: time zone, video link or office address, dress code",
  "Prepare your workspace / outfit and test your tech (camera, mic, internet)",
  "Get a good night's sleep and eat a proper meal before the interview",
  "Send a thank-you email within 24 hours after the interview",
];

function InterviewChecklist({ analysisId }: { analysisId: number }) {
  const storageKey = "optimatch_checklist_" + analysisId;
  const [checked, setChecked] = useState<Record<number, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? "{}"); } catch { return {}; }
  });

  const toggle = (i: number) => {
    const updated = { ...checked, [i]: !checked[i] };
    setChecked(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const completedCount = Object.values(checked).filter(Boolean).length;
  const pct = Math.round((completedCount / CHECKLIST_ITEMS.length) * 100);

  return (
    <Card className="border shadow-sm no-print">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-teal-500" /> Interview Checklist
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pre-interview prep tasks. Progress is saved in your browser.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2.5 py-1">
            {completedCount}/{CHECKLIST_ITEMS.length} complete
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-primary"}`}
            style={{ width: pct + "%" }}
          />
        </div>
        {CHECKLIST_ITEMS.map((item, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-all ${checked[i] ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/40 hover:bg-muted/60"}`}
          >
            <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checked[i] ? "bg-green-500 border-green-500" : "border-muted-foreground/40"}`}>
              {checked[i] && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            <span className={`text-sm ${checked[i] ? "line-through text-muted-foreground" : ""}`}>{item}</span>
          </button>
        ))}
        {pct === 100 && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-semibold pt-2 px-1">
            <CheckCircle2 className="w-4 h-4" />
            All done — you're ready for this interview!
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Main Analysis Page ---
export function Analysis() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { copy, isCopied } = useCopy();
  const { toast } = useToast();
  const [coverLetterTone, setCoverLetterTone] = useState<CoverLetterTone>("professional");
  const [coverLetterVariation, setCoverLetterVariation] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const { data: analysis, isLoading } = useGetAnalysis(id, {
    query: { enabled: !!id, queryKey: getGetAnalysisQueryKey(id) },
  });

  const generateCoverLetter = useGenerateCoverLetter({
    mutation: {
      onSuccess: (data) => {
        // If we want to persist the first generation but not the second, 
        // we'd need a separate hook or more complex logic.
        // For simplicity, let's just update the main one, but if we're generating a variation 
        // we'll store it in local state.
        if (generateCoverLetter.variables?.data?.tone !== coverLetterTone) {
          setCoverLetterVariation(data.content);
        } else {
          queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
        }
      },
    },
  });

  const generateVariation = () => {
    // Cycle tone for variation
    const currentIndex = TONE_OPTIONS.findIndex(t => t.value === coverLetterTone);
    const nextTone = TONE_OPTIONS[(currentIndex + 1) % TONE_OPTIONS.length].value;
    generateCoverLetter.mutate({ 
      id, 
      data: { tone: nextTone } 
    });
  };

  const generateLinkedinPost = useGenerateLinkedinPost({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) }),
    },
  });

  const deleteAnalysis = useDeleteAnalysis({
    mutation: { onSuccess: () => setLocation("/") },
  });

  const updateAnalysis = useUpdateAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) }),
    },
  });

  const duplicateAnalysis = useDuplicateAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
        toast({ title: "Analysis duplicated", description: "Opening the copy now." });
        setLocation(`/analysis/${data.id}`);
      },
    },
  });

  const downloadOptimizedPdf = async () => {
    if (!analysis?.optimizedLatex) {
      toast({
        title: "PDF unavailable",
        description: "This analysis does not have optimized LaTeX to compile.",
        variant: "destructive",
      });
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const deepseekKey = localStorage.getItem(DEEPSEEK_KEY_STORAGE_KEY)?.trim();
      const response = await fetch(`/api/analyses/${id}/resume.pdf`, {
        headers: {
          Accept: "application/pdf, application/json",
          ...(deepseekKey ? { "X-DeepSeek-Api-Key": deepseekKey } : {}),
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not compile optimized resume PDF.");
      }

      const blob = await response.blob();
      const fileName =
        filenameFromDisposition(response.headers.get("content-disposition")) ??
        safeFileName([analysis.companyName, analysis.jobTitle], "pdf");
      downloadBlob(blob, fileName);
      toast({ title: "PDF downloaded", description: "Validated by AI, then compiled from optimized LaTeX." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not compile optimized resume PDF.";
      toast({
        title: "Could not download PDF",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Analysis not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/")}>
          Go back
        </Button>
      </div>
    );
  }

  const strengths = (analysis.strengths as string[]) ?? [];
  const gaps = (analysis.gaps as string[]) ?? [];
  const improvements = (analysis.improvements as string[]) ?? [];
  const atsMatched = (analysis.atsKeywordsMatched as string[]) ?? [];
  const atsMissing = (analysis.atsKeywordsMissing as string[]) ?? [];
  const optimizedLatex = (analysis as any).optimizedLatex as string | null ?? null;

  return (
    <div className="space-y-8 print-full-width" data-testid={`analysis-${id}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors no-print"
            data-testid="button-back"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <h1 className="text-2xl font-bold tracking-tight">{analysis.jobTitle}</h1>
          {analysis.companyName && (
            <p className="text-muted-foreground mt-0.5">{analysis.companyName}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
          </p>
          {/* Tracking summary chips */}
          <div className="flex flex-wrap gap-2 mt-2">
            {analysis.deadline && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400">
                <CalendarClock className="w-3 h-3" />
                Due {format(new Date(analysis.deadline), "MMM d")}
              </span>
            )}
            {analysis.followUpDate && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                <CalendarClock className="w-3 h-3" />
                Follow-up {format(new Date(analysis.followUpDate), "MMM d")}
              </span>
            )}
            {Array.isArray(analysis.tags) && (analysis.tags as string[]).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Favorite toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={`no-print gap-1.5 ${analysis.isFavorite ? "text-pink-500" : "text-muted-foreground"}`}
            onClick={() => updateAnalysis.mutate({ id, data: { isFavorite: !analysis.isFavorite } })}
            data-testid="button-favorite"
          >
            <Heart className={`w-4 h-4 ${analysis.isFavorite ? "fill-pink-500" : ""}`} />
            {analysis.isFavorite ? "Favorited" : "Favorite"}
          </Button>

          <ShareSection
            analysisId={id}
            isPublic={analysis.isPublic ?? false}
            shareToken={analysis.shareToken ?? null}
          />

          <Button
            variant="outline"
            size="sm"
            className="no-print"
            onClick={() => duplicateAnalysis.mutate({ id })}
            disabled={duplicateAnalysis.isPending}
            title="Duplicate this analysis"
          >
            <GitCompareArrows className="w-3.5 h-3.5 mr-1.5" />
            Duplicate
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="no-print"
            onClick={downloadOptimizedPdf}
            disabled={isDownloadingPdf || !optimizedLatex}
            data-testid="button-export-pdf"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {isDownloadingPdf ? "Validating..." : "Download PDF"}
          </Button>
          {optimizedLatex && (
            <Button
              variant="outline"
              size="sm"
              className="no-print"
              onClick={() => downloadTextFile(
                optimizedLatex,
                `${analysis.companyName ?? "company"}-${analysis.jobTitle}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".tex",
              )}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Download LaTeX
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive no-print"
            onClick={() => deleteAnalysis.mutate({ id })}
            disabled={deleteAnalysis.isPending}
            data-testid="button-delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {optimizedLatex && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Optimized Resume LaTeX
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                This is the AI-tailored LaTeX resume for {analysis.companyName ?? "this company"} and {analysis.jobTitle}.
              </p>
            </div>
            <div className="flex gap-2 no-print">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(optimizedLatex, "Optimized LaTeX copied")}
              >
                {isCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                Copy
              </Button>
              <Button
                size="sm"
                onClick={() => downloadTextFile(
                  optimizedLatex,
                  `${analysis.companyName ?? "company"}-${analysis.jobTitle}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".tex",
                )}
              >
                Download LaTeX
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={optimizedLatex}
              readOnly
              className="min-h-[360px] font-mono text-xs resize-none bg-muted/30"
            />
            <p className="text-xs text-muted-foreground mt-3 no-print">
              Download PDF validates and repairs this optimized LaTeX with AI, then compiles it on the API server.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="pt-6 flex flex-col items-center gap-2 pb-6">
            <ScoreCircle score={analysis.fitScore} size="lg" label="Fit Score" />
            <p className="text-sm text-muted-foreground text-center max-w-xs mt-2">{analysis.fitRationale}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="pt-6 flex flex-col items-center gap-2 pb-6">
            <ScoreCircle score={analysis.atsScore} size="lg" label="ATS Score" />
            <p className="text-sm text-muted-foreground text-center max-w-xs mt-2">
              How well your resume passes automated applicant tracking systems.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Strengths & Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Strengths
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">No strengths identified.</p>
            ) : (
              strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm" data-testid={`strength-${i}`}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" /> Gaps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No critical gaps identified.</p>
            ) : (
              gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-sm" data-testid={`gap-${i}`}>
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                  <span>{g}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Improvements */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-500" /> Resume Improvements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {improvements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No improvement suggestions.</p>
          ) : (
            improvements.map((imp, i) => (
              <div key={i} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-muted/50" data-testid={`improvement-${i}`}>
                <ChevronRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <span>{imp}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ATS Keywords */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ATS Keywords</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-200 mb-2">Matched</p>
            <div className="flex flex-wrap gap-2">
              {atsMatched.length === 0 ? (
                <p className="text-sm text-muted-foreground">None matched</p>
              ) : (
                atsMatched.map((kw, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="border-emerald-300 bg-emerald-50 text-emerald-950 shadow-none dark:border-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-50"
                    data-testid={`keyword-matched-${i}`}
                  >
                    {kw}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-200 mb-2">Missing</p>
            <div className="flex flex-wrap gap-2">
              {atsMissing.length === 0 ? (
                <p className="text-sm text-muted-foreground">No missing keywords</p>
              ) : (
                atsMissing.map((kw, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="border-rose-300 bg-rose-50 text-rose-950 shadow-none dark:border-rose-600 dark:bg-rose-950/45 dark:text-rose-50"
                    data-testid={`keyword-missing-${i}`}
                  >
                    {kw}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Tracking */}
      <JobTrackingSection
        analysisId={id}
        analysis={{
          deadline: analysis.deadline ?? null,
          contactName: analysis.contactName ?? null,
          contactEmail: analysis.contactEmail ?? null,
          followUpDate: analysis.followUpDate ?? null,
          tags: (analysis.tags as string[]) ?? [],
          portfolioLinks: (analysis.portfolioLinks as string[]) ?? [],
          jobTitle: analysis.jobTitle,
          companyName: analysis.companyName ?? null,
          versionLabel: (analysis as any).versionLabel ?? null,
          location: (analysis as any).location ?? null,
          salaryExpectation: (analysis as any).salaryExpectation ?? null,
        }}
      />

      {/* Interview Checklist */}
      <InterviewChecklist analysisId={id} />

      {/* Notes */}
      <NotesSection analysisId={id} initialNotes={analysis.notes ?? null} />

      {/* AI Bullet Rewriter */}
      <BulletRewriter analysisId={id} />

      {/* Cover Letter */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Tailored Cover Letter
            </CardTitle>
            <div className="flex gap-2 no-print">
              {analysis.coverLetter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(analysis.coverLetter!, "Cover letter copied")}
                  data-testid="button-copy-cover-letter"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  Copy
                </Button>
              )}
              <Button
                size="sm"
                variant={analysis.coverLetter ? "outline" : "default"}
                onClick={() => generateCoverLetter.mutate({ id, data: { tone: coverLetterTone } })}
                disabled={generateCoverLetter.isPending}
                data-testid="button-generate-cover-letter"
              >
                {generateCoverLetter.isPending ? "Generating..." : analysis.coverLetter ? "Regenerate" : "Generate"}
              </Button>
            </div>
          </div>
          <div className="mt-3 no-print">
            <p className="text-xs font-medium text-muted-foreground mb-2">Tone</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TONE_OPTIONS.map((tone) => (
                <button
                  key={tone.value}
                  onClick={() => setCoverLetterTone(tone.value)}
                  className={`rounded-lg border px-3 py-2 text-left transition-all ${
                    coverLetterTone === tone.value
                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                      : "border-muted hover:border-muted-foreground/30 bg-transparent"
                  }`}
                  data-testid={`tone-${tone.value}`}
                >
                  <p className={`text-xs font-semibold ${coverLetterTone === tone.value ? "text-primary" : ""}`}>
                    {tone.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tone.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {generateCoverLetter.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : analysis.coverLetter ? (
            <>
              <Textarea
                value={analysis.coverLetter}
                readOnly
                className="min-h-[300px] font-mono text-sm resize-none bg-muted/30"
                data-testid="textarea-cover-letter"
              />
              
              <div className="pt-2 flex flex-col gap-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full sm:w-auto"
                  onClick={generateVariation}
                  disabled={generateCoverLetter.isPending}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-2" />
                  Generate 2nd Variation
                </Button>

                {coverLetterVariation && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Wand2 className="w-3 h-3" /> Alternative Variation
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => copy(coverLetterVariation, "Variation copied")}
                      >
                        {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        Copy Variation
                      </Button>
                    </div>
                    <Textarea
                      value={coverLetterVariation}
                      readOnly
                      className="min-h-[300px] font-mono text-sm resize-none bg-primary/5 border-primary/20"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Select a tone above, then click "Generate" to create a tailored cover letter.
            </p>
          )}
        </CardContent>
      </Card>

      {/* LinkedIn Post */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Linkedin className="w-4 h-4 text-[#0077b5]" /> LinkedIn Post
          </CardTitle>
          <div className="flex gap-2 no-print">
            {analysis.linkedinPost && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(analysis.linkedinPost!, "LinkedIn post copied")}
                data-testid="button-copy-linkedin"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                Copy
              </Button>
            )}
            <Button
              size="sm"
              variant={analysis.linkedinPost ? "outline" : "default"}
              onClick={() => generateLinkedinPost.mutate({ id })}
              disabled={generateLinkedinPost.isPending}
              data-testid="button-generate-linkedin"
            >
              {generateLinkedinPost.isPending ? "Generating..." : analysis.linkedinPost ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {generateLinkedinPost.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : analysis.linkedinPost ? (
            <Textarea
              value={analysis.linkedinPost}
              readOnly
              className="min-h-[180px] text-sm resize-none bg-muted/30"
              data-testid="textarea-linkedin"
            />
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Click "Generate" to create a LinkedIn post announcing your job search.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
