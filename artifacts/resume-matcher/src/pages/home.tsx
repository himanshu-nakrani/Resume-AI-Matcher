import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { useCreateAnalysis, useListAnalyses, getListAnalysesQueryKey, useFetchJobDescription } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreCircle } from "@/components/score-circle";
import { ArrowRight, BriefcaseBusiness, FileText, KeyRound, Link2, Sparkles, Upload, UserRound, Wand2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const USER_STORAGE_KEY = "optimatch_user_profile";
const DEEPSEEK_KEY_STORAGE_KEY = "optimatch_deepseek_api_key";

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
      onError: () => toast({ title: "Could not import", description: "Paste the JD manually instead.", variant: "destructive" }),
    },
  });

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
      <section className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8 shadow-sm">
        <div className="max-w-3xl">
          <Badge variant="secondary" className="mb-4">Resume AI Matcher</Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Upload once. Tailor every resume for the role.
          </h1>
          <p className="mt-4 text-muted-foreground text-base md:text-lg">
            Sign in locally, upload PDF or LaTeX, paste the JD, and DeepSeek will generate an ATS-focused LaTeX resume plus a tracker entry for the company and role.
          </p>
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
                <FileText className="h-4 w-4 text-primary" /> Resume Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" disabled={isParsingResume} asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    {isParsingResume ? "Reading file..." : "Upload PDF or LaTeX"}
                    <Input type="file" accept=".pdf,.tex,.latex,.txt" className="hidden" onChange={onResumeFileChange} />
                  </label>
                </Button>
                {resumeFileName && <Badge variant="outline">{resumeFileName}</Badge>}
                <span className="text-xs text-muted-foreground">
                  PDFs are converted to editable LaTeX during optimization. LaTeX files preserve structure.
                </span>
              </div>
              {resumeFileError && <p className="text-sm text-destructive">{resumeFileError}</p>}
              <FormField control={form.control} name="resumeText" render={({ field }) => (
                <FormItem>
                  <FormLabel>Parsed Resume Text</FormLabel>
                  <FormControl><Textarea className="min-h-[220px] font-mono text-sm" placeholder="Parsed resume text appears here..." {...field} data-testid="textarea-resume" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={createAnalysis.isPending} data-testid="button-analyze">
              {createAnalysis.isPending ? (
                <><Sparkles className="h-4 w-4 mr-2 animate-pulse" />Optimizing with DeepSeek...</>
              ) : (
                <><Wand2 className="h-4 w-4 mr-2" />Optimize Resume</>
              )}
            </Button>
          </div>
        </form>
      </Form>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Recent Optimizations</h2>
            <p className="text-sm text-muted-foreground">Each optimization is automatically added to the tracker.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/tracker")}>Open Tracker</Button>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-14 border border-dashed rounded-2xl text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No optimized resumes yet</p>
            <p className="text-sm mt-1">Run your first optimization above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recent.map((a) => (
              <Card key={a.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation(`/analysis/${a.id}`)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <ScoreCircle score={a.atsScore} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{a.jobTitle}</p>
                    <p className="text-sm text-muted-foreground truncate">{a.companyName}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
