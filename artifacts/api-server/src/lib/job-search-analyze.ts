import type { ExaSearchType } from "./exa-search-types";

export type JobSearchAnalysis = {
  /** Short human-readable summary of what we inferred from the prompt. */
  intentSummary: string;
  /** The main semantic query sent to Exa (after cleaning and context injection). */
  optimizedQuery: string;
  /** ISO 3166-1 alpha-2 country code passed to Exa `userLocation`, if any. */
  inferredLocation: string | null;
  /** Whether we biased toward fresher postings (date / cache hints). */
  recentBias: boolean;
  /** Extra query variations sent to Exa for deep / auto routing. */
  additionalQueries: string[];
  /** Search type actually used after smart defaults. */
  effectiveSearchType: ExaSearchType;
};

export type JobSearchFilters = {
  experienceLevel?: "entry" | "mid" | "senior" | "lead" | "executive";
  jobType?: "full-time" | "contract" | "part-time" | "internship" | "freelance";
  remote?: "remote" | "hybrid" | "on-site";
  salaryMin?: string;
  industry?: string;
  companySize?: "startup" | "mid-size" | "enterprise";
};

const RECENT_RE = /\b(recent|latest|new(est)?|last\s+\d+\s*(day|week|month)s?|posted\s+today|this\s+week|actively\s+hiring|2025|2026)\b/i;

const REMOTE_RE = /\b(remote|wfh|work\s*from\s*home|distributed|anywhere|worldwide|fully\s*remote|100%\s*remote)\b/i;

/** Map natural phrases to Exa `userLocation` (ISO 3166-1 alpha-2). */
const LOCATION_RULES: { re: RegExp; iso: string; label: string }[] = [
  { re: /\bUS\b|\bUSA\b|\bU\.S\.A\.?\b|\bUnited\s+States\b|\bAmerican\s+engineer\b/i, iso: "US", label: "United States" },
  { re: /\b(united\s+kingdom|england|scotland|wales|northern\s+ireland|london|manchester|birmingham|edinburgh)\b|\bUK\b/i, iso: "GB", label: "UK" },
  { re: /\b(canada|toronto|vancouver|montreal|calgary|ottawa)\b/i, iso: "CA", label: "Canada" },
  { re: /\b(india|bangalore|bengaluru|hyderabad|mumbai|delhi|pune|chennai)\b/i, iso: "IN", label: "India" },
  { re: /\b(germany|berlin|munich|hamburg|frankfurt)\b/i, iso: "DE", label: "Germany" },
  { re: /\b(france|paris|lyon|toulouse)\b/i, iso: "FR", label: "France" },
  { re: /\b(australia|sydney|melbourne|brisbane|perth)\b/i, iso: "AU", label: "Australia" },
  { re: /\b(netherlands|amsterdam|rotterdam|utrecht|nl\b|holland)\b/i, iso: "NL", label: "Netherlands" },
  { re: /\b(singapore)\b/i, iso: "SG", label: "Singapore" },
  { re: /\b(ireland|dublin|cork)\b/i, iso: "IE", label: "Ireland" },
  { re: /\b(spain|madrid|barcelona|valencia)\b/i, iso: "ES", label: "Spain" },
  { re: /\b(japan|tokyo|osaka|kyoto)\b/i, iso: "JP", label: "Japan" },
  { re: /\b(switzerland|zurich|geneva|basel)\b/i, iso: "CH", label: "Switzerland" },
];

const EXA_SYSTEM_PROMPT =
  "You are retrieving real job opportunities for a job seeker. " +
  "Strongly prefer pages that are actual job postings or role listings: responsibilities, qualifications, apply or \"Submit application\" flows, " +
  "and employer career sites or ATS-hosted jobs (Greenhouse, Lever, Ashby, Workday, BambooHR, SmartRecruiters). " +
  "Deprioritize generic industry blogs, tutorials, courses, news commentary, and social discussion unless they clearly contain a specific opening. " +
  "When several pages match, prefer the most specific role page over a broad company homepage.";

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function stripQuotes(s: string): string {
  return s.replace(/^["'“”]+|["'“”]+$/g, "").trim();
}

function inferLocationFromText(text: string): { iso: string; label: string } | null {
  for (const rule of LOCATION_RULES) {
    if (rule.re.test(text)) return { iso: rule.iso, label: rule.label };
  }
  return null;
}

function extractCoreRoleHint(raw: string): string {
  const t = stripQuotes(normalizeWhitespace(raw));
  if (t.length < 3) return t;
  return t;
}

function filterTermsToQuery(filters: JobSearchFilters): string[] {
  const terms: string[] = [];
  if (filters.experienceLevel) {
    const map: Record<string, string> = {
      entry: "entry level junior associate",
      mid: "mid level",
      senior: "senior",
      lead: "lead staff principal",
      executive: "executive director VP CTO",
    };
    terms.push(map[filters.experienceLevel] ?? filters.experienceLevel);
  }
  if (filters.jobType) {
    terms.push(filters.jobType);
  }
  if (filters.remote) {
    terms.push(filters.remote);
  }
  if (filters.salaryMin) {
    terms.push(`$"${filters.salaryMin}"+ salary`);
  }
  if (filters.industry) {
    terms.push(filters.industry);
  }
  if (filters.companySize) {
    const map: Record<string, string> = {
      startup: "startup early-stage",
      "mid-size": "mid-size company",
      enterprise: "enterprise large company",
    };
    terms.push(map[filters.companySize] ?? filters.companySize);
  }
  return terms;
}

/**
 * Heuristic analysis of the user's natural-language job search prompt.
 * Does not call external LLMs — keeps latency predictable and avoids extra keys.
 */
export function analyzeJobSearchPrompt(input: {
  rawQuery: string;
  explicitUserLocation?: string | undefined;
  explicitRecentOnly?: boolean | undefined;
  requestedSearchType?: ExaSearchType | undefined;
  skipHeuristicAnalysis?: boolean | undefined;
  filters?: JobSearchFilters;
}): JobSearchAnalysis {
  const raw = stripQuotes(normalizeWhitespace(input.rawQuery));
  const skip = Boolean(input.skipHeuristicAnalysis);

  if (raw.length < 2) {
    const st = input.requestedSearchType ?? "auto";
    return {
      intentSummary: "Query too short; no analysis applied.",
      optimizedQuery: raw,
      inferredLocation: null,
      recentBias: Boolean(input.explicitRecentOnly),
      additionalQueries: [],
      effectiveSearchType: st,
    };
  }

  if (skip) {
    const st = input.requestedSearchType ?? "auto";
    const explicitLoc = input.explicitUserLocation?.trim().toUpperCase();
    const explicitOk = explicitLoc && /^[A-Z]{2}$/.test(explicitLoc) ? explicitLoc : null;
    return {
      intentSummary: explicitOk
        ? `Raw query; region hint ${explicitOk}.`
        : "Using your query as entered (heuristic analysis off).",
      optimizedQuery: raw,
      inferredLocation: explicitOk,
      recentBias: Boolean(input.explicitRecentOnly),
      additionalQueries: [],
      effectiveSearchType: st,
    };
  }

  const explicitLoc = input.explicitUserLocation?.trim().toUpperCase();
  const validExplicit =
    explicitLoc && /^[A-Z]{2}$/.test(explicitLoc) ? explicitLoc : undefined;

  const inferred = inferLocationFromText(raw);
  // Natural-language prompt should win over the optional country box when both are present.
  // This prevents stale UI values (for example "US") from biasing "jobs in Hyderabad" away from India.
  const userLocationIso = inferred?.iso ?? validExplicit ?? null;

  const recentBias = Boolean(input.explicitRecentOnly) || RECENT_RE.test(raw);
  const remote = REMOTE_RE.test(raw);

  const core = extractCoreRoleHint(raw);
  const filterInjects = filterTermsToQuery(input.filters ?? {});

  const contextSuffix =
    "Include only pages that look like job postings, requisitions, or role-specific career pages with hiring intent — not generic articles or learning content.";

  const filterSuffix = filterInjects.length > 0 ? ` ${filterInjects.join(" ")}` : "";

  const optimizedQuery = remote
    ? `${core}. Prefer remote-friendly or location-agnostic openings;${filterSuffix} ${contextSuffix}`
    : `${core}.${filterSuffix} ${contextSuffix}`;

  const additionalQueries: string[] = [];
  if (/\b(intern|internship|co-?op)\b/i.test(raw)) {
    additionalQueries.push(`${core} internship or co-op job posting application`);
  }
  if (/\b(senior|staff|principal|lead|manager|director)\b/i.test(raw)) {
    additionalQueries.push(`${core} senior level job posting responsibilities apply`);
  }
  if (remote) {
    additionalQueries.push(`${core} remote job site:greenhouse.io OR site:lever.co OR site:jobs.ashbyhq.com`);
  }
  if (additionalQueries.length === 0 && core.length > 20) {
    additionalQueries.push(`${core} careers hiring apply job description`);
  }

  const requested = input.requestedSearchType ?? "auto";
  let effectiveSearchType: ExaSearchType = requested;

  if (requested === "auto") {
    const complex =
      raw.length > 140 ||
      additionalQueries.length >= 2 ||
      /\b(and|or|vs|stack|full\s*stack|mlops|kubernetes|typescript|react|go\b|rust)\b/i.test(raw);
    if (complex) effectiveSearchType = "deep";
  }

  const parts: string[] = [];
  if (userLocationIso) parts.push(`location bias: ${userLocationIso}`);
  if (recentBias) parts.push("prefer recent postings");
  if (remote) parts.push("remote-friendly");
  if (filterInjects.length > 0) parts.push(`filters: ${filterInjects.join(", ")}`);
  const intentSummary =
    parts.length > 0
      ? `Interpreted: ${parts.join(" · ")}.`
      : "Interpreted: general role search (no strong location or recency bias).";

  return {
    intentSummary,
    optimizedQuery,
    inferredLocation: userLocationIso,
    recentBias,
    additionalQueries: additionalQueries.slice(0, 3),
    effectiveSearchType,
  };
}

export { EXA_SYSTEM_PROMPT };
