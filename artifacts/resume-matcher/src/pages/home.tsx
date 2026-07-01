import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  useCreateAnalysis,
  useListAnalyses,
  getListAnalysesQueryKey,
  useFetchJobDescription,
  useSearchJobs,
  JobSearchBodySearchType,
} from "@workspace/api-client-react";
import type { JobSearchResponse } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BriefcaseBusiness, FileText, Link2, Upload, UserRound, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import {
  USER_STORAGE_KEY,
  formSchema,
  jobSearchResponseWithAnalysis,
  fallbackJobDescriptionFromHit,
  inferRoleAndCompany,
  getHostname,
} from "./home/helpers";
import type { FormValues, JobSearchHit } from "./home/helpers";
import { RecentAnalysesStrip, JobSearchSection } from "./home/sections";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
      onError: (error) => {
        const envelope =
          (error as { data?: { error?: { message?: string } } } | null | undefined)?.data?.error;
        toast({
          title: "Optimization failed",
          description:
            envelope?.message ??
            (error as Error | null | undefined)?.message ??
            "Please try again.",
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

  const { data: analyses } = useListAnalyses();

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
        jobDescriptionText: values.jobDescriptionText,
      },
    });
  };

  return (
    <div className="space-y-0 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Optimize your resume</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Paste your resume and a job to see your fit score and improvement plan.
        </p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-24 md:pb-0" data-testid="form-analysis">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT column */}
            <div className="space-y-6">
              <Card className="border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <UserRound className="h-4 w-4 text-muted-foreground" /> User Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </CardContent>
              </Card>

              <Card className="border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-muted-foreground" /> Resume Upload
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Upload your resume in PDF, LaTeX, or TXT format. We'll parse it automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div
                    className={cn(
                      "relative rounded-lg border border-dashed p-8 text-center transition-all duration-200",
                      isParsingResume ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className={cn(
                        "rounded-lg p-3 transition-all duration-200",
                        isParsingResume ? "bg-primary/10" : "bg-muted"
                      )}>
                        <Upload className={cn(
                          "h-6 w-6 transition-colors",
                          isParsingResume ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {isParsingResume ? "Reading your resume..." : "Drag & drop your resume here"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          or click to browse files
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        disabled={isParsingResume}
                        asChild
                      >
                        <label className="cursor-pointer">
                          {isParsingResume ? "Processing..." : "Choose File"}
                          <Input type="file" accept=".pdf,.tex,.latex,.txt" className="hidden" onChange={onResumeFileChange} />
                        </label>
                      </Button>
                      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                        <span>PDF</span>
                        <span>•</span>
                        <span>LaTeX</span>
                        <span>•</span>
                        <span>TXT</span>
                      </div>
                    </div>
                    {resumeFileName && (
                      <div className="mt-4 flex items-center gap-3 rounded-lg bg-success/10 border border-success/20 p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-success/20">
                          <FileText className="h-4 w-4 text-success" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium text-sm truncate">{resumeFileName}</p>
                          <p className="text-xs text-muted-foreground">Successfully uploaded</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-success font-medium">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Ready
                        </div>
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
                      <FormLabel className="text-sm font-medium">Parsed Resume Text</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-[200px] font-mono text-sm rounded-md border focus:border-primary transition-colors"
                          placeholder="Your resume content will appear here after upload..."
                          {...field}
                          data-testid="textarea-resume"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground mt-2">
                        Tip: PDFs are converted to LaTeX during optimization. LaTeX files preserve structure perfectly.
                      </p>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </div>

            {/* RIGHT column */}
            <div className="space-y-6">
              <Card className="border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <BriefcaseBusiness className="h-4 w-4 text-muted-foreground" /> Target Job
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
            </div>
          </div>

          {/* Submit button — desktop in-flow */}
          <div className="hidden md:flex justify-end">
            <Button type="submit" size="lg" disabled={createAnalysis.isPending} loading={createAnalysis.isPending}>
              Analyze
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Submit button — mobile sticky */}
          <div className="fixed md:hidden bottom-16 left-0 right-0 z-30 border-t border-border bg-surface-1 p-4">
            <Button type="submit" size="lg" className="w-full" disabled={createAnalysis.isPending} loading={createAnalysis.isPending}>
              Analyze
            </Button>
          </div>
        </form>
      </Form>

      <RecentAnalysesStrip analyses={analyses} />

      <JobSearchSection
        exaQuery={exaQuery}
        setExaQuery={setExaQuery}
        exaRecent={exaRecent}
        setExaRecent={setExaRecent}
        exaSkipHeuristics={exaSkipHeuristics}
        setExaSkipHeuristics={setExaSkipHeuristics}
        exaType={exaType}
        setExaType={setExaType}
        exaNumResults={exaNumResults}
        setExaNumResults={setExaNumResults}
        exaUserLocation={exaUserLocation}
        setExaUserLocation={setExaUserLocation}
        exaResults={exaResults}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        exaExperienceLevel={exaExperienceLevel}
        setExaExperienceLevel={setExaExperienceLevel}
        exaJobType={exaJobType}
        setExaJobType={setExaJobType}
        exaRemote={exaRemote}
        setExaRemote={setExaRemote}
        exaSalaryMin={exaSalaryMin}
        setExaSalaryMin={setExaSalaryMin}
        exaIndustry={exaIndustry}
        setExaIndustry={setExaIndustry}
        exaCompanySize={exaCompanySize}
        setExaCompanySize={setExaCompanySize}
        detailHit={detailHit}
        setDetailHit={setDetailHit}
        detailOpen={detailOpen}
        setDetailOpen={setDetailOpen}
        loadingMore={loadingMore}
        matchScores={matchScores}
        isSearchPending={jobSearchExa.isPending}
        isFetchJobPending={fetchJob.isPending}
        hasResumeText={(form.getValues("resumeText")?.length ?? 0) >= 50}
        onSearch={() => handleExaJobSearch()}
        onLoadMore={loadMore}
        onSaveJob={saveJob}
        onPreScreen={preScreenHit}
        onImportJd={(url) => fetchJob.mutate({ data: { url } })}
      />
    </div>
  );
}
