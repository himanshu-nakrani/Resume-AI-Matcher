import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import type {
  JobSearchResponse,
  JobSearchAnalysis,
} from "@workspace/api-client-react";
import {
  JobSearchAnalysisEffectiveSearchType,
  JobSearchHitApplyType,
} from "@workspace/api-client-react";

export type JobSearchHit = JobSearchResponse["results"][number];

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return stringArray(parsed);
    } catch {
      return [trimmed];
    }

    return [trimmed];
  }

  return [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeJobSearchHit(value: unknown): JobSearchHit | null {
  if (!value || typeof value !== "object") return null;
  const hit = value as Record<string, unknown>;
  const title = stringValue(hit.title);
  const url = stringValue(hit.url);
  if (!title || !url) return null;

  const applyType =
    hit.applyType === JobSearchHitApplyType.ats ||
    hit.applyType === JobSearchHitApplyType.external ||
    hit.applyType === JobSearchHitApplyType.unknown
      ? hit.applyType
      : JobSearchHitApplyType.unknown;

  return {
    title,
    url,
    publishedDate: stringValue(hit.publishedDate),
    highlights: stringArray(hit.highlights),
    favicon: stringValue(hit.favicon),
    applyType,
    salary: stringValue(hit.salary),
  };
}

function normalizeAnalysis(
  value: unknown,
  submittedQuery: string,
): JobSearchAnalysis {
  const fallback: JobSearchAnalysis = {
    intentSummary:
      "Showing ranked openings for your prompt. Restart the API server to enable deeper server-side analysis metadata.",
    optimizedQuery: submittedQuery,
    inferredLocation: null,
    recentBias: false,
    additionalQueries: [],
    effectiveSearchType: JobSearchAnalysisEffectiveSearchType.auto,
  };

  if (!value || typeof value !== "object") return fallback;
  const analysis = value as Record<string, unknown>;
  const effectiveSearchType = Object.values(
    JobSearchAnalysisEffectiveSearchType,
  ).includes(
    analysis.effectiveSearchType as JobSearchAnalysisEffectiveSearchType,
  )
    ? (analysis.effectiveSearchType as JobSearchAnalysisEffectiveSearchType)
    : fallback.effectiveSearchType;

  return {
    intentSummary:
      stringValue(analysis.intentSummary) ?? fallback.intentSummary,
    optimizedQuery:
      stringValue(analysis.optimizedQuery) ?? fallback.optimizedQuery,
    inferredLocation: stringValue(analysis.inferredLocation),
    recentBias: analysis.recentBias === true,
    additionalQueries: stringArray(analysis.additionalQueries),
    effectiveSearchType,
  };
}

function normalizeCountRecord(
  value: unknown,
): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record: Record<string, number> = {};
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    const normalized = numberValue(count);
    if (normalized !== undefined)
      record[key] = Math.max(0, Math.round(normalized));
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

function normalizeMetadata(value: unknown): JobSearchResponse["metadata"] {
  if (!value || typeof value !== "object") return undefined;
  const metadata = value as Record<string, unknown>;
  return {
    totalFound: numberValue(metadata.totalFound),
    rankingStats: normalizeCountRecord(metadata.rankingStats),
    applyTypeBreakdown: normalizeCountRecord(metadata.applyTypeBreakdown),
    cities: stringArray(metadata.cities),
    companies: stringArray(metadata.companies),
    searchDurationMs: numberValue(metadata.searchDurationMs),
    cachedResult: metadata.cachedResult === true,
  };
}

/** Older API servers may omit `analysis`; merge so success handlers never throw. */
export function jobSearchResponseWithAnalysis(
  data: JobSearchResponse,
  submittedQuery: string,
): JobSearchResponse {
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

export function normalizeJobSearchResponse(
  data: unknown,
  submittedQuery: string,
): JobSearchResponse {
  const source =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const results = Array.isArray(source.results)
    ? source.results
        .map(normalizeJobSearchHit)
        .filter((hit): hit is JobSearchHit => hit != null)
    : [];

  return {
    results,
    requestId: stringValue(source.requestId) ?? undefined,
    searchType: stringValue(source.searchType) ?? undefined,
    analysis: normalizeAnalysis(source.analysis, submittedQuery),
    metadata: normalizeMetadata(source.metadata),
    hasMore: source.hasMore === true,
    nextOffset: numberValue(source.nextOffset),
  };
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
  const lastBreak = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf(";"),
    clipped.lastIndexOf(","),
  );
  return `${clipped.slice(0, lastBreak > 120 ? lastBreak + 1 : clipped.length).trim()}...`;
}

export function jobSnippets(hit: JobSearchHit): string[] {
  const raw = hit.highlights ?? [];
  const seen = new Set<string>();
  return raw
    .flatMap((highlight) => highlight.split(/\s*\[\s*\.\.\.\s*\]\s*/g))
    .map(cleanJobText)
    .filter((snippet) => snippet.length >= 45)
    .filter(
      (snippet) => !/\b(salary search|similar jobs|job alert)\b/i.test(snippet),
    )
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
  const source =
    `${hit.title} ${(hit.highlights ?? []).join(" ")}`.toLowerCase();
  const badges = new Set<string>();
  if (/\b(remote|work from home|wfh|distributed)\b/.test(source))
    badges.add("Remote");
  if (/\b(hybrid)\b/.test(source)) badges.add("Hybrid");
  if (/\b(on[-\s]?site|in person|office)\b/.test(source)) badges.add("On-site");
  if (/\b(full[-\s]?time)\b/.test(source)) badges.add("Full-time");
  if (/\b(part[-\s]?time)\b/.test(source)) badges.add("Part-time");
  if (/\b(intern|internship|co-?op)\b/.test(source)) badges.add("Internship");
  if (/\b(senior|sr\.?|lead|staff|principal)\b/.test(source))
    badges.add("Senior+");
  if (
    /\b(hyderabad|bengaluru|bangalore|mumbai|pune|delhi|chennai|gurugram|noida)\b/.test(
      source,
    )
  )
    badges.add("India");
  return [...badges].slice(0, 4);
}

export function formatPublishedDate(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { addSuffix: true });
}

export function inferRoleAndCompany(hit: JobSearchHit): {
  jobTitle: string;
  companyName: string;
} {
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
  const detail =
    snippets.length > 0
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
  resumeText: z
    .string()
    .min(50, "Resume content must be at least 50 characters"),
  sourceLatex: z.string().optional(),
  jobDescriptionText: z
    .string()
    .min(50, "Job description must be at least 50 characters"),
});

export type FormValues = z.infer<typeof formSchema>;
