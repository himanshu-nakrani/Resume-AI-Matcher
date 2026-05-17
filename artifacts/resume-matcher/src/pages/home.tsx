import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  useCreateAnalysis,
  useListAnalyses,
  getListAnalysesQueryKey,
  useFetchJobDescription,
  useSearchJobs,
  JobSearchBodySearchType,
  JobSearchAnalysisEffectiveSearchType,
} from "@workspace/api-client-react";
import type { JobSearchResponse, JobSearchAnalysis } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreCircle } from "@/components/score-circle";
import { ArrowRight, BriefcaseBusiness, FileText, KeyRound, LayoutGrid, Link2, Search, Sparkles, Upload, UserRound, Wand2, X, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { DEEPSEEK_KEY_STORAGE_KEY } from "@/lib/deepseek-storage";
import { JobDetailModal } from "@/components/job-detail-modal";
import { Bookmark, ChevronDown, SlidersHorizontal } from "lucide-react";

type JobSearchHit = JobSearchResponse["results"][number];

/** Older API servers may omit `analysis`; merge so success handlers never throw. */
function jobSearchResponseWithAnalysis(data: JobSearchResponse, submittedQuery: string): JobSearchResponse {
  const analysis = (data as { analysis?: JobSearchAnalysis | null }).analysis;
  if (analysis != null) return { ...data, analysis };
  const fallback: JobSearchAnalysis = {
    intentSummary:
      "Showing ranked openings for your prompt. Restart the API server to enable deeper server-side analysis metadata.",
    optimizedQuery: submittedQuery,
    inferredLocation: null,
    recentBias: false,
    additionalQueries: [],
    effectiveSearchType: JobSearchAnalysisEffectiveSearchType.auto,
  };
  return { ...data, analysis: fallback };
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "job source";
  }
}

function cleanJobText(text: string): string {
  return text
    .replace(/#+\s*/g, "")
    .replace(/\[\s*\.\.\.\s*\]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function compact(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength).trimEnd();
  const lastBreak = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf(";"), clipped.lastIndexOf(","));
  return `${clipped.slice(0, lastBreak > 120 ? lastBreak + 1 : clipped.length).trim()}...`;
}

function jobSnippets(hit: JobSearchHit): string[] {
  const raw = hit.highlights ?? [];
  const seen = new Set<string>();
  return raw
    .flatMap((highlight) => highlight.split(/\s*\[\s*\.\.\.\s*\]\s*/g))
    .map(cleanJobText)
    .filter((snippet) => snippet.length >= 45)
    .filter((snippet) => !/\b(salary search|similar jobs|job alert)\b/i.test(snippet))
    .map((snippet) => compact(snippet, 220))
    .filter((snippet) => {
      const key = snippet.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 2);
}

function jobBadges(hit: JobSearchHit): string[] {
  const source = `${hit.title} ${(hit.highlights ?? []).join(" ")}`.toLowerCase();
  const badges = new Set<string>();
  if (/\b(remote|work from home|wfh|distributed)\b/.test(source)) badges.add("Remote");
  if (/\b(hybrid)\b/.test(source)) badges.add("Hybrid");
  if (/\b(on[-\s]?site|in person|office)\b/.test(source)) badges.add("On-site");
  if (/\b(full[-\s]?time)\b/.test(source)) badges.add("Full-time");
  if (/\b(part[-\s]?time)\b/.test(source)) badges.add("Part-time");
  if (/\b(intern|internship|co-?op)\b/.test(source)) badges.add("Internship");
  if (/\b(senior|sr\.?|lead|staff|principal)\b/.test(source)) badges.add("Senior+");
  if (/\b(hyderabad|bengaluru|bangalore|mumbai|pune|delhi|chennai|gurugram|noida)\b/.test(source)) badges.add("India");
  return [...badges].slice(0, 4);
}

function formatPublishedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { addSuffix: true });
}

function inferRoleAndCompany(hit: JobSearchHit): { jobTitle: string; companyName: string } {
  const title = cleanJobText(hit.title);
  const atMatch = title.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s+[|-]\s+.+)?$/i);
  if (atMatch) {
    return {
      jobTitle: atMatch[1]?.trim() ?? title,
      companyName: atMatch[2]?.trim() ?? getHostname(hit.url),
    };
  }

  const dashMatch = title.match(/^(.+?)\s+[|-]\s+(.+?)$/);
  if (dashMatch) {
    return {
      jobTitle: dashMatch[1]?.trim() ?? title,
      companyName: dashMatch[2]?.trim() ?? getHostname(hit.url),
    };
  }

  return { jobTitle: title, companyName: getHostname(hit.url) };
}

function fallbackJobDescriptionFromHit(hit: JobSearchHit): string {
  const snippets = jobSnippets(hit);
  const { jobTitle, companyName } = inferRoleAndCompany(hit);
  const detail = snippets.length > 0
    ? snippets.join("\n\n")
    : "Open the source link to review the complete responsibilities, qualifications, and application details.";

  return [
    `${jobTitle} at ${companyName}`,
    `Source: ${hit.url}`,
    "",
    detail,
  ].join("\n");
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const USER_STORAGE_KEY = "optimatch_user_profile";

const formSchema = z.object({
  userName: z.string().min(1, "Your name is required"),
  userEmail: z.string().email("Enter a valid email"),
  deepseekApiKey: z.string().min(1, "DeepSeek API key is required"),
  jobTitle: z.string().min(1, "Role is required"),
  companyName: z.string().min(1, "Company name is required"),
  resumeText: z.string().min(50, "Resume content must be at least 50 characters"),
  sourceLatex: z.string().optional(),
  jobDescriptionText: z.string().min(50, "Job description must be at least 50 characters"),
});

type FormValues = z.infer<typeof formSchema>;
type ResumeFileType = "pdf" | "latex" | "text";

function stripLatexToText(source: string) {
  return source
    .replace(/%.*$/gm, " ")
    .replace(/\\(section|subsection|textbf|textit|emph|item)\*?\{([^}]*)\}/g, "$2")
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function parsePdf(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }

  return pages.join("\n\n").replace(/\s{3,}/g, " ").trim();
}

export function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeFileType, setResumeFileType] = useState<ResumeFileType>("text");
  const [resumeFileError, setResumeFileError] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [jobUrlInput, setJobUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [exaQuery, setExaQuery] = useState("");
  const [exaRecent, setExaRecent] = useState(true);
  const [exaSkipHeuristics, setExaSkipHeuristics] = useState(false);
  const [exaType, setExaType] = useState<JobSearchBodySearchType>(JobSearchBodySearchType.auto);
  const [exaNumResults, setExaNumResults] = useState(10);
  const [exaUserLocation, setExaUserLocation] = useState("");
  const [exaResults, setExaResults] = useState<JobSearchResponse | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exaExperienceLevel, setExaExperienceLevel] = useState("");
  const [exaJobType, setExaJobType] = useState("");
  const [exaRemote, setExaRemote] = useState("");
  const [exaSalaryMin, setExaSalaryMin] = useState("");
  const [exaIndustry, setExaIndustry] = useState("");
  const [exaCompanySize, setExaCompanySize] = useState("");
  const [detailHit, setDetailHit] = useState<JobSearchHit | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [preScreening, setPreScreening] = useState<Set<string>>(new Set());
  const [matchScores, setMatchScores] = useState<Map<string, { score: number; loading: boolean }>>(new Map());

  const savedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_STORAGE_KEY) ?? "{}") as Partial<FormValues>;
    } catch {
      return {};
    }
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userName: savedUser.userName ?? "",
      userEmail: savedUser.userEmail ?? "",
      deepseekApiKey: localStorage.getItem(DEEPSEEK_KEY_STORAGE_KEY) ?? "",
      jobTitle: "",
      companyName: "",
      resumeText: "",
      sourceLatex: "",
      jobDescriptionText: "",
    },
  });

  useEffect(() => {
    const subscription = form.watch((values) => {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
        userName: values.userName ?? "",
        userEmail: values.userEmail ?? "",
      }));
      if (values.deepseekApiKey) {
        localStorage.setItem(DEEPSEEK_KEY_STORAGE_KEY, values.deepseekApiKey);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const createAnalysis = useCreateAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        toast({
          title: "Resume optimized",
          description: "A tracker entry was created automatically. Add deadlines or status next.",
        });
        setLocation(`/analysis/${data.id}`);
      },
      onError: () => {
        toast({
          title: "Optimization failed",
          description: "Check your DeepSeek API key and try again.",
          variant: "destructive",
        });
      },
    },
  });

  const fetchJob = useFetchJobDescription({
    mutation: {
      onSuccess: (data) => {
        form.setValue("jobDescriptionText", data.jobDescription, { shouldDirty: true, shouldValidate: true });
        if (data.jobTitle && !form.getValues("jobTitle")) form.setValue("jobTitle", data.jobTitle);
        if (data.companyName && !form.getValues("companyName")) form.setValue("companyName", data.companyName);
        setShowUrlInput(false);
        setJobUrlInput("");
        toast({ title: "Job description imported", description: "Company, role, and JD were extracted from the URL." });
      },
      onError: (_err, variables) => {
        const url = variables?.data.url;
        const hit = exaResults?.results.find((result) => result.url === url);
        if (hit) {
          const fallbackText = fallbackJobDescriptionFromHit(hit);
          const { jobTitle, companyName } = inferRoleAndCompany(hit);
          form.setValue("jobDescriptionText", fallbackText, { shouldDirty: true, shouldValidate: true });
          if (!form.getValues("jobTitle")) form.setValue("jobTitle", jobTitle);
          if (!form.getValues("companyName")) form.setValue("companyName", companyName);
          toast({
            title: "Imported search preview",
            description: "The source blocked full extraction, so we filled the form from the processed search result.",
          });
          return;
        }
        toast({
          title: "Could not import",
          description: "That page blocked extraction. Paste the JD manually or use a result from job search.",
          variant: "destructive",
        });
      },
    },
  });

  const jobSearchExa = useSearchJobs({
    mutation: {
      onSuccess: (data, variables) => {
        const payload = jobSearchResponseWithAnalysis(data, variables.data.query);
        setExaResults(payload);
        const { analysis } = payload;
        toast({
          title: "Job search complete",
          description: `${payload.results.length} listing(s) · ${analysis.effectiveSearchType}${analysis.inferredLocation ? ` · ${analysis.inferredLocation}` : ""}`,
        });
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Job search failed.";
        toast({ title: "Job search failed", description: message, variant: "destructive" });
      },
    },
  });

  const handleExaJobSearch = (offset?: number) => {
    const q = exaQuery.trim();
    if (q.length < 2) {
      toast({
        title: "Add a search query",
        description: "Describe the role, level, location, or company you want (at least 2 characters).",
        variant: "destructive",
      });
      return;
    }
    const loc = exaUserLocation.trim().toUpperCase();
    if (loc.length > 0 && loc.length !== 2) {
      toast({
        title: "Use a 2-letter country code",
        description: "Examples: US, IN, GB, CA. Leave it blank to let the prompt decide.",
        variant: "destructive",
      });
      return;
    }
    const filters: Record<string, string> = {};
    if (exaExperienceLevel) filters.experienceLevel = exaExperienceLevel;
    if (exaJobType) filters.jobType = exaJobType;
    if (exaRemote) filters.remote = exaRemote;
    if (exaSalaryMin) filters.salaryMin = exaSalaryMin;
    if (exaIndustry) filters.industry = exaIndustry;
    if (exaCompanySize) filters.companySize = exaCompanySize;

    jobSearchExa.mutate({
      data: {
        query: q,
        numResults: exaNumResults,
        offset,
        searchType: exaType,
        recentOnly: exaRecent,
        ...(exaSkipHeuristics ? { skipHeuristicAnalysis: true } : {}),
        ...(loc.length === 2 ? { userLocation: loc } : {}),
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
      },
    });
  };

  const loadMore = async () => {
    if (!exaResults?.nextOffset) return;
    setLoadingMore(true);
    try {
      const loc = exaUserLocation.trim().toUpperCase();
      const filters: Record<string, string> = {};
      if (exaExperienceLevel) filters.experienceLevel = exaExperienceLevel;
      if (exaJobType) filters.jobType = exaJobType;
      if (exaRemote) filters.remote = exaRemote;
      if (exaSalaryMin) filters.salaryMin = exaSalaryMin;
      if (exaIndustry) filters.industry = exaIndustry;
      if (exaCompanySize) filters.companySize = exaCompanySize;

      const res = await fetch("/api/job-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: exaQuery.trim(),
          numResults: exaNumResults,
          offset: exaResults.nextOffset,
          searchType: exaType,
          recentOnly: exaRecent,
          ...(exaSkipHeuristics ? { skipHeuristicAnalysis: true } : {}),
          ...(loc.length === 2 ? { userLocation: loc } : {}),
          ...(Object.keys(filters).length > 0 ? { filters } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setExaResults((prev) => prev ? {
          ...data,
          results: [...prev.results, ...data.results],
        } : data);
      }
    } catch { /* ignore */ }
    setLoadingMore(false);
  };

  const saveJob = async (hit: JobSearchHit) => {
    try {
      const res = await fetch("/api/saved-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: hit.url,
          title: hit.title,
          source: getHostname(hit.url),
          salary: hit.salary ?? undefined,
          applyType: hit.applyType ?? "unknown",
          highlights: hit.highlights,
          publishedDate: hit.publishedDate,
        }),
      });
      if (res.ok) {
        toast({ title: "Job saved", description: "View in Saved Jobs." });
      } else if (res.status === 409) {
        toast({ title: "Already saved", description: "This job is already in your saved list." });
      }
    } catch {
      toast({ title: "Could not save", variant: "destructive" });
    }
  };

  const preScreenHit = async (hit: JobSearchHit) => {
    const resumeText = form.getValues("resumeText");
    if (!resumeText || resumeText.length < 50) {
      toast({ title: "Upload a resume first", description: "Upload your resume to see match estimates." });
      return;
    }
    setMatchScores((prev) => new Map(prev).set(hit.url, { score: 0, loading: true }));
    try {
      const res = await fetch("/api/job-search/pre-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobUrl: hit.url }),
      });
      const data = await res.json();
      if (res.ok) {
        setMatchScores((prev) => new Map(prev).set(hit.url, { score: data.matchScore, loading: false }));
      } else {
        setMatchScores((prev) => new Map(prev).set(hit.url, { score: 0, loading: false }));
      }
    } catch {
      setMatchScores((prev) => new Map(prev).set(hit.url, { score: 0, loading: false }));
    }
  };

  const { data: analyses, isLoading } = useListAnalyses();

  const onResumeFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop();

    setResumeFileError("");
    setIsParsingResume(true);
    setResumeFileName(file.name);

    try {
      if (ext === "pdf") {
        const text = await parsePdf(file);
        setResumeFileType("pdf");
        form.setValue("resumeText", text, { shouldDirty: true, shouldValidate: true });
        form.setValue("sourceLatex", "", { shouldDirty: true });
      } else if (ext === "tex" || ext === "latex") {
        const latex = await file.text();
        setResumeFileType("latex");
        form.setValue("sourceLatex", latex, { shouldDirty: true });
        form.setValue("resumeText", stripLatexToText(latex), { shouldDirty: true, shouldValidate: true });
      } else if (ext === "txt") {
        const text = await file.text();
        setResumeFileType("text");
        form.setValue("resumeText", text.trim(), { shouldDirty: true, shouldValidate: true });
        form.setValue("sourceLatex", "", { shouldDirty: true });
      } else {
        throw new Error("Unsupported file");
      }
    } catch {
      setResumeFileError("Could not read that resume. Upload a PDF, .tex, .latex, or TXT file.");
      setResumeFileName("");
    } finally {
      setIsParsingResume(false);
      event.target.value = "";
    }
  };

  const handleImportUrl = () => {
    if (jobUrlInput.trim()) fetchJob.mutate({ data: { url: jobUrlInput.trim() } });
  };

  const onSubmit = (values: FormValues) => {
    createAnalysis.mutate({
      data: {
        jobTitle: values.jobTitle,
        companyName: values.companyName,
        resumeText: values.resumeText,
        sourceLatex: values.sourceLatex ?? "",
        originalFileName: resumeFileName,
        originalFileType: resumeFileType,
        deepseekApiKey: values.deepseekApiKey,
        jobDescriptionText: values.jobDescriptionText,
      },
    });
  };

  const recent = analyses?.slice(0, 4) ?? [];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-card px-6 py-12 shadow-xl sm:px-12 sm:py-16">
        <div className="animated-gradient pointer-events-none absolute inset-0 opacity-10" aria-hidden />
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-32 -bottom-32 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" aria-hidden />
        <div className="relative max-w-4xl mx-auto text-center">
          <Badge variant="gradient" className="mb-6 font-semibold tracking-tight shadow-lg animate-bounce-in">
            <Sparkles className="w-3.5 h-3.5" />
            OptiMatch AI
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[1.1] mb-6">
            Upload once.{" "}
            <span className="gradient-text">Tailor every resume</span>
            {" "}for the role.
          </h1>
          <p className="mt-6 max-w-3xl mx-auto text-base text-muted-foreground sm:text-lg md:text-xl leading-relaxed">
            AI-powered resume optimization with ATS scoring, job tracking, and intelligent matching. 
            Transform your job search with personalized resumes for every opportunity.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-semibold">AI</div>
                <div className="h-8 w-8 rounded-full bg-success/20 border-2 border-background flex items-center justify-center text-xs font-semibold">ATS</div>
                <div className="h-8 w-8 rounded-full bg-warning/20 border-2 border-background flex items-center justify-center text-xs font-semibold">PDF</div>
              </div>
              <span>Powered by DeepSeek AI</span>
            </div>
          </div>
        </div>
      </section>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-analysis">
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4 text-primary" /> User Login
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="userName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="Your name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="userEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input placeholder="you@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="deepseekApiKey" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> DeepSeek API Key</FormLabel>
                  <FormControl><Input type="password" placeholder="sk-..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BriefcaseBusiness className="h-4 w-4 text-primary" /> Target Job
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Acme Corp" {...field} data-testid="input-company-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="jobTitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl><Input placeholder="e.g. Backend Engineer" {...field} data-testid="input-job-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setShowUrlInput((v) => !v)}>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" /> Import JD from URL
                  </Button>
                  <span className="text-xs text-muted-foreground">or paste the job description below</span>
                </div>
                {showUrlInput && (
                  <div className="flex gap-2">
                    <Input value={jobUrlInput} onChange={(e) => setJobUrlInput(e.target.value)} placeholder="https://company.com/jobs/role" />
                    <Button type="button" onClick={handleImportUrl} disabled={fetchJob.isPending || !jobUrlInput.trim()}>
                      {fetchJob.isPending ? "Importing..." : "Import"}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setShowUrlInput(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <FormField control={form.control} name="jobDescriptionText" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Description</FormLabel>
                    <FormControl><Textarea className="min-h-[220px] font-mono text-sm" placeholder="Paste the full JD here..." {...field} data-testid="textarea-jd" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4 text-primary" /> Job search (Exa)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Describe the role in natural language; the server infers location, remote intent, and recency, then asks Exa with a job-focused system prompt and query variants. Configure{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">EXA_API_KEY</code> on the API server.
              </p>
              <Textarea
                className="min-h-[100px] text-sm"
                placeholder='e.g. "senior TypeScript backend engineer remote EU startup job posting"'
                value={exaQuery}
                onChange={(e) => setExaQuery(e.target.value)}
              />

              <Button type="button" variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Filters {Object.values({ exaExperienceLevel, exaJobType, exaRemote, exaSalaryMin, exaIndustry, exaCompanySize }).filter(Boolean).length > 0 ? `(${Object.values({ exaExperienceLevel, exaJobType, exaRemote, exaSalaryMin, exaIndustry, exaCompanySize }).filter(Boolean).length})` : ""}
              </Button>

              {showFilters && (
                <div className="flex flex-wrap gap-2 items-end p-3 border rounded-md bg-muted/20">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Experience</label>
                    <select className="flex h-8 rounded-md border border-input bg-background px-2 text-xs" value={exaExperienceLevel} onChange={(e) => setExaExperienceLevel(e.target.value)}>
                      <option value="">Any</option>
                      <option value="entry">Entry Level</option>
                      <option value="mid">Mid Level</option>
                      <option value="senior">Senior</option>
                      <option value="lead">Lead / Staff</option>
                      <option value="executive">Executive</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Job Type</label>
                    <select className="flex h-8 rounded-md border border-input bg-background px-2 text-xs" value={exaJobType} onChange={(e) => setExaJobType(e.target.value)}>
                      <option value="">Any</option>
                      <option value="full-time">Full-time</option>
                      <option value="contract">Contract</option>
                      <option value="part-time">Part-time</option>
                      <option value="internship">Internship</option>
                      <option value="freelance">Freelance</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Remote</label>
                    <select className="flex h-8 rounded-md border border-input bg-background px-2 text-xs" value={exaRemote} onChange={(e) => setExaRemote(e.target.value)}>
                      <option value="">Any</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="on-site">On-site</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Min Salary ($)</label>
                    <input className="flex h-8 w-24 rounded-md border border-input bg-background px-2 text-xs" placeholder="e.g. 100000" value={exaSalaryMin} onChange={(e) => setExaSalaryMin(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Industry</label>
                    <input className="flex h-8 w-28 rounded-md border border-input bg-background px-2 text-xs" placeholder="e.g. fintech" value={exaIndustry} onChange={(e) => setExaIndustry(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Company Size</label>
                    <select className="flex h-8 rounded-md border border-input bg-background px-2 text-xs" value={exaCompanySize} onChange={(e) => setExaCompanySize(e.target.value)}>
                      <option value="">Any</option>
                      <option value="startup">Startup</option>
                      <option value="mid-size">Mid-size</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Search mode</label>
                  <select className="flex h-9 w-full min-w-[140px] rounded-md border border-input bg-background px-2 text-sm" value={exaType} onChange={(e) => setExaType(e.target.value as JobSearchBodySearchType)}>
                    {Object.values(JobSearchBodySearchType).map((v) => (<option key={v} value={v}>{v}</option>))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Results</label>
                  <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={exaNumResults} onChange={(e) => setExaNumResults(Number(e.target.value))}>
                    {[5, 8, 10, 15].map((n) => (<option key={n} value={n}>{n}</option>))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Country (optional)</label>
                  <Input className="h-9 w-20 uppercase" maxLength={2} placeholder="US" value={exaUserLocation} onChange={(e) => setExaUserLocation(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer pb-1">
                  <input type="checkbox" className="rounded border-input" checked={exaRecent} onChange={(e) => setExaRecent(e.target.checked)} /> Prefer recent
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer pb-1">
                  <input type="checkbox" className="rounded border-input" checked={exaSkipHeuristics} onChange={(e) => setExaSkipHeuristics(e.target.checked)} /> Raw query
                </label>
                <Button type="button" variant="secondary" onClick={() => handleExaJobSearch()} disabled={jobSearchExa.isPending}>
                  {jobSearchExa.isPending ? "Searching…" : "Search jobs"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground"><strong>auto</strong> may upgrade to <strong>deep</strong> for long or multi-signal prompts; <strong>deep-reasoning</strong> can take tens of seconds.</p>

              {exaResults?.analysis && (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1">
                  <p className="font-medium text-foreground">{exaResults.analysis.intentSummary}</p>
                  <p className="text-muted-foreground">
                    Exa type: <span className="font-mono">{exaResults.analysis.effectiveSearchType}</span>
                    {exaResults.analysis.inferredLocation ? (<> · region <span className="font-mono">{exaResults.analysis.inferredLocation}</span></>) : null}
                  </p>
                  <p className="text-muted-foreground line-clamp-2" title={exaResults.analysis.optimizedQuery}>Query sent: {exaResults.analysis.optimizedQuery}</p>
                </div>
              )}

              {exaResults?.metadata && (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1">
                  <p className="font-medium text-foreground">Search analytics</p>
                  <p className="text-muted-foreground">
                    Found {exaResults.metadata.totalFound} results · {exaResults.metadata.searchDurationMs < 1000 ? `${exaResults.metadata.searchDurationMs}ms` : `${(exaResults.metadata.searchDurationMs / 1000).toFixed(1)}s`}
                    {exaResults.metadata.cachedResult ? " · cached" : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Quality: {exaResults.metadata.rankingStats.highQuality} high · {exaResults.metadata.rankingStats.mediumQuality} medium · {exaResults.metadata.rankingStats.filtered} filtered
                  </p>
                  <p className="text-muted-foreground">
                    Apply: {exaResults.metadata.applyTypeBreakdown.ats} easy · {exaResults.metadata.applyTypeBreakdown.external} external · {exaResults.metadata.applyTypeBreakdown.unknown} unknown
                  </p>
                  {exaResults.metadata.cities.length > 0 && (
                    <p className="text-muted-foreground">Cities: {exaResults.metadata.cities.join(", ")}</p>
                  )}
                  {exaResults.metadata.companies.length > 0 && (
                    <p className="text-muted-foreground">Companies: {exaResults.metadata.companies.join(", ")}</p>
                  )}
                </div>
              )}

              {exaResults && exaResults.results.length > 0 && (
                <ul className="space-y-3 pt-2 border-t">
                  {exaResults.results.map((hit) => {
                    const source = getHostname(hit.url);
                    const snippets = jobSnippets(hit);
                    const badges = jobBadges(hit);
                    const published = formatPublishedDate(hit.publishedDate);
                    const matchInfo = matchScores.get(hit.url);
                    return (
                  <li key={hit.url} className="group rounded-2xl border bg-card p-5 text-sm shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer" onClick={() => { setDetailHit(hit); setDetailOpen(true); }}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {hit.favicon ? (<img src={hit.favicon} alt="" className="h-5 w-5 rounded-sm" />) : null}
                              <Badge variant="outline" className="max-w-[220px] truncate font-normal">{source}</Badge>
                              {hit.applyType === "ats" && (
                                <Badge variant="secondary" className="text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-[11px]">Easy Apply</Badge>
                              )}
                              {hit.salary && (
                                <Badge variant="secondary" className="text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-[11px]">{hit.salary}</Badge>
                              )}
                              {matchInfo && !matchInfo.loading && matchInfo.score > 0 && (
                                <Badge variant="secondary" className={matchInfo.score >= 70 ? "text-green-700 bg-green-50 border-green-200" : matchInfo.score >= 45 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-red-700 bg-red-50 border-red-200"}>
                                  {matchInfo.score}% match
                                </Badge>
                              )}
                              {published ? (<span className="text-xs text-muted-foreground">Posted {published}</span>) : null}
                            </div>
                            <a href={hit.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1.5 text-base font-semibold leading-snug text-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
                              <span>{cleanJobText(hit.title)}</span>
                              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
                            </a>
                            {badges.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {badges.map((badge) => (<Badge key={`${hit.url}-${badge}`} variant="secondary" className="text-[11px] font-medium">{badge}</Badge>))}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {!matchInfo && form.getValues("resumeText")?.length >= 50 && (
                              <Button type="button" size="sm" variant="ghost" className="text-[11px]" onClick={() => preScreenHit(hit)}>Match</Button>
                            )}
                            {matchInfo?.loading && <span className="text-[11px] text-muted-foreground px-2">...</span>}
                            <Button type="button" size="sm" variant="ghost" onClick={() => saveJob(hit)} title="Save job"><Bookmark className="w-3.5 h-3.5" /></Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => fetchJob.mutate({ data: { url: hit.url } })} disabled={fetchJob.isPending}>
                              {fetchJob.isPending ? "..." : "Import JD"}
                            </Button>
                          </div>
                        </div>
                        {snippets.length > 0 ? (
                          <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                            {snippets.map((snippet, i) => (<p key={`${hit.url}-snippet-${i}`}>{snippet}</p>))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-muted-foreground">Click to view details, or import into the job description form.</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {exaResults && exaResults.results.length === 0 && (
                <p className="text-sm text-muted-foreground pt-2 border-t">No results. Try a broader query or a different search mode.</p>
              )}

              {exaResults?.hasMore && (
                <Button type="button" variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
                  <ChevronDown className="w-4 h-4 mr-1.5" /> {loadingMore ? "Loading..." : "Load more results"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card variant="elevated" hover="lift" className="border shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" /> Resume Upload
              </CardTitle>
              <CardDescription>
                Upload your resume in PDF, LaTeX, or TXT format. We'll parse it automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                className={cn(
                  "relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300",
                  isParsingResume ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/50"
                )}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className={cn(
                    "rounded-full p-4 transition-all duration-300",
                    isParsingResume ? "bg-primary/10 animate-pulse" : "bg-muted"
                  )}>
                    <Upload className={cn(
                      "h-8 w-8 transition-colors",
                      isParsingResume ? "text-primary animate-bounce" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-semibold">
                      {isParsingResume ? "Reading your resume..." : "Drag & drop your resume here"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse files
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    variant="gradient" 
                    size="lg"
                    disabled={isParsingResume} 
                    asChild
                  >
                    <label className="cursor-pointer">
                      {isParsingResume ? "Processing..." : "Choose File"}
                      <Input type="file" accept=".pdf,.tex,.latex,.txt" className="hidden" onChange={onResumeFileChange} />
                    </label>
                  </Button>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" size="sm">PDF</Badge>
                    <Badge variant="secondary" size="sm">LaTeX</Badge>
                    <Badge variant="secondary" size="sm">TXT</Badge>
                  </div>
                </div>
                {resumeFileName && (
                  <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-success/10 border border-success/20 p-3 animate-bounce-in">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                      <FileText className="h-5 w-5 text-success" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{resumeFileName}</p>
                      <p className="text-xs text-muted-foreground">Successfully uploaded</p>
                    </div>
                    <Badge variant="success" size="sm">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Ready
                    </Badge>
                  </div>
                )}
                {resumeFileError && (
                  <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    {resumeFileError}
                  </div>
                )}
              </div>
              
              <FormField control={form.control} name="resumeText" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Parsed Resume Text</FormLabel>
                  <FormControl>
                    <Textarea 
                      className="min-h-[220px] font-mono text-sm rounded-xl border-2 focus:border-primary transition-colors" 
                      placeholder="Your resume content will appear here after upload..." 
                      {...field} 
                      data-testid="textarea-resume" 
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Tip: PDFs are converted to LaTeX during optimization. LaTeX files preserve structure perfectly.
                  </p>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              type="submit" 
              variant="gradient" 
              size="xl" 
              disabled={createAnalysis.isPending} 
              loading={createAnalysis.isPending}
              data-testid="button-analyze"
              className="shadow-xl hover:shadow-2xl"
            >
              {!createAnalysis.isPending && (
                <>
                  <Wand2 className="h-5 w-5" />
                  Optimize Resume with AI
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Recent Optimizations</h2>
            <p className="text-sm text-muted-foreground mt-1">Each optimization is automatically added to your tracker.</p>
          </div>
          <Button variant="gradient" size="sm" onClick={() => setLocation("/tracker")} className="shadow-md">
            <LayoutGrid className="w-4 h-4" />
            Open Tracker
          </Button>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton variant="shimmer" className="h-32 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <Card variant="elevated" className="text-center py-16 border-2 border-dashed">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-primary/10 p-6">
                <Sparkles className="w-12 h-12 text-primary animate-pulse" />
              </div>
              <div>
                <p className="text-lg font-semibold">No optimized resumes yet</p>
                <p className="text-sm text-muted-foreground mt-2">Upload your resume and run your first optimization above.</p>
              </div>
              <Button variant="gradient" size="lg" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="mt-2">
                <Wand2 className="w-4 h-4" />
                Get Started
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recent.map((a) => (
              <Card 
                key={a.id} 
                variant="elevated" 
                hover="lift"
                className="group cursor-pointer overflow-hidden"
                onClick={() => setLocation(`/analysis/${a.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <ScoreCircle score={a.atsScore} size="sm" />
                      <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-success border-2 border-background" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="font-bold text-base truncate group-hover:text-primary transition-colors">{a.jobTitle}</p>
                        <p className="text-sm text-muted-foreground truncate">{a.companyName}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" size="sm">
                          Fit {a.fitScore}%
                        </Badge>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <JobDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        hit={detailHit}
        onImport={(url) => fetchJob.mutate({ data: { url } })}
        matchScore={detailHit ? matchScores.get(detailHit.url)?.score ?? null : null}
        matchLoading={detailHit ? matchScores.get(detailHit.url)?.loading ?? false : false}
      />
    </div>
  );
}
