import { z } from "zod";
import type { ExaSearchType } from "./exa-search-types";
import {
  analyzeJobSearchPrompt,
  EXA_SYSTEM_PROMPT,
  type JobSearchAnalysis,
  type JobSearchFilters,
} from "./job-search-analyze";
import { logger } from "../lib/logger";

export type { ExaSearchType } from "./exa-search-types";

const EXA_SEARCH_URL = "https://api.exa.ai/search";

const exaResultRow = z.object({
  title: z.string().optional(),
  url: z.string(),
  publishedDate: z.string().nullable().optional(),
  highlights: z.array(z.string()).optional(),
  favicon: z.string().nullable().optional(),
});

const exaSearchJson = z.object({
  results: z.array(exaResultRow).optional(),
  requestId: z.string().optional(),
  searchType: z.string().optional(),
  error: z.string().optional(),
});

const JOB_BOARD_RE =
  /boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|myworkdayjobs|smartrecruiters|icims|taleo|bamboohr|applytojob|workable\.com|recruitee\.com/i;
const JOB_MARKETPLACE_RE = /linkedin\.com\/jobs|glassdoor|indeed\.|ziprecruiter|wellfound|angel\.co\/jobs|naukri\.com|instahyre|hirist/i;
const CAREERS_URL_RE = /\/(job|jobs|careers|position|opening|requisition|apply)\b|careers\.|jobs\./i;
const LOW_SIGNAL_DOMAIN_RE = /medium\.com|substack\.com|youtube\.|reddit\.|twitter\.com|x\.com|facebook\.|pinterest\.|coursera\.org|udemy\.com/i;
const JOB_TEXT_RE =
  /\b(apply now|apply for this job|submit application|job description|responsibilities|qualifications|requirements|employment type|full[-\s]?time|part[-\s]?time|requisition|job id|work location|salary|compensation|posted)\b/i;
const AGGREGATOR_TEXT_RE = /\b(\d+\+?\s+.*\b(vacancies|jobs)\b|salary search|jobs in .+ salaries|job alert|similar jobs)\b/i;

export interface JobSearchParams {
  query: string;
  numResults?: number;
  offset?: number;
  searchType?: ExaSearchType;
  userLocation?: string;
  recentOnly?: boolean;
  /** Skip heuristics and send the raw query (still uses system prompt + highlights). */
  skipHeuristicAnalysis?: boolean;
  filters?: JobSearchFilters;
}

export interface JobSearchHit {
  title: string;
  url: string;
  publishedDate?: string | null;
  highlights?: string[];
  favicon?: string | null;
  applyType?: "ats" | "external" | "unknown";
  salary?: string | null;
}

export interface SearchMetadata {
  totalFound: number;
  rankingStats: {
    highQuality: number;
    mediumQuality: number;
    filtered: number;
  };
  applyTypeBreakdown: { ats: number; external: number; unknown: number };
  cities: string[];
  companies: string[];
  searchDurationMs: number;
  cachedResult: boolean;
}

export interface JobSearchResult {
  results: JobSearchHit[];
  requestId?: string;
  searchType?: string;
  analysis: JobSearchAnalysis;
  metadata?: SearchMetadata;
  hasMore?: boolean;
  nextOffset?: number;
}

function searchTimeoutMs(searchType: ExaSearchType): number {
  switch (searchType) {
    case "auto":
    case "fast":
    case "instant":
      return 35_000;
    case "deep-lite":
      return 70_000;
    case "deep":
      return 90_000;
    case "deep-reasoning":
      return 120_000;
    default: {
      const _never: never = searchType;
      return _never;
    }
  }
}

function hitText(hit: JobSearchHit): string {
  return [hit.title, ...(hit.highlights ?? [])].join(" ");
}

/** Prefer role-specific ATS / careers URLs over broad aggregators, blogs, and social pages. */
function listingScore(hit: JobSearchHit): number {
  const url = hit.url;
  const u = url.toLowerCase();
  const text = hitText(hit);
  let s = 0;
  if (JOB_BOARD_RE.test(u)) s += 7;
  if (CAREERS_URL_RE.test(u)) s += 4;
  if (JOB_MARKETPLACE_RE.test(u)) s += 3;
  if (/\bat\s+[A-Z][\w&.\-\s]{2,}/.test(hit.title)) s += 2;
  if (JOB_TEXT_RE.test(text)) s += 3;
  if (AGGREGATOR_TEXT_RE.test(text)) s -= 2;
  if (LOW_SIGNAL_DOMAIN_RE.test(u)) s -= 6;
  return s;
}

function rankJobListingHits(hits: JobSearchHit[], limit: number): JobSearchHit[] {
  const ranked = [...hits].sort((a, b) => listingScore(b) - listingScore(a));
  const listingLike = ranked.filter((hit) => listingScore(hit) > 0);
  return (listingLike.length > 0 ? listingLike : ranked).slice(0, limit);
}

function detectApplyType(hit: { url: string; highlights?: string[] }): "ats" | "external" | "unknown" {
  const u = new URL(hit.url).hostname.toLowerCase();
  if (/greenhouse\.io|lever\.co|ashbyhq\.com|workday\.com|bamboohr\.com|smartrecruiters\.com|icims\.com|taleo\.net|workable\.com|recruitee\.com|applytojob\.com/i.test(u)) {
    return "ats";
  }
  if (/linkedin\.com\/jobs|indeed\.com|glassdoor\.com|ziprecruiter\.com|wellfound\.com/i.test(hit.url.toLowerCase())) {
    return "external";
  }
  return "unknown";
}

function extractSalary(highlights: string[] | undefined): string | null {
  if (!highlights || highlights.length === 0) return null;
  const patterns = [
    /\$[\d,]+(?:\.\d{2})?\s*[-–to]+\s*\$?[\d,]+(?:\.\d{2})?\s*(?:\/|per\s+)?\s*(?:yr|year|mo|month|hr|hour|k|K)/i,
    /\$[\d,]+(?:\.\d{2})?\s*(?:[–-]\s*\$[\d,]+(?:\.\d{2})?)?\s*(?:\/|per\s+)?\s*(?:yr|year|mo|month|hr|hour|k|K)/i,
    /\b(?:salary|compensation|pay\s*range)[:\s]+\$[\d,]+(?:\.\d{2})?\s*[-–to]+\s*\$?[\d,]+(?:\.\d{2})?\b/i,
  ];
  for (const p of patterns) {
    const m = highlights.join(" ").match(p);
    if (m) return m[0];
  }
  return null;
}

const searchCache = new Map<string, { result: JobSearchResult; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function cacheKey(params: JobSearchParams): string {
  return [
    params.query,
    params.searchType ?? "auto",
    params.numResults ?? 10,
    params.offset ?? 0,
    params.userLocation ?? "",
    String(params.recentOnly ?? false),
    String(params.skipHeuristicAnalysis ?? false),
  ].join("|");
}

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of searchCache) {
    if (now - entry.timestamp > CACHE_TTL) searchCache.delete(key);
  }
}, 5 * 60 * 1000).unref();

/**
 * Calls Exa `POST /search` (see https://docs.exa.ai/reference/search-api-guide-for-coding-agents).
 * Request JSON uses camelCase as in the official JS examples.
 */
export async function runExaJobSearch(
  apiKey: string,
  params: JobSearchParams,
): Promise<JobSearchResult> {
  const key = cacheKey(params);
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug({ key }, "Exa search cache hit");
    return { ...cached.result, metadata: { ...(cached.result.metadata ?? {} as SearchMetadata), cachedResult: true } };
  }

  const startTime = Date.now();

  const analysis = analyzeJobSearchPrompt({
    rawQuery: params.query,
    explicitUserLocation: params.userLocation,
    explicitRecentOnly: params.recentOnly,
    requestedSearchType: params.searchType,
    skipHeuristicAnalysis: params.skipHeuristicAnalysis,
    filters: params.filters,
  });

  const searchType = analysis.effectiveSearchType;
  const numResults = Math.min(Math.max(params.numResults ?? 10, 1), 15);
  const exaNumResults = Math.min(Math.max(numResults * 2, 10), 30);

  const contents: Record<string, unknown> = {
    highlights: true,
  };
  if (analysis.recentBias) {
    contents.maxAgeHours = 168;
  }

  const body: Record<string, unknown> = {
    query: analysis.optimizedQuery,
    type: searchType,
    numResults: exaNumResults,
    systemPrompt: EXA_SYSTEM_PROMPT,
    contents,
  };

  const offset = Math.max(params.offset ?? 0, 0);
  if (offset > 0) {
    body.offset = offset;
  }

  const supportsAuxiliaryQueries =
    searchType === "deep" || searchType === "deep-lite" || searchType === "deep-reasoning";

  if (supportsAuxiliaryQueries && analysis.additionalQueries.length > 0) {
    body.additionalQueries = analysis.additionalQueries;
  }

  if (analysis.inferredLocation) {
    body.userLocation = analysis.inferredLocation;
  }

  if (analysis.recentBias) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 45);
    body.startPublishedDate = d.toISOString().slice(0, 10);
  }

  const res = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(searchTimeoutMs(searchType)),
  });

  const raw: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      typeof raw === "object" && raw !== null && "error" in raw && typeof (raw as { error: unknown }).error === "string"
        ? (raw as { error: string }).error
        : `Exa search failed (${res.status})`;
    throw new Error(msg);
  }

  const parsed = exaSearchJson.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Unexpected response from Exa search");
  }

  if (parsed.data.error) {
    throw new Error(parsed.data.error);
  }

  const rows = parsed.data.results ?? [];
  const totalFound = (raw as Record<string, unknown>).totalResults as number | undefined ?? rows.length;

  const results: JobSearchHit[] = rows.map((r) => {
    let fallbackTitle = r.url;
    try {
      fallbackTitle = new URL(r.url).hostname.replace(/^www\./, "");
    } catch {
      /* keep url string */
    }
    const title = (r.title?.trim() || fallbackTitle).slice(0, 500);
    return {
      title,
      url: r.url,
      publishedDate: r.publishedDate ?? null,
      highlights: r.highlights,
      favicon: r.favicon ?? null,
      applyType: detectApplyType({ url: r.url, highlights: r.highlights }),
      salary: extractSalary(r.highlights),
    };
  });

  const ranked = rankJobListingHits(results, numResults);

  // Build search metadata
  const scored = results.map((r) => ({ ...r, _score: listingScore(r) }));
  const highQuality = scored.filter((r) => r._score > 5).length;
  const mediumQuality = scored.filter((r) => r._score >= 1 && r._score <= 5).length;
  const filtered = scored.filter((r) => r._score <= 0).length;

  const applyTypeBreakdown = { ats: 0, external: 0, unknown: 0 };
  for (const r of results) {
    const t = r.applyType ?? "unknown";
    applyTypeBreakdown[t]++;
  }

  const citySet = new Set<string>();
  const companySet = new Set<string>();
  for (const r of results) {
    const allText = [r.title, ...(r.highlights ?? [])].join(" ");
    const cityMatch = allText.match(/\b([A-Z][a-z]+(?:[\s]+[A-Z][a-z]+)*),\s*(?:[A-Z]{2}|United\s+States|USA|Canada|UK|India|Germany|France|Australia|Netherlands|Singapore|Ireland|Spain|Japan|Switzerland)\b/g);
    if (cityMatch) {
      for (const c of cityMatch) citySet.add(c.split(",")[0].trim());
    }
    const companyMatch = r.title.match(/^(?:Senior\s+|Lead\s+|Staff\s+|Principal\s+|Junior\s+)?(.+?)(?:\s+(?:at|@|\-)\s+([A-Z][\w&.\-\s]{2,}))$/i);
    if (companyMatch?.[2]) {
      companySet.add(companyMatch[2].trim().slice(0, 40));
    }
  }

  const searchDurationMs = Date.now() - startTime;
  const hasMore = totalFound > offset + numResults;

  const result: JobSearchResult = {
    results: ranked,
    requestId: parsed.data.requestId,
    searchType: parsed.data.searchType,
    analysis,
    metadata: {
      totalFound,
      rankingStats: { highQuality, mediumQuality, filtered },
      applyTypeBreakdown,
      cities: Array.from(citySet).slice(0, 8),
      companies: Array.from(companySet).slice(0, 8),
      searchDurationMs,
      cachedResult: false,
    },
    hasMore,
    nextOffset: hasMore ? offset + numResults : undefined,
  };

  searchCache.set(key, { result, timestamp: Date.now() });
  return result;
}
