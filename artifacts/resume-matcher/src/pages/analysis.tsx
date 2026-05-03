import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetAnalysis,
  getGetAnalysisQueryKey,
  useGenerateCoverLetter,
  useGenerateLinkedinPost,
  useDeleteAnalysis,
  useRewriteBullet,
  useGenerateInterviewQuestions,
  useGenerateLearningPlan,
  useUpdateAnalysis,
  useShareAnalysis,
  useUnshareAnalysis,
  useDuplicateAnalysis,
  useGenerateSalaryGuide,
  useListAnalyses,
  useGenerateCompanyResearch,
  useDetectRedFlags,
  useSimulateNegotiation,
  useGenerateStarAnswer,
} from "@workspace/api-client-react";
import type { LearningPlanItem, LearningResource } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScoreCircle } from "@/components/score-circle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  MessageSquare,
  Sparkles,
  GraduationCap,
  BookOpen,
  Award,
  Hammer,
  BookMarked,
  Printer,
  Heart,
  Share2,
  Link2,
  EyeOff,
  StickyNote,
  CalendarClock,
  User,
  Mail,
  Tag,
  DollarSign,
  TrendingUp,
  GitCompareArrows,
  X,
  Plus,
  Building2,
  AlertTriangle,
  Bot,
  ClipboardCheck,
  Calendar,
  Send,
  Shield,
  Star,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type CoverLetterTone = "professional" | "friendly" | "enthusiastic" | "concise";

const TONE_OPTIONS: { value: CoverLetterTone; label: string; desc: string }[] = [
  { value: "professional", label: "Professional", desc: "Formal & polished" },
  { value: "friendly", label: "Friendly", desc: "Warm & personable" },
  { value: "enthusiastic", label: "Enthusiastic", desc: "Energetic & passionate" },
  { value: "concise", label: "Concise", desc: "Brief & to the point" },
];

const PRIORITY_CONFIG = {
  high: { label: "High Priority", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
};

function resourceTypeIcon(type: LearningResource["type"]) {
  switch (type) {
    case "course": return <BookOpen className="w-3.5 h-3.5" />;
    case "certification": return <Award className="w-3.5 h-3.5" />;
    case "project": return <Hammer className="w-3.5 h-3.5" />;
    case "book": return <BookMarked className="w-3.5 h-3.5" />;
    case "article": return <FileText className="w-3.5 h-3.5" />;
    default: return <BookOpen className="w-3.5 h-3.5" />;
  }
}

function formatSalary(n: number) {
  if (n >= 1000) return "$" + Math.round(n / 1000) + "k";
  return "$" + n;
}

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

// --- Job Tracking Section ---
function JobTrackingSection({ analysisId, analysis }: {
  analysisId: number;
  analysis: {
    deadline: string | null;
    contactName: string | null;
    contactEmail: string | null;
    followUpDate: string | null;
    tags: string[] | null;
    jobTitle: string;
    companyName: string | null;
  };
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

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

        {(analysis.deadline || analysis.followUpDate) && (
          <div className="flex flex-wrap gap-3 pt-1">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Salary Guide ---
function SalaryGuideSection({ analysisId, existing }: {
  analysisId: number;
  existing: {
    low: number; mid: number; high: number; currency: string; period: string;
    context: string; factors: string[]; negotiationTips: string[];
  } | null;
}) {
  const queryClient = useQueryClient();

  const generate = useGenerateSalaryGuide({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) }),
    },
  });

  const guide = generate.data ?? existing;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-500" /> Salary Guide
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-estimated market salary range for this role and profile.
          </p>
        </div>
        <Button
          size="sm"
          variant={guide ? "outline" : "default"}
          onClick={() => generate.mutate({ id: analysisId })}
          disabled={generate.isPending}
          className="no-print shrink-0"
        >
          {generate.isPending ? (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Estimating...</>
          ) : guide ? "Refresh" : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Estimate Salary</>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {generate.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : guide ? (
          <div className="space-y-5">
            {/* Salary bar */}
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="flex items-end justify-between mb-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-medium">Low</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{formatSalary(guide.low)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-medium">Median</p>
                  <p className="text-2xl font-extrabold tabular-nums text-primary">{formatSalary(guide.mid)}</p>
                  <p className="text-xs text-muted-foreground">per {guide.period}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-medium">High</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{formatSalary(guide.high)}</p>
                </div>
              </div>
              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 rounded-full bg-gradient-to-r from-yellow-400 via-green-500 to-green-600"
                  style={{ left: "0%", right: "0%" }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-white shadow"
                  style={{
                    left: `${Math.min(95, Math.max(5, ((guide.mid - guide.low) / Math.max(guide.high - guide.low, 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">{guide.context}</p>

            {guide.factors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Factors that could raise your offer
                </p>
                <div className="space-y-1.5">
                  {guide.factors.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {guide.negotiationTips.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Negotiation Tips
                </p>
                <div className="space-y-2">
                  {guide.negotiationTips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-muted/50 rounded-lg text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Click "Estimate Salary" to get an AI-powered market salary range for this role based on your profile.
          </p>
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
          <Wand2 className="w-4 h-4 text-purple-500" /> AI Bullet Rewriter
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

// --- Interview Questions ---
function InterviewQuestions({ analysisId, existingQuestions }: { analysisId: number; existingQuestions: string[] }) {
  const queryClient = useQueryClient();
  const { copy, isCopied } = useCopy();

  const generate = useGenerateInterviewQuestions({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) }),
    },
  });

  const allQuestions = generate.data?.questions ?? existingQuestions;

  return (
    <Card className="border shadow-sm print-break-inside-avoid">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-orange-500" /> Interview Questions
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Likely questions based on this role and your resume gaps.
          </p>
        </div>
        <Button
          size="sm"
          variant={existingQuestions.length > 0 ? "outline" : "default"}
          onClick={() => generate.mutate({ id: analysisId })}
          disabled={generate.isPending}
          data-testid="button-generate-interview-questions"
          className="no-print shrink-0"
        >
          {generate.isPending ? (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Generating...</>
          ) : existingQuestions.length > 0 ? "Regenerate" : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate</>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {generate.isPending ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : allQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Click "Generate" to get likely interview questions for this role based on your resume analysis.
          </p>
        ) : (
          <div className="space-y-2" data-testid="interview-questions-list">
            {allQuestions.map((q, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors group"
                data-testid={`interview-question-${i}`}
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm flex-1">{q}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 no-print"
                  onClick={() => copy(q, "Question copied")}
                >
                  {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground mt-1 no-print"
              onClick={() => copy(allQuestions.join("\n\n"), "All questions copied")}
            >
              <Copy className="w-3 h-3 mr-1.5" />
              Copy all questions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Learning Plan ---
function LearningPlanSection({ analysisId, existingItems }: { analysisId: number; existingItems: LearningPlanItem[] }) {
  const queryClient = useQueryClient();

  const generate = useGenerateLearningPlan({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) }),
    },
  });

  const items = (generate.data?.items ?? existingItems) as LearningPlanItem[];

  return (
    <Card className="border shadow-sm print-break-inside-avoid">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-500" /> Personalized Learning Plan
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Targeted resources to close your skill gaps for this role.
          </p>
        </div>
        <Button
          size="sm"
          variant={items.length > 0 ? "outline" : "default"}
          onClick={() => generate.mutate({ id: analysisId })}
          disabled={generate.isPending}
          data-testid="button-generate-learning-plan"
          className="no-print shrink-0"
        >
          {generate.isPending ? (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Generating...</>
          ) : items.length > 0 ? "Regenerate" : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate</>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {generate.isPending ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Click "Generate" to get a personalized study plan based on your skill gaps for this role.
          </p>
        ) : (
          <div className="space-y-4" data-testid="learning-plan-list">
            {items.map((item, i) => {
              const priority = PRIORITY_CONFIG[item.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
              return (
                <div key={i} className="rounded-lg border p-4 space-y-3 print-break-inside-avoid" data-testid={`learning-item-${i}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{item.skill}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.why}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${priority.className}`}>
                      {priority.label}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {item.resources.map((res, j) => (
                      <div key={j} className="flex items-start gap-2.5 bg-muted/40 rounded-lg px-3 py-2">
                        <span className="mt-0.5 text-muted-foreground shrink-0">
                          {resourceTypeIcon(res.type as LearningResource["type"])}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-semibold">{res.title}</p>
                            {res.platform && (
                              <span className="text-xs text-muted-foreground">· {res.platform}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{res.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
      <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 no-print">
        <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">Shared publicly</p>
          <p className="text-xs text-muted-foreground truncate">{url}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-purple-300 dark:border-purple-700"
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

// --- Company Research Section ---
function CompanyResearchSection({ analysisId, existing }: {
  analysisId: number;
  existing: {
    overview: string; culture: string; interviewProcess: string;
    recentNews: string[]; glassdoorRating: string; tips: string[];
  } | null;
}) {
  const queryClient = useQueryClient();
  const generate = useGenerateCompanyResearch({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) }),
    },
  });
  const data = generate.data ?? existing;

  return (
    <Card className="border shadow-sm print-break-inside-avoid">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" /> Company Research
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-generated research brief to help you prepare for this interview.
          </p>
        </div>
        <Button
          size="sm"
          variant={data ? "outline" : "default"}
          onClick={() => generate.mutate({ id: analysisId })}
          disabled={generate.isPending}
          className="no-print shrink-0"
        >
          {generate.isPending ? (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Researching...</>
          ) : data ? "Refresh" : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Research Company</>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {generate.isPending ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        ) : data ? (
          <div className="space-y-5">
            {data.overview && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Overview
                </p>
                <p className="text-sm">{data.overview}</p>
              </div>
            )}
            {data.culture && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Culture</p>
                <p className="text-sm">{data.culture}</p>
              </div>
            )}
            {data.interviewProcess && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Typical Interview Process
                </p>
                <p className="text-sm">{data.interviewProcess}</p>
              </div>
            )}
            {data.recentNews && data.recentNews.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent News / Developments</p>
                <div className="space-y-1.5">
                  {data.recentNews.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.glassdoorRating && (
              <div className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-lg">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-sm"><span className="font-semibold">Glassdoor:</span> {data.glassdoorRating}</span>
              </div>
            )}
            {data.tips && data.tips.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-yellow-500" /> Preparation Tips
                </p>
                <div className="space-y-2">
                  {data.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-muted/50 rounded-lg text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Click "Research Company" to get an AI-generated brief on this company's culture, interview process, and preparation tips.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Red Flags Section ---
const SEVERITY_CONFIG = {
  high: { label: "High", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  low: { label: "Low", className: "bg-muted text-muted-foreground border-muted-foreground/20", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

function RedFlagsSection({ analysisId, existing }: {
  analysisId: number;
  existing: Array<{ severity: string; title: string; description: string; quote: string }> | null;
}) {
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<{
    flags: Array<{ severity: string; title: string; description: string; quote: string }>;
    summary: string;
    overallRisk: string;
  } | null>(null);

  const detect = useDetectRedFlags({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
        setLastResult(data as typeof lastResult);
      },
    },
  });

  const flags = lastResult?.flags ?? existing;
  const summary = lastResult?.summary;
  const risk = lastResult?.overallRisk;

  const riskColor = risk === "high" ? "text-red-600" : risk === "medium" ? "text-yellow-600" : "text-green-600";

  return (
    <Card className="border shadow-sm print-break-inside-avoid">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" /> Red Flags Detector
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI analysis of potentially concerning patterns in this job description.
          </p>
        </div>
        <Button
          size="sm"
          variant={flags ? "outline" : "default"}
          onClick={() => detect.mutate({ id: analysisId })}
          disabled={detect.isPending}
          className="no-print shrink-0"
        >
          {detect.isPending ? (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Analyzing...</>
          ) : flags ? "Re-analyze" : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Detect Red Flags</>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {detect.isPending ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : flags ? (
          <div className="space-y-4">
            {summary && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40">
                <Shield className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm">{summary}</p>
                  {risk && (
                    <p className={`text-xs font-semibold mt-1 ${riskColor}`}>
                      Overall risk: <span className="capitalize">{risk}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
            {flags.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                No significant red flags detected. This job description looks healthy.
              </div>
            ) : (
              <div className="space-y-3">
                {flags.map((flag, i) => {
                  const config = SEVERITY_CONFIG[flag.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.low;
                  return (
                    <div key={i} className="rounded-lg border p-3.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.className}`}>
                          {config.icon} {config.label}
                        </span>
                        <p className="text-sm font-semibold">{flag.title}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{flag.description}</p>
                      {flag.quote && (
                        <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-xs text-muted-foreground italic">
                          "{flag.quote}"
                        </blockquote>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Click "Detect Red Flags" to have AI scan this job description for unrealistic expectations, vague compensation, or other concerning patterns.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Negotiation Simulator ---
type NegotiationMessage = { role: "user" | "assistant"; content: string; tip?: string };

function NegotiationSimulator({ analysisId, jobTitle, companyName }: {
  analysisId: number;
  jobTitle: string;
  companyName: string | null;
}) {
  const [messages, setMessages] = useState<NegotiationMessage[]>([]);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const simulate = useSimulateNegotiation({
    mutation: {
      onSuccess: (data) => {
        const d = data as { message: string; tip?: string };
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: d.message, tip: d.tip },
        ]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      },
    },
  });

  const startConversation = () => {
    setStarted(true);
    setMessages([]);
    simulate.mutate({
      id: analysisId,
      data: {
        messages: [{ role: "user", content: "Hello, I'm excited about the offer. Can you tell me what the compensation package looks like?" }],
      },
    });
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    const newMessages: NegotiationMessage[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    simulate.mutate({
      id: analysisId,
      data: {
        messages: newMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content })),
      },
    });
  };

  return (
    <Card className="border shadow-sm no-print">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-500" /> Negotiation Simulator
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Practice salary negotiation with an AI recruiter for this role.
          </p>
        </div>
        {started && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStarted(false); setMessages([]); }}
            className="text-muted-foreground shrink-0"
          >
            Reset
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!started ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center mx-auto">
              <Bot className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">{jobTitle}{companyName ? " at " + companyName : ""}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start a negotiation simulation. The AI will play a recruiter making you an offer, and you'll practice negotiating.
              </p>
            </div>
            <Button onClick={startConversation} disabled={simulate.isPending} className="gap-1.5">
              {simulate.isPending ? (
                <><Sparkles className="w-3.5 h-3.5 animate-pulse" />Starting...</>
              ) : (
                <><Bot className="w-3.5 h-3.5" />Start Simulation</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                  {msg.tip && msg.role === "assistant" && (
                    <div className="max-w-[85%] flex items-start gap-1.5 text-xs text-muted-foreground px-1">
                      <Lightbulb className="w-3 h-3 mt-0.5 text-yellow-500 shrink-0" />
                      <span className="italic">{msg.tip}</span>
                    </div>
                  )}
                </div>
              ))}
              {simulate.isPending && (
                <div className="flex items-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: i * 0.15 + "s" }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2 border-t pt-3">
              <Input
                placeholder="Type your negotiation message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                className="text-sm flex-1"
                disabled={simulate.isPending}
              />
              <Button
                size="sm"
                onClick={sendMessage}
                disabled={simulate.isPending || !input.trim()}
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- STAR Helper ---
function STARHelper({ analysisId, questions }: { analysisId: number; questions: string[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { situation: string; task: string; action: string; result: string }>>({});
  const [results, setResults] = useState<Record<number, { answer: string; tips: string[] }>>({});

  const generate = useGenerateStarAnswer({
    mutation: {
      onSuccess: (data, variables) => {
        const d = data as { answer: string; tips: string[] };
        setResults((prev) => ({ ...prev, [variables.id as unknown as number]: d }));
      },
    },
  });

  if (questions.length === 0) return null;

  const updateDraft = (idx: number, field: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [idx]: { ...prev[idx], [field]: value } as { situation: string; task: string; action: string; result: string } }));
  };

  return (
    <Card className="border shadow-sm print-break-inside-avoid">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" /> STAR Answer Helper
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-0.5">
          Prepare polished STAR-method answers for your interview questions.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {questions.map((q, i) => {
          const isOpen = expanded === i;
          const draft = drafts[i] ?? { situation: "", task: "", action: "", result: "" };
          const result = results[i];

          return (
            <div key={i} className="rounded-lg border overflow-hidden">
              <button
                className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                onClick={() => setExpanded(isOpen ? null : i)}
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm flex-1">{q}</p>
                <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 mt-0.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t p-4 space-y-4 bg-muted/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(["situation", "task", "action", "result"] as const).map((field) => (
                      <div key={field} className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {field.charAt(0).toUpperCase() + field.slice(1)}
                        </label>
                        <Textarea
                          placeholder={
                            field === "situation" ? "Describe the context or background..."
                            : field === "task" ? "What was your responsibility?"
                            : field === "action" ? "What specific steps did you take?"
                            : "What was the outcome? Include metrics if possible."
                          }
                          value={draft[field]}
                          onChange={(e) => updateDraft(i, field, e.target.value)}
                          className="text-xs min-h-[70px] resize-none"
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      generate.mutate({
                        id: analysisId,
                        data: {
                          question: q,
                          situation: draft.situation || undefined,
                          task: draft.task || undefined,
                          action: draft.action || undefined,
                          result: draft.result || undefined,
                        },
                      });
                    }}
                    disabled={generate.isPending}
                    className="gap-1.5"
                  >
                    {generate.isPending ? (
                      <><Sparkles className="w-3.5 h-3.5 animate-pulse" />Generating...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" />{result ? "Regenerate" : "Generate STAR Answer"}</>
                    )}
                  </Button>
                  {result && (
                    <div className="space-y-3 mt-2">
                      <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3.5 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400 mb-2">Polished Answer</p>
                        <p className="text-sm leading-relaxed">{result.answer}</p>
                      </div>
                      {result.tips.length > 0 && (
                        <div className="space-y-1.5">
                          {result.tips.map((tip, j) => (
                            <div key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <Lightbulb className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                              <span>{tip}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
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

  const { data: analysis, isLoading } = useGetAnalysis(id, {
    query: { enabled: !!id, queryKey: getGetAnalysisQueryKey(id) },
  });

  const generateCoverLetter = useGenerateCoverLetter({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) }),
    },
  });

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
  const interviewQuestions = (analysis.interviewQuestions as string[]) ?? [];
  const learningPlan = (analysis.learningPlan as LearningPlanItem[]) ?? [];
  const salaryGuide = analysis.salaryGuide as {
    low: number; mid: number; high: number; currency: string; period: string;
    context: string; factors: string[]; negotiationTips: string[];
  } | null ?? null;
  const companyResearch = analysis.companyResearch as {
    overview: string; culture: string; interviewProcess: string;
    recentNews: string[]; glassdoorRating: string; tips: string[];
  } | null ?? null;
  const redFlags = analysis.redFlags as Array<{
    severity: string; title: string; description: string; quote: string;
  }> | null ?? null;

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
            onClick={() => window.print()}
            data-testid="button-export-pdf"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Export PDF
          </Button>
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
            <p className="text-xs font-semibold uppercase tracking-wider text-green-600 mb-2">Matched</p>
            <div className="flex flex-wrap gap-2">
              {atsMatched.length === 0 ? (
                <p className="text-sm text-muted-foreground">None matched</p>
              ) : (
                atsMatched.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" data-testid={`keyword-matched-${i}`}>
                    {kw}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-destructive mb-2">Missing</p>
            <div className="flex flex-wrap gap-2">
              {atsMissing.length === 0 ? (
                <p className="text-sm text-muted-foreground">No missing keywords</p>
              ) : (
                atsMissing.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" data-testid={`keyword-missing-${i}`}>
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
          jobTitle: analysis.jobTitle,
          companyName: analysis.companyName ?? null,
        }}
      />

      {/* Salary Guide */}
      <SalaryGuideSection analysisId={id} existing={salaryGuide} />

      {/* Company Research */}
      <CompanyResearchSection analysisId={id} existing={companyResearch} />

      {/* Red Flags */}
      <RedFlagsSection analysisId={id} existing={redFlags} />

      {/* Negotiation Simulator */}
      <NegotiationSimulator
        analysisId={id}
        jobTitle={analysis.jobTitle}
        companyName={analysis.companyName ?? null}
      />

      {/* Interview Checklist */}
      <InterviewChecklist analysisId={id} />

      {/* Notes */}
      <NotesSection analysisId={id} initialNotes={analysis.notes ?? null} />

      {/* AI Bullet Rewriter */}
      <BulletRewriter analysisId={id} />

      {/* Interview Questions */}
      <InterviewQuestions analysisId={id} existingQuestions={interviewQuestions} />

      {/* STAR Helper */}
      {interviewQuestions.length > 0 && (
        <STARHelper analysisId={id} questions={interviewQuestions} />
      )}

      {/* Learning Plan */}
      <LearningPlanSection analysisId={id} existingItems={learningPlan} />

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
        <CardContent>
          {generateCoverLetter.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : analysis.coverLetter ? (
            <Textarea
              value={analysis.coverLetter}
              readOnly
              className="min-h-[300px] font-mono text-sm resize-none bg-muted/30"
              data-testid="textarea-cover-letter"
            />
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
