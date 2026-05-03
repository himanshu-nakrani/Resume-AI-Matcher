import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateAnalysis, useListAnalyses, useDeleteAnalysis, getListAnalysesQueryKey, useFetchJobDescription } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreCircle } from "@/components/score-circle";
import { Sparkles, Trash2, ArrowRight, Clock, Upload, Link2, X, Heart, AlertCircle, CalendarClock } from "lucide-react";
import { formatDistanceToNow, format, isWithinInterval, addDays, isPast } from "date-fns";
import mammoth from "mammoth";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  jobTitle: z.string().min(1, "Job title is required"),
  companyName: z.string().optional(),
  resumeText: z.string().min(50, "Resume must be at least 50 characters"),
  jobDescriptionText: z.string().min(50, "Job description must be at least 50 characters"),
});

type FormValues = z.infer<typeof formSchema>;
const allowedResumeTypes = [".docx", ".txt"].join(",");

export function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeFileError, setResumeFileError] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [jobUrlInput, setJobUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { jobTitle: "", companyName: "", resumeText: "", jobDescriptionText: "" },
  });

  const createAnalysis = useCreateAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        setLocation(`/analysis/${data.id}`);
      },
    },
  });

  const fetchJob = useFetchJobDescription({
    mutation: {
      onSuccess: (data) => {
        form.setValue("jobDescriptionText", data.jobDescription, { shouldDirty: true, shouldValidate: true });
        if (data.jobTitle && !form.getValues("jobTitle")) {
          form.setValue("jobTitle", data.jobTitle);
        }
        if (data.companyName && !form.getValues("companyName")) {
          form.setValue("companyName", data.companyName ?? "");
        }
        setShowUrlInput(false);
        setJobUrlInput("");
        toast({ title: "Job description imported", description: "Fields filled from the URL." });
      },
      onError: () => {
        toast({ title: "Could not import", description: "Try copying the job description manually.", variant: "destructive" });
      },
    },
  });

  const deleteAnalysis = useDeleteAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
    },
  });

  const { data: analyses, isLoading } = useListAnalyses();

  const parseResumeFile = async (file: File) => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext === "txt") return await file.text();
    if (ext === "docx") {
      try {
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        return result.value;
      } catch {
        throw new Error("Could not read DOCX file. Please ensure it's a valid Word document.");
      }
    }
    throw new Error("Please upload a DOCX or TXT file. For PDFs, copy the text and paste it above.");
  };

  const onResumeFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setResumeFileError("");
    setIsParsingResume(true);
    try {
      const parsed = await parseResumeFile(file);
      form.setValue("resumeText", parsed.trim(), { shouldDirty: true, shouldValidate: true });
      setResumeFileName(file.name);
    } catch {
      setResumeFileError("Could not read that file. Please upload a DOCX or TXT resume.");
      setResumeFileName("");
    } finally {
      setIsParsingResume(false);
      event.target.value = "";
    }
  };

  const handleImportUrl = () => {
    if (!jobUrlInput.trim()) return;
    fetchJob.mutate({ data: { url: jobUrlInput.trim() } });
  };

  const onSubmit = (values: FormValues) => {
    createAnalysis.mutate({
      data: {
        jobTitle: values.jobTitle,
        companyName: values.companyName ?? "",
        resumeText: values.resumeText,
        jobDescriptionText: values.jobDescriptionText,
      },
    });
  };

  const favorites = analyses?.filter((a) => a.isFavorite) ?? [];

  const now = new Date();
  const in7Days = addDays(now, 7);
  const upcomingDeadlines = analyses?.filter((a) => {
    if (!a.deadline) return false;
    const d = new Date(a.deadline);
    return isWithinInterval(d, { start: now, end: in7Days }) || isPast(d);
  }).sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()) ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Analysis</h1>
        <p className="text-muted-foreground mt-1">Paste your resume and job description to get an AI-powered fit score and recommendations.</p>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-analysis">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Senior Software Engineer" {...field} data-testid="input-job-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Corp" {...field} data-testid="input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="resumeText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resume <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <Button type="button" variant="secondary" disabled={isParsingResume} asChild>
                              <label className="cursor-pointer">
                                <Upload className="w-4 h-4 mr-2" />
                                {isParsingResume ? "Reading file..." : "Upload resume"}
                                <Input type="file" accept={allowedResumeTypes} className="hidden" onChange={onResumeFileChange} />
                              </label>
                            </Button>
                            {resumeFileName && <Badge variant="outline">{resumeFileName}</Badge>}
                            <span className="text-xs text-muted-foreground">DOCX or TXT (PDF: paste text)</span>
                          </div>
                          <Textarea
                            placeholder="Paste your resume text here..."
                            className="min-h-[260px] font-mono text-sm resize-none"
                            {...field}
                            data-testid="textarea-resume"
                          />
                          {resumeFileError && <p className="text-sm text-destructive">{resumeFileError}</p>}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="jobDescriptionText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Description <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setShowUrlInput(!showUrlInput)}
                            >
                              <Link2 className="w-3.5 h-3.5 mr-1.5" />
                              Import from URL
                            </Button>
                            <span className="text-xs text-muted-foreground">or paste below</span>
                          </div>
                          {showUrlInput && (
                            <div className="flex gap-2">
                              <Input
                                placeholder="https://jobs.company.com/role/12345"
                                value={jobUrlInput}
                                onChange={(e) => setJobUrlInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleImportUrl()}
                                className="flex-1 text-sm"
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleImportUrl}
                                disabled={fetchJob.isPending || !jobUrlInput.trim()}
                              >
                                {fetchJob.isPending ? "Importing..." : "Import"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                onClick={() => { setShowUrlInput(false); setJobUrlInput(""); }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                          <Textarea
                            placeholder="Paste the job description here..."
                            className="min-h-[260px] font-mono text-sm resize-none"
                            {...field}
                            data-testid="textarea-jd"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto"
                disabled={createAnalysis.isPending}
                data-testid="button-analyze"
              >
                {createAnalysis.isPending ? (
                  <><Sparkles className="w-4 h-4 mr-2 animate-pulse" />Analyzing with AI...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Analyze Fit</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Upcoming Deadlines */}
      {upcomingDeadlines.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold tracking-tight mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-500" /> Upcoming Deadlines
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 text-xs ml-1">
              {upcomingDeadlines.length}
            </Badge>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingDeadlines.map((a) => {
              const deadlineDate = new Date(a.deadline!);
              const overdue = isPast(deadlineDate);
              return (
                <Card
                  key={a.id}
                  className={`group border shadow-sm hover:shadow-md transition-shadow cursor-pointer ${overdue ? "border-destructive/40 bg-destructive/5" : "border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-900/10"}`}
                  onClick={() => setLocation(`/analysis/${a.id}`)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <CalendarClock className={`w-4 h-4 shrink-0 ${overdue ? "text-destructive" : "text-orange-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{a.jobTitle}</p>
                      {a.companyName && <p className="text-xs text-muted-foreground truncate">{a.companyName}</p>}
                      <p className={`text-xs font-medium mt-0.5 ${overdue ? "text-destructive" : "text-orange-600 dark:text-orange-400"}`}>
                        {overdue ? "Overdue — " : "Due "}{format(deadlineDate, "MMM d, yyyy")}
                      </p>
                    </div>
                    <ScoreCircle score={a.fitScore} size="sm" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Favorites */}
      {favorites.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold tracking-tight mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500 fill-pink-500" /> Favorites
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {favorites.slice(0, 4).map((a) => (
              <Card
                key={a.id}
                className="group border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/analysis/${a.id}`)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <ScoreCircle score={a.fitScore} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{a.jobTitle}</p>
                    {a.companyName && <p className="text-sm text-muted-foreground truncate">{a.companyName}</p>}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Analyses */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight mb-4">Recent Analyses</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : !analyses || analyses.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No analyses yet</p>
            <p className="text-sm mt-1">Run your first analysis above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analyses.slice(0, 6).map((a) => (
              <Card
                key={a.id}
                className="group border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/analysis/${a.id}`)}
                data-testid={`card-analysis-${a.id}`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <ScoreCircle score={a.fitScore} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold truncate">{a.jobTitle}</p>
                      {a.isFavorite && <Heart className="w-3 h-3 text-pink-500 fill-pink-500 shrink-0" />}
                    </div>
                    {a.companyName && <p className="text-sm text-muted-foreground truncate">{a.companyName}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                      <Badge variant="outline" className="text-xs ml-1">ATS {a.atsScore}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAnalysis.mutate({ id: a.id });
                      }}
                      data-testid={`button-delete-${a.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
