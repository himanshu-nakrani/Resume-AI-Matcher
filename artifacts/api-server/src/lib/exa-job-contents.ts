import { z } from "zod";
import { logger } from "./logger";

const EXA_CONTENTS_URL = "https://api.exa.ai/contents";

const exaContentsRow = z.object({
  url: z.string(),
  title: z.string().optional(),
  publishedDate: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  text: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

const exaContentsStatus = z.object({
  id: z.string().optional(),
  status: z.string().optional(),
  error: z
    .object({
      tag: z.string().optional(),
      httpStatusCode: z.number().nullable().optional(),
    })
    .optional(),
});

const exaContentsJson = z.object({
  results: z.array(exaContentsRow).optional(),
  statuses: z.array(exaContentsStatus).optional(),
  requestId: z.string().optional(),
  error: z.string().optional(),
});

const summarySchemaJson = z.object({
  summary: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  postedDate: z.string().optional(),
  compensation: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
});

export interface EnrichedJob {
  url: string;
  fullDescription: string | null;
  summary: string | null;
  location: string | null;
  employmentType: string | null;
  postedDate: string | null;
  compensation: string | null;
  requirements: string[];
  responsibilities: string[];
  cached: boolean;
}

const contentsCache = new Map<string, { value: EnrichedJob; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of contentsCache) {
    if (now - entry.timestamp > CACHE_TTL) contentsCache.delete(key);
  }
}, 5 * 60 * 1000).unref();

const SUMMARY_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Two-sentence overview of the role and what the company does.",
    },
    location: {
      type: "string",
      description: "City, region, or 'Remote'. Empty string if not stated.",
    },
    employmentType: {
      type: "string",
      description:
        "One of: full-time, contract, part-time, internship, freelance. Empty string if not stated.",
    },
    postedDate: {
      type: "string",
      description: "Posting date in ISO format (YYYY-MM-DD) if stated. Empty string otherwise.",
    },
    compensation: {
      type: "string",
      description: "Salary range or pay band as written. Empty string if not stated.",
    },
    requirements: {
      type: "array",
      description: "Required qualifications, skills, or experience.",
      items: { type: "string" },
    },
    responsibilities: {
      type: "array",
      description: "Day-to-day responsibilities or what the role will do.",
      items: { type: "string" },
    },
  },
  required: ["summary"],
} as const;

function emptyToNull(s: string | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

export async function enrichJobContent(
  apiKey: string,
  url: string,
  opts?: { title?: string },
): Promise<EnrichedJob> {
  const cached = contentsCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug({ url }, "Exa contents cache hit");
    return { ...cached.value, cached: true };
  }

  const body = {
    urls: [url],
    text: { maxCharacters: 8000 },
    maxAgeHours: 24,
    livecrawlTimeout: 12000,
    summary: {
      query: `Extract structured fields from this job posting.${
        opts?.title ? ` Title hint: ${opts.title}.` : ""
      } Return values that match the schema. Use empty strings for unknown fields, never invent.`,
      schema: SUMMARY_SCHEMA,
    },
  };

  const res = await fetch(EXA_CONTENTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const raw: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      typeof raw === "object" && raw !== null && "error" in raw && typeof (raw as { error: unknown }).error === "string"
        ? (raw as { error: string }).error
        : `Exa contents failed (${res.status})`;
    throw new Error(msg);
  }

  const parsed = exaContentsJson.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Unexpected response from Exa contents");
  }

  if (parsed.data.error) {
    throw new Error(parsed.data.error);
  }

  const status = parsed.data.statuses?.[0];
  if (status?.status && status.status !== "success") {
    const tag = status.error?.tag ?? status.status;
    throw new Error(`Exa could not retrieve this URL (${tag})`);
  }

  const row = parsed.data.results?.[0];
  if (!row) {
    throw new Error("Exa returned no content for this URL");
  }

  const fullDescription = emptyToNull(row.text);

  let structured: z.infer<typeof summarySchemaJson> = {};
  if (row.summary) {
    try {
      const parsedSummary: unknown = JSON.parse(row.summary);
      const safe = summarySchemaJson.safeParse(parsedSummary);
      if (safe.success) structured = safe.data;
    } catch (err) {
      logger.debug({ err, url }, "Failed to parse Exa summary JSON; falling back to raw text");
    }
  }

  const value: EnrichedJob = {
    url,
    fullDescription,
    summary: emptyToNull(structured.summary) ?? (row.summary && !row.summary.trim().startsWith("{") ? row.summary : null),
    location: emptyToNull(structured.location),
    employmentType: emptyToNull(structured.employmentType),
    postedDate: emptyToNull(structured.postedDate) ?? emptyToNull(row.publishedDate ?? undefined),
    compensation: emptyToNull(structured.compensation),
    requirements: (structured.requirements ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 20),
    responsibilities: (structured.responsibilities ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 20),
    cached: false,
  };

  contentsCache.set(url, { value, timestamp: Date.now() });
  return value;
}
