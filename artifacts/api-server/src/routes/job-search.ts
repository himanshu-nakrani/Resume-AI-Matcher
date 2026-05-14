import { Router, type IRouter } from "express";
import { SearchJobsBody } from "@workspace/api-zod";
import { runExaJobSearch } from "../lib/exa-job-search";
import { logger } from "../lib/logger";
import { getAiFromRequest } from "../lib/ai-from-request";
import { parseAiJson } from "../lib/parse-ai-json";

const router: IRouter = Router();

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
      const htmlRes = await fetch(jobUrl as string, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OptiMatch/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        jobContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s{3,}/g, "\n\n")
          .trim()
          .slice(0, 2000);
      }
    } catch {
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
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 300,
      messages: [{ role: "user", content: prompt }],
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
    res.status(500).json({ error: "Pre-screen failed" });
  }
});

export default router;
