import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateAnalysis, useListAnalyses, useDeleteAnalysis, getListAnalysesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreCircle } from "@/components/score-circle";
import { Sparkles, Trash2, ArrowRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const formSchema = z.object({
  jobTitle: z.string().min(1, "Job title is required"),
  companyName: z.string().optional(),
  resumeText: z.string().min(50, "Resume must be at least 50 characters"),
  jobDescriptionText: z.string().min(50, "Job description must be at least 50 characters"),
});

type FormValues = z.infer<typeof formSchema>;

export function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

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

  const deleteAnalysis = useDeleteAnalysis({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
    },
  });

  const { data: analyses, isLoading } = useListAnalyses();

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
                        <Textarea
                          placeholder="Paste your resume text here..."
                          className="min-h-[260px] font-mono text-sm resize-none"
                          {...field}
                          data-testid="textarea-resume"
                        />
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
                        <Textarea
                          placeholder="Paste the job description here..."
                          className="min-h-[260px] font-mono text-sm resize-none"
                          {...field}
                          data-testid="textarea-jd"
                        />
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
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze Fit
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

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
                    <p className="font-semibold truncate">{a.jobTitle}</p>
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
