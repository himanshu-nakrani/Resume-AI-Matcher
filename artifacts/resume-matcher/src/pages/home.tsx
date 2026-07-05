import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  Link2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  apiErrorMessage,
  unknownErrorMessage,
  type ApiErrorPayload,
} from "@/lib/api-error";
import { cn } from "@/lib/utils";

import {
  USER_STORAGE_KEY,
  formSchema,
  normalizeJobSearchResponse,
  fallbackJobDescriptionFromHit,
  inferRoleAndCompany,
  getHostname,
} from "./home/helpers";
import type { FormValues, JobSearchHit } from "./home/helpers";
import { RecentAnalysesStrip, JobSearchSection } from "./home/sections";

type ResumeFileType = "pdf" | "latex" | "text";

function stripLatexToText(source: string) {
  return source
    .replace(/%.*$/gm, " ")
    .replace(
      /\\(section|subsection|textbf|textit|emph|item)\*?\{([^}]*)\}/g,
      "$2",
    )
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function parsePdf(file: File) {
  const [{ GlobalWorkerOptions, getDocument }, { default: pdfWorkerUrl }] =
    await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.mjs?url"),
    ]);
  const bytes = new Uint8Array(await file.arrayBuffer());
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await getDocument({ data: bytes }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
  }

  return pages
    .join("\n\n")
    .replace(/\s{3,}/g, " ")
    .trim();
}

export function Home() {
  const [, setLocation] = useLocation();
  const search = useSearch();
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
  const [exaType, setExaType] = useState<JobSearchBodySearchType>(
    JobSearchBodySearchType.auto,
  );
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
  const [jobSearchOpen, setJobSearchOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [matchScores, setMatchScores] = useState<
    Map<string, { score: number; loading: boolean }>
  >(new Map());

  const savedUser = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem(USER_STORAGE_KEY) ?? "{}",
      ) as Partial<FormValues>;
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
  const watchedValues = form.watch();
  const profileReady = Boolean(
    watchedValues.userName?.trim() && watchedValues.userEmail?.trim(),
  );
  const resumeCharacterCount = watchedValues.resumeText?.trim().length ?? 0;
  const jobDescriptionCharacterCount =
    watchedValues.jobDescriptionText?.trim().length ?? 0;
  const resumeReady = resumeCharacterCount >= 50;
  const roleReady = Boolean(
    watchedValues.jobTitle?.trim() && watchedValues.companyName?.trim(),
  );
  const jobReady = jobDescriptionCharacterCount >= 50;
  const readinessSteps = [
    { label: "Profile", complete: profileReady },
    { label: "Resume", complete: resumeReady },
    { label: "Role", complete: roleReady },
    { label: "JD", complete: jobReady },
  ];
  const completedStepCount = readinessSteps.filter(
    (step) => step.complete,
  ).length;
  const readyToAnalyze = completedStepCount === readinessSteps.length;

  useEffect(() => {
    const subscription = form.watch((values) => {
      localStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify({
          userName: values.userName ?? "",
          userEmail: values.userEmail ?? "",
        }),
      );
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    const panel = new URLSearchParams(search).get("panel");
    if (panel !== "jobs") return;

    setJobSearchOpen(true);
  }, [search]);

  useEffect(() => {
    const panel = new URLSearchParams(search).get("panel");
    if (panel !== "jobs" || !jobSearchOpen) return;

    window.requestAnimationFrame(() => {
      document
        .getElementById("job-search")
        ?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }, [jobSearchOpen, search]);

  const createAnalysis = useCreateAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        toast({
          title: "Resume optimized",
          description:
            "A tracker entry was created automatically. Add deadlines or status next.",
        });
        setLocation(`/analysis/${data.id}`);
      },
      onError: (error) => {
        toast({
          title: "Optimization failed",
          description: unknownErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      },
    },
  });

  const fetchJob = useFetchJobDescription({
    mutation: {
      onSuccess: (data) => {
        form.setValue("jobDescriptionText", data.jobDescription, {
          shouldDirty: true,
          shouldValidate: true,
        });
        if (data.jobTitle && !form.getValues("jobTitle"))
          form.setValue("jobTitle", data.jobTitle);
        if (data.companyName && !form.getValues("companyName"))
          form.setValue("companyName", data.companyName);
        setShowUrlInput(false);
        setJobUrlInput("");
        toast({
          title: "Job description imported",
          description: "Company, role, and JD were extracted from the URL.",
        });
      },
      onError: (err, variables) => {
        const url = variables?.data.url;
        const hit = exaResults?.results.find((result) => result.url === url);
        if (hit) {
          const fallbackText = fallbackJobDescriptionFromHit(hit);
          const { jobTitle, companyName } = inferRoleAndCompany(hit);
          form.setValue("jobDescriptionText", fallbackText, {
            shouldDirty: true,
            shouldValidate: true,
          });
          if (!form.getValues("jobTitle")) form.setValue("jobTitle", jobTitle);
          if (!form.getValues("companyName"))
            form.setValue("companyName", companyName);
          toast({
            title: "Imported search preview",
            description:
              "The source blocked full extraction, so we filled the form from the processed search result.",
          });
          return;
        }
        toast({
          title: "Could not import",
          description: unknownErrorMessage(
            err,
            "That page blocked extraction. Paste the JD manually or use a result from job search.",
          ),
          variant: "destructive",
        });
      },
    },
  });

  const jobSearchExa = useSearchJobs({
    mutation: {
      onSuccess: (data, variables) => {
        const payload = normalizeJobSearchResponse(data, variables.data.query);
        setExaResults(payload);
        const { analysis } = payload;
        toast({
          title: "Job search complete",
          description: `${payload.results.length} listing(s) · ${analysis.effectiveSearchType}${analysis.inferredLocation ? ` · ${analysis.inferredLocation}` : ""}`,
        });
      },
      onError: (err: unknown) => {
        toast({
          title: "Job search failed",
          description: unknownErrorMessage(err, "Job search failed."),
          variant: "destructive",
        });
      },
    },
  });

  const handleExaJobSearch = (offset?: number) => {
    const q = exaQuery.trim();
    if (q.length < 2) {
      toast({
        title: "Add a search query",
        description:
          "Describe the role, level, location, or company you want (at least 2 characters).",
        variant: "destructive",
      });
      return;
    }
    const loc = exaUserLocation.trim().toUpperCase();
    if (loc.length > 0 && loc.length !== 2) {
      toast({
        title: "Use a 2-letter country code",
        description:
          "Examples: US, IN, GB, CA. Leave it blank to let the prompt decide.",
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
      const data = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        throw new Error(
          apiErrorMessage(
            data as ApiErrorPayload | null,
            "Could not load more job results.",
          ),
        );
      }
      if (data) {
        const payload = normalizeJobSearchResponse(data, exaQuery.trim());
        setExaResults((prev) =>
          prev
            ? {
                ...payload,
                results: [...prev.results, ...payload.results],
              }
            : payload,
        );
      }
    } catch (err) {
      toast({
        title: "Could not load more jobs",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setLoadingMore(false);
    }
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
        toast({
          title: "Already saved",
          description: "This job is already in your saved list.",
        });
      } else {
        const data = (await res
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        throw new Error(apiErrorMessage(data, "Could not save this job."));
      }
    } catch (err) {
      toast({
        title: "Could not save",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const preScreenHit = async (hit: JobSearchHit) => {
    const resumeText = form.getValues("resumeText");
    if (!resumeText || resumeText.length < 50) {
      toast({
        title: "Upload a resume first",
        description: "Upload your resume to see match estimates.",
      });
      return;
    }
    setMatchScores((prev) =>
      new Map(prev).set(hit.url, { score: 0, loading: true }),
    );
    try {
      const res = await fetch("/api/job-search/pre-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobUrl: hit.url }),
      });
      const data = (await res.json().catch(() => null)) as
        | ({ matchScore?: unknown } & ApiErrorPayload)
        | null;
      if (!res.ok) {
        throw new Error(
          apiErrorMessage(data, "Could not estimate this job match."),
        );
      }
      const matchScore = Number(data?.matchScore);
      if (!Number.isFinite(matchScore)) {
        throw new Error(
          "The pre-screen response did not include a match score.",
        );
      }
      setMatchScores((prev) =>
        new Map(prev).set(hit.url, { score: matchScore, loading: false }),
      );
    } catch (err) {
      setMatchScores((prev) =>
        new Map(prev).set(hit.url, { score: 0, loading: false }),
      );
      toast({
        title: "Could not estimate match",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const { data: analyses } = useListAnalyses();

  const onResumeFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
        form.setValue("resumeText", text, {
          shouldDirty: true,
          shouldValidate: true,
        });
        form.setValue("sourceLatex", "", { shouldDirty: true });
      } else if (ext === "tex" || ext === "latex") {
        const latex = await file.text();
        setResumeFileType("latex");
        form.setValue("sourceLatex", latex, { shouldDirty: true });
        form.setValue("resumeText", stripLatexToText(latex), {
          shouldDirty: true,
          shouldValidate: true,
        });
      } else if (ext === "txt") {
        const text = await file.text();
        setResumeFileType("text");
        form.setValue("resumeText", text.trim(), {
          shouldDirty: true,
          shouldValidate: true,
        });
        form.setValue("sourceLatex", "", { shouldDirty: true });
      } else {
        throw new Error("Unsupported file");
      }
    } catch {
      setResumeFileError(
        "Could not read that resume. Upload a PDF, .tex, .latex, or TXT file.",
      );
      setResumeFileName("");
    } finally {
      setIsParsingResume(false);
      event.target.value = "";
    }
  };

  const handleImportUrl = () => {
    if (jobUrlInput.trim())
      fetchJob.mutate({ data: { url: jobUrlInput.trim() } });
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
    <div className="mx-auto max-w-6xl space-y-0">
      <section className="mb-6 overflow-hidden rounded-lg border border-border bg-surface-1 shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/20 bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent">
                <ClipboardCheck className="h-3 w-3" />
                {readyToAnalyze
                  ? "Ready to optimize"
                  : `${completedStepCount}/4 ready`}
              </span>
              {resumeFileName && (
                <span className="truncate text-[11px] text-muted-foreground">
                  {resumeFileName}
                </span>
              )}
            </div>
            <div className="max-w-2xl">
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">
                Optimize your resume
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                Build one targeted version for the role, then use the analysis
                to track follow-up work.
              </p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {readinessSteps.map((step) => {
                const Icon = step.complete ? CheckCircle2 : Circle;
                return (
                  <div
                    key={step.label}
                    className={cn(
                      "flex h-10 items-center gap-2 rounded-md border px-3 text-[12px] transition-colors",
                      step.complete
                        ? "border-accent/25 bg-accent/10 text-foreground"
                        : "border-border bg-surface-2 text-muted-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        step.complete && "text-accent",
                      )}
                    />
                    <span className="truncate font-medium">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="border-t border-border bg-surface-2/70 p-5 lg:border-l lg:border-t-0">
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">
                  Resume
                </p>
                <p className="mt-1 text-lg font-semibold tabular">
                  {resumeCharacterCount.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground">characters</p>
              </div>
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">
                  Job brief
                </p>
                <p className="mt-1 text-lg font-semibold tabular">
                  {jobDescriptionCharacterCount.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground">characters</p>
              </div>
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">
                  Run state
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {createAnalysis.isPending
                    ? "Optimizing"
                    : readyToAnalyze
                      ? "Ready"
                      : "Draft"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {readyToAnalyze ? "All inputs set" : "Missing inputs"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 pb-24 md:pb-0"
          data-testid="form-analysis"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            {/* LEFT column */}
            <div className="space-y-6">
              <Card className="border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <UserRound className="h-4 w-4 text-accent" /> Candidate
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="userName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="userEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-accent" /> Resume
                  </CardTitle>
                  <CardDescription className="text-sm">
                    PDF, LaTeX, and TXT are supported.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div
                    className={cn(
                      "relative rounded-lg border border-dashed p-6 text-center transition-all duration-200",
                      isParsingResume
                        ? "border-accent bg-accent/5"
                        : "border-border bg-surface-2/60 hover:border-accent/50 hover:bg-surface-2",
                    )}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div
                        className={cn(
                          "rounded-lg p-3 transition-all duration-200",
                          isParsingResume ? "bg-accent/10" : "bg-surface-3",
                        )}
                      >
                        <Upload
                          className={cn(
                            "h-6 w-6 transition-colors",
                            isParsingResume
                              ? "text-accent"
                              : "text-muted-foreground",
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {isParsingResume
                            ? "Reading your resume..."
                            : "Drop in a resume file"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Browse files or paste text below
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
                          <Input
                            type="file"
                            accept=".pdf,.tex,.latex,.txt"
                            className="hidden"
                            onChange={onResumeFileChange}
                          />
                        </label>
                      </Button>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                        {["PDF", "LaTeX", "TXT"].map((type) => (
                          <span
                            key={type}
                            className="rounded border border-border bg-background px-1.5 py-0.5"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                    {resumeFileName && (
                      <div className="mt-4 flex items-center gap-3 rounded-lg bg-success/10 border border-success/20 p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-success/20">
                          <FileText className="h-4 w-4 text-success" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium text-sm truncate">
                            {resumeFileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Successfully uploaded
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-success font-medium">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
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

                  <FormField
                    control={form.control}
                    name="resumeText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Parsed Resume Text
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-[200px] font-mono text-sm rounded-md border focus:border-primary transition-colors"
                            placeholder="Your resume content will appear here after upload..."
                            {...field}
                            data-testid="textarea-resume"
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground mt-2 tabular">
                          {resumeCharacterCount.toLocaleString()} characters
                          parsed
                        </p>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* RIGHT column */}
            <div className="space-y-6">
              <Card className="border shadow-sm lg:sticky lg:top-16">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <BriefcaseBusiness className="h-4 w-4 text-accent" /> Target
                    role
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Acme Corp"
                              {...field}
                              data-testid="input-company-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Backend Engineer"
                              {...field}
                              data-testid="input-job-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowUrlInput((v) => !v)}
                        aria-expanded={showUrlInput}
                        aria-controls="job-url-import-panel"
                      >
                        <Link2 className="h-3.5 w-3.5 mr-1.5" /> Import JD from
                        URL
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        or paste the JD
                      </span>
                    </div>
                    {showUrlInput && (
                      <div id="job-url-import-panel" className="flex gap-2">
                        <label htmlFor="job-url-import" className="sr-only">
                          Job description URL
                        </label>
                        <Input
                          id="job-url-import"
                          value={jobUrlInput}
                          onChange={(e) => setJobUrlInput(e.target.value)}
                          placeholder="https://company.com/jobs/role"
                        />
                        <Button
                          type="button"
                          onClick={handleImportUrl}
                          disabled={fetchJob.isPending || !jobUrlInput.trim()}
                        >
                          {fetchJob.isPending ? "Importing..." : "Import"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowUrlInput(false)}
                          aria-label="Close job URL import"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <FormField
                      control={form.control}
                      name="jobDescriptionText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Description</FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[248px] font-mono text-sm"
                              placeholder="Paste the full JD here..."
                              {...field}
                              data-testid="textarea-jd"
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground mt-2 tabular">
                            {jobDescriptionCharacterCount.toLocaleString()}{" "}
                            characters
                          </p>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Submit button — desktop in-flow */}
          <div className="hidden items-center justify-between rounded-lg border border-border bg-surface-1 p-3 shadow-sm md:flex">
            <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
              <ClipboardCheck
                className={cn(
                  "h-4 w-4 shrink-0",
                  readyToAnalyze && "text-accent",
                )}
              />
              <span className="truncate">
                {readyToAnalyze
                  ? "Inputs are ready for optimization."
                  : `Complete ${readinessSteps.length - completedStepCount} sections to run analysis.`}
              </span>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={createAnalysis.isPending || !readyToAnalyze}
              loading={createAnalysis.isPending}
            >
              Analyze
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Submit button — mobile sticky */}
          <div className="fixed md:hidden bottom-16 left-0 right-0 z-30 border-t border-border bg-surface-1 p-4">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={createAnalysis.isPending || !readyToAnalyze}
              loading={createAnalysis.isPending}
            >
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
        isOpen={jobSearchOpen}
        onOpenChange={setJobSearchOpen}
        onSearch={() => handleExaJobSearch()}
        onLoadMore={loadMore}
        onSaveJob={saveJob}
        onPreScreen={preScreenHit}
        onImportJd={(url) => fetchJob.mutate({ data: { url } })}
      />
    </div>
  );
}
