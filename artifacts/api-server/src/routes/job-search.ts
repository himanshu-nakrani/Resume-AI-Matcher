import { Router, type IRouter, type Response } from "express";
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
import { fetchReadableTextFromUrl, UnsafeUrlError } from "../lib/safe-url-fetch";
import { sendAiError } from "../lib/send-ai-error";

const router: IRouter = Router();

function sendMissingAiKeyError(res: Response): void {
  sendAiError(res, Object.assign(new Error("FIREWORKS_API_KEY env var is not set"), {
    code: "ai_missing_key" as const,
    retryable: false,
  }));
}

router.post("/job-search", async (req, res): Promise<void> => {
  const parsed = SearchJobsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({
      error: "Job search is not configured. Set EXA_API_KEY on the API server.",
    });
    return;
  }

  const { query, numResults, offset, searchType, userLocation, recentOnly, skipHeuristicAnalysis } = parsed.data;

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
      filters: filters as import("../lib/exa-job-search").JobSearchParams["filters"],
    });
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Exa job search failed";
    logger.warn({ err, query }, "Exa job search error");
    res.status(502).json({ error: message });
  }
});

router.post("/job-search/pre-screen", async (req, res): Promise<void> => {
  const { resumeText, jobUrl, jobText } = req.body ?? {};
  if (!resumeText || typeof resumeText !== "string" || resumeText.length < 50) {
    res.status(400).json({ error: "resumeText is required (min 50 chars)" });
    return;
  }
  const description = jobText ?? jobUrl ?? null;
  if (!description) {
    res.status(400).json({ error: "Provide jobText or jobUrl" });
    return;
  }

  let jobContent = typeof description === "string" && description.startsWith("http") ? null : (description as string);
  if (!jobContent && jobUrl) {
    try {
      jobContent = (await fetchReadableTextFromUrl(jobUrl as string, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OptiMatch/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        timeoutMs: 8000,
        maxBytes: 256 * 1024,
      })).slice(0, 2000);
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        res.status(400).json({ error: "Job URL is not allowed" });
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
    const completion = await runAiCompletion(getAiClient(), {
      model: FIREWORKS_DEFAULT_MODEL,
      max_completion_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }, {
      route: "/job-search/pre-screen",
      timeoutMs: 30_000,
      retries: 0,
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: { matchScore: number; topMatches: string[]; topGaps: string[] };
    try { result = parseAiJson(raw); } catch {
      result = { matchScore: 50, topMatches: [], topGaps: [] };
    }
    res.json({
      matchScore: Math.max(0, Math.min(100, Number(result.matchScore) || 50)),
      topMatches: Array.isArray(result.topMatches) ? result.topMatches.slice(0, 3) : [],
      topGaps: Array.isArray(result.topGaps) ? result.topGaps.slice(0, 3) : [],
    });
  } catch (err) {
    logger.error({ err }, "Pre-screen failed");
    if (isAiError(err)) {
      sendAiError(res, err);
    } else if (err instanceof AiMissingKeyError) {
      sendMissingAiKeyError(res);
    } else {
      res.status(500).json({ error: "Pre-screen failed" });
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
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({
      error: "Job enrichment is not configured. Set EXA_API_KEY on the API server.",
    });
    return;
  }

  try {
    const data = await enrichJobContent(apiKey, parsed.data.url, { title: parsed.data.title });
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job enrichment failed";
    logger.warn({ err, url: parsed.data.url }, "Exa enrich error");
    res.status(502).json({ error: message });
  }
});

export default router;
