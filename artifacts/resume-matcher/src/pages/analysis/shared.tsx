import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAnalysisQueryKey,
  useUpdateAnalysis,
  useRewriteBullet,
  useShareAnalysis,
  useUnshareAnalysis,
  useListAnalyses,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCopy } from "@/hooks/use-copy";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, CalendarClock, User, Mail, Tag, DollarSign, Link2, X, Plus, Building2,
  Wand2, ArrowRightLeft, Sparkles, ClipboardCheck, StickyNote, Share2, Copy, Check,
  ExternalLink, EyeOff, Send, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";

// Cover Letter tone — type + options
export type CoverLetterTone = "professional" | "friendly" | "enthusiastic" | "concise";
export const TONE_OPTIONS: { value: CoverLetterTone; label: string; desc: string }[] = [
  { value: "professional", label: "Professional", desc: "Formal & polished" },
  { value: "friendly", label: "Friendly", desc: "Warm & personable" },
  { value: "enthusiastic", label: "Enthusiastic", desc: "Energetic & passionate" },
  { value: "concise", label: "Concise", desc: "Brief & to the point" },
];

// Interview checklist constants
export const CHECKLIST_ITEMS = [
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

// Helper used by JobTrackingSection
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

// === Inner components ===

export function JobTrackingSection({ analysisId, analysis }: {
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

export function BulletRewriter({ analysisId }: { analysisId: number }) {
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

export function NotesSection({ analysisId, initialNotes }: { analysisId: number; initialNotes: string | null }) {
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

export function ShareSection({ analysisId, isPublic, shareToken }: { analysisId: number; isPublic: boolean; shareToken: string | null }) {
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

export function InterviewChecklist({ analysisId }: { analysisId: number }) {
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
