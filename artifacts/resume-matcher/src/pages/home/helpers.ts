import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import type { JobSearchResponse, JobSearchAnalysis } from "@workspace/api-client-react";
import { JobSearchAnalysisEffectiveSearchType } from "@workspace/api-client-react";

export type JobSearchHit = JobSearchResponse["results"][number];

/** Older API servers may omit `analysis`; merge so success handlers never throw. */
export function jobSearchResponseWithAnalysis(data: JobSearchResponse, submittedQuery: string): JobSearchResponse {
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

export function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "job source";
  }
}

export function cleanJobText(text: string): string {
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

export function jobSnippets(hit: JobSearchHit): string[] {
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

export function jobBadges(hit: JobSearchHit): string[] {
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

export function formatPublishedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { addSuffix: true });
}

export function inferRoleAndCompany(hit: JobSearchHit): { jobTitle: string; companyName: string } {
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

export function fallbackJobDescriptionFromHit(hit: JobSearchHit): string {
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

export const USER_STORAGE_KEY = "optimatch_user_profile";

export const formSchema = z.object({
  userName: z.string().min(1, "Your name is required"),
  userEmail: z.string().email("Enter a valid email"),
  jobTitle: z.string().min(1, "Role is required"),
  companyName: z.string().min(1, "Company name is required"),
  resumeText: z.string().min(50, "Resume content must be at least 50 characters"),
  sourceLatex: z.string().optional(),
  jobDescriptionText: z.string().min(50, "Job description must be at least 50 characters"),
});

export type FormValues = z.infer<typeof formSchema>;
