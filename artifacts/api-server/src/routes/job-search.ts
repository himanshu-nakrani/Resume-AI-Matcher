import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { SearchJobsBody } from "@workspace/api-zod";
import { runExaJobSearch } from "../lib/exa-job-search";
import { enrichJobContent } from "../lib/exa-job-contents";
import { logger } from "../lib/logger";
import {
  AiMissingKeyError,
  FIREWORKS_DEFAULT_MODEL,
  getAiClient,
  isAiError,
  runAiCompletion,
} from "@workspace/integrations-openai-ai-server";
import { parseAiJson } from "../lib/parse-ai-json";
import {
  fetchReadableTextFromUrl,
  UnsafeUrlError,
} from "../lib/safe-url-fetch";
import { sendApiError } from "../lib/api-error";
import { sendAiError } from "../lib/send-ai-error";

const router: IRouter = Router();

function sendMissingAiKeyError(req: Request, res: Response): void {
  sendAiError(
    req,
    res,
    Object.assign(new Error("FIREWORKS_API_KEY env var is not set"), {
      code: "ai_missing_key" as const,
      retryable: false,
    }),
  );
}

function validationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

router.post("/job-search", async (req, res): Promise<void> => {
  const parsed = SearchJobsBody.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(
      req,
      res,
      400,
      "invalid_job_search_request",
      validationMessage(parsed.error),
    );
    return;
  }

  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) {
    sendApiError(
      req,
      res,
      503,
      "job_search_not_configured",
      "Job search is not configured. Set EXA_API_KEY on the API server.",
    );
    return;
  }

  const {
    query,
    numResults,
    offset,
    searchType,
    userLocation,
    recentOnly,
    skipHeuristicAnalysis,
  } = parsed.data;

  const filters = "filters" in parsed.data ? parsed.data.filters : undefined;

  try {
    const data = await runExaJobSearch(apiKey, {
      query,
      numResults,
      offset,
      searchType,
      userLocation,
      recentOnly,
      skipHeuristicAnalysis,
      filters:
        filters as import("../lib/exa-job-search").JobSearchParams["filters"],
    });
    res.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Exa job search failed";
    logger.warn({ err, query }, "Exa job search error");
    sendApiError(req, res, 502, "job_search_failed", message);
  }
});

router.post("/job-search/pre-screen", async (req, res): Promise<void> => {
  const { resumeText, jobUrl, jobText } = req.body ?? {};
  if (!resumeText || typeof resumeText !== "string" || resumeText.length < 50) {
    sendApiError(
      req,
      res,
      400,
      "invalid_prescreen_request",
      "resumeText is required (min 50 chars)",
    );
    return;
  }
  const description = jobText ?? jobUrl ?? null;
  if (!description) {
    sendApiError(
      req,
      res,
      400,
      "invalid_prescreen_request",
      "Provide jobText or jobUrl",
    );
    return;
  }

  let jobContent =
    typeof description === "string" && description.startsWith("http")
      ? null
      : (description as string);
  if (!jobContent && jobUrl) {
    try {
      jobContent = (
        await fetchReadableTextFromUrl(jobUrl as string, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; OptiMatch/1.0)",
            Accept: "text/html,application/xhtml+xml",
          },
          timeoutMs: 8000,
          maxBytes: 256 * 1024,
        })
      ).slice(0, 2000);
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        sendApiError(req, res, 400, "unsafe_job_url", "Job URL is not allowed");
        return;
      }
      // Fall through to use URL as context string
    }
  }

  const jobSnippet = jobContent ?? `Job URL: ${jobUrl}`;

  const prompt =
    "You are a resume screening expert. Quickly assess how well this resume matches the job.\n\n" +
    `Resume:\n${resumeText.slice(0, 2000)}\n\n` +
    `Job:\n${jobSnippet.slice(0, 1500)}\n\n` +
    'Return ONLY valid JSON: {"matchScore": <0-100>, ' +
    '"topMatches": ["<skill 1>", "<skill 2>", "<skill 3>"], ' +
    '"topGaps": ["<gap 1>", "<gap 2>", "<gap 3>"]}';

  try {
    const completion = await runAiCompletion(
      getAiClient(),
      {
        model: FIREWORKS_DEFAULT_MODEL,
        max_completion_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      },
      {
        route: "/job-search/pre-screen",
        timeoutMs: 30_000,
        retries: 0,
      },
    );
    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: { matchScore: number; topMatches: string[]; topGaps: string[] };
    try {
      result = parseAiJson(raw);
    } catch {
      result = { matchScore: 50, topMatches: [], topGaps: [] };
    }
    res.json({
      matchScore: Math.max(0, Math.min(100, Number(result.matchScore) || 50)),
      topMatches: Array.isArray(result.topMatches)
        ? result.topMatches.slice(0, 3)
        : [],
      topGaps: Array.isArray(result.topGaps) ? result.topGaps.slice(0, 3) : [],
    });
  } catch (err) {
    logger.error({ err }, "Pre-screen failed");
    if (isAiError(err)) {
      sendAiError(req, res, err);
    } else if (err instanceof AiMissingKeyError) {
      sendMissingAiKeyError(req, res);
    } else {
      sendApiError(req, res, 500, "prescreen_failed", "Pre-screen failed");
    }
  }
});

const EnrichJobBody = z.object({
  url: z.string().url(),
  title: z.string().max(500).optional(),
});

router.post("/job-search/enrich", async (req, res): Promise<void> => {
  const parsed = EnrichJobBody.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(
      req,
      res,
      400,
      "invalid_job_enrichment_request",
      validationMessage(parsed.error),
    );
    return;
  }

  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) {
    sendApiError(
      req,
      res,
      503,
      "job_enrichment_not_configured",
      "Job enrichment is not configured. Set EXA_API_KEY on the API server.",
    );
    return;
  }

  try {
    const data = await enrichJobContent(apiKey, parsed.data.url, {
      title: parsed.data.title,
    });
    res.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Job enrichment failed";
    logger.warn({ err, url: parsed.data.url }, "Exa enrich error");
    sendApiError(req, res, 502, "job_enrichment_failed", message);
  }
});

export default router;
