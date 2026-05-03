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

// --- Job Tracking Section ---
function JobTrackingSection({ analysisId, analysis }: {
  analysisId: number;
  analysis: {
    deadline: string | null;
    contactName: string | null;
    contactEmail: string | null;
    followUpDate: string | null;
    tags: string[] | null;
  };
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tagInput, setTagInput] = useState("");

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

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    const updated = [...tags, t];
    save("tags", updated);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    save("tags", tags.filter((t) => t !== tag));
  };

  const emailLink = analysis.contactEmail
    ? `mailto:${analysis.contactEmail}?subject=Re: ${encodeURIComponent("Application inquiry")}`
    : null;

  return (
    <Card className="border shadow-sm no-print">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-orange-500" /> Job Tracking
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track deadlines, contacts, and follow-ups for this application.
        </p>
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
                <a
                  href={emailLink}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
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
          <div className="flex gap-2">
            <Input
              placeholder="Add a tag (e.g. remote, fintech, senior)..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              className="text-sm"
            />
            <Button variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
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
        }}
      />

      {/* Salary Guide */}
      <SalaryGuideSection analysisId={id} existing={salaryGuide} />

      {/* Notes */}
      <NotesSection analysisId={id} initialNotes={analysis.notes ?? null} />

      {/* AI Bullet Rewriter */}
      <BulletRewriter analysisId={id} />

      {/* Interview Questions */}
      <InterviewQuestions analysisId={id} existingQuestions={interviewQuestions} />

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
