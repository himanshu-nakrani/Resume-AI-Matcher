import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, analyses } from "@workspace/db";
import {
  CreateAnalysisBody,
  GetAnalysisParams,
  DeleteAnalysisParams,
  GenerateCoverLetterParams,
  GenerateCoverLetterBody,
  GenerateLinkedinPostParams,
  RewriteBulletParams,
  RewriteBulletBody,
  UpdateAnalysisParams,
  UpdateAnalysisBody,
  GenerateInterviewQuestionsParams,
  GenerateLearningPlanParams,
  ShareAnalysisParams,
  UnshareAnalysisParams,
  GetSharedAnalysisParams,
  FetchJobDescriptionBody,
  DuplicateAnalysisParams,
  GenerateSalaryGuideParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/analyses", async (req, res): Promise<void> => {
  req.log.info("Listing analyses");
  const rows = await db
    .select()
    .from(analyses)
    .orderBy(desc(analyses.createdAt));
  res.json(rows);
});

router.post("/analyses", async (req, res): Promise<void> => {
  const parsed = CreateAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { jobTitle, companyName, resumeText, jobDescriptionText } = parsed.data;

  req.log.info({ jobTitle }, "Running AI analysis");

  const prompt = "You are an expert resume analyst, career coach, and ATS (Applicant Tracking System) specialist with 15+ years of experience in talent acquisition and resume optimization.\n\n" +
    "Analyze this resume against the provided job description with extreme care and specificity. Provide deep, actionable insights.\n\n" +
    "Resume:\n" + resumeText + "\n\n" +
    "Job Description:\n" + jobDescriptionText + "\n\n" +
    "Job Title: " + jobTitle + "\n" +
    "Company: " + (companyName ?? "Not specified") + "\n\n" +
    "Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):\n" +
    "{\n" +
    '  "fitScore": <integer 0-100>,\n' +
    '  "fitRationale": "<2-3 sentence explanation of the fit score with specific reasons>",\n' +
    '  "strengths": ["<strength 1: specific skill/achievement from resume that matches JD>", "<strength 2>", "<strength 3>"],\n' +
    '  "gaps": ["<critical gap 1: required skill/experience missing from resume>", "<gap 2>", "<gap 3>"],\n' +
    '  "improvements": ["<specific actionable improvement 1 with concrete example>", "<improvement 2>", "<improvement 3>", "<improvement 4>", "<improvement 5>"],\n' +
    '  "atsKeywordsMatched": ["<keyword1>", "<keyword2>", "<keyword3>", "<keyword4>", "<keyword5>"],\n' +
    '  "atsKeywordsMissing": ["<missing keyword1>", "<missing keyword2>", "<missing keyword3>", "<missing keyword4>", "<missing keyword5>"],\n' +
    '  "atsScore": <integer 0-100>\n' +
    "}\n\n" +
    "Detailed Guidelines:\n" +
    "- fitScore: Overall match 0-100 considering required skills presence, experience level, and qualifications match\n" +
    "- fitRationale: Explain WHY this score - reference specific requirements and what the resume delivers\n" +
    "- strengths: Extract 3 most relevant strengths - be specific\n" +
    "- gaps: List critical missing items that would concern a hiring manager\n" +
    "- improvements: Provide 5 specific, immediately actionable edits with examples\n" +
    "- atsKeywordsMatched: Extract 5+ exact keywords/phrases from JD that appear in resume\n" +
    "- atsKeywordsMissing: Extract 5+ important keywords/phrases from JD missing from resume\n" +
    "- atsScore: Rate how ATS will parse resume 0-100";

  let aiResult: {
    fitScore: number;
    fitRationale: string;
    strengths: string[];
    gaps: string[];
    improvements: string[];
    atsKeywordsMatched: string[];
    atsKeywordsMissing: string[];
    atsScore: number;
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    aiResult = JSON.parse(content);
  } catch (err) {
    logger.error({ err }, "AI analysis failed");
    res.status(500).json({ error: "AI analysis failed" });
    return;
  }

  const [row] = await db
    .insert(analyses)
    .values({
      jobTitle,
      companyName: companyName ?? null,
      resumeText,
      jobDescriptionText,
      fitScore: aiResult.fitScore ?? 0,
      fitRationale: aiResult.fitRationale ?? "",
      strengths: aiResult.strengths ?? [],
      gaps: aiResult.gaps ?? [],
      improvements: aiResult.improvements ?? [],
      atsKeywordsMatched: aiResult.atsKeywordsMatched ?? [],
      atsKeywordsMissing: aiResult.atsKeywordsMissing ?? [],
      atsScore: aiResult.atsScore ?? 0,
      coverLetter: null,
      linkedinPost: null,
    })
    .returning();

  res.status(201).json(row);
});

router.get("/analyses/stats", async (req, res): Promise<void> => {
  req.log.info("Getting analysis stats");

  const rows = await db.select().from(analyses);
  const total = rows.length;

  if (total === 0) {
    res.json({
      totalAnalyses: 0,
      averageFitScore: 0,
      averageAtsScore: 0,
      topMissingKeywords: [],
    });
    return;
  }

  const avgFit = rows.reduce((sum, r) => sum + r.fitScore, 0) / total;
  const avgAts = rows.reduce((sum, r) => sum + r.atsScore, 0) / total;

  const keywordCounts: Record<string, number> = {};
  for (const row of rows) {
    const missing = (row.atsKeywordsMissing as string[]) ?? [];
    for (const kw of missing) {
      keywordCounts[kw] = (keywordCounts[kw] ?? 0) + 1;
    }
  }
  const topMissingKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([kw]) => kw);

  res.json({
    totalAnalyses: total,
    averageFitScore: Math.round(avgFit * 10) / 10,
    averageAtsScore: Math.round(avgAts * 10) / 10,
    topMissingKeywords,
  });
});

router.get("/analyses/:id", async (req, res): Promise<void> => {
  const params = GetAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json(row);
});

router.delete("/analyses/:id", async (req, res): Promise<void> => {
  const params = DeleteAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(analyses)
    .where(eq(analyses.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/analyses/:id", async (req, res): Promise<void> => {
  const params = UpdateAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateAnalysisBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const updates: Partial<typeof existing> = {};
  if (body.data.status !== undefined) updates.status = body.data.status as typeof existing.status;
  if (body.data.notes !== undefined) updates.notes = body.data.notes;
  if (body.data.isFavorite !== undefined) updates.isFavorite = body.data.isFavorite;
  if (body.data.deadline !== undefined) updates.deadline = body.data.deadline;
  if (body.data.contactName !== undefined) updates.contactName = body.data.contactName;
  if (body.data.contactEmail !== undefined) updates.contactEmail = body.data.contactEmail;
  if (body.data.followUpDate !== undefined) updates.followUpDate = body.data.followUpDate;
  if (body.data.tags !== undefined) updates.tags = body.data.tags;

  const [updated] = await db
    .update(analyses)
    .set(updates)
    .where(eq(analyses.id, params.data.id))
    .returning();

  res.json(updated);
});

// --- Duplicate ---

router.post("/analyses/:id/duplicate", async (req, res): Promise<void> => {
  const params = DuplicateAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [original] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.data.id));

  if (!original) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  req.log.info({ id: params.data.id }, "Duplicating analysis");

  const [newRow] = await db
    .insert(analyses)
    .values({
      jobTitle: original.jobTitle + " (copy)",
      companyName: original.companyName,
      resumeText: original.resumeText,
      jobDescriptionText: original.jobDescriptionText,
      fitScore: original.fitScore,
      fitRationale: original.fitRationale,
      strengths: (original.strengths as string[]) ?? [],
      gaps: (original.gaps as string[]) ?? [],
      improvements: (original.improvements as string[]) ?? [],
      atsKeywordsMatched: (original.atsKeywordsMatched as string[]) ?? [],
      atsKeywordsMissing: (original.atsKeywordsMissing as string[]) ?? [],
      atsScore: original.atsScore,
      coverLetter: null,
      linkedinPost: null,
      status: "not_applied",
      interviewQuestions: [],
      learningPlan: [],
      isFavorite: false,
      notes: null,
      shareToken: null,
      isPublic: false,
    })
    .returning();

  res.status(201).json(newRow);
});

// --- Salary Guide ---

router.post("/analyses/:id/salary-guide", async (req, res): Promise<void> => {
  const params = GenerateSalaryGuideParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  req.log.info({ id: params.data.id }, "Generating salary guide");

  const prompt =
    "You are a compensation expert with access to current market data. Provide a realistic salary range estimate.\n\n" +
    "Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "unspecified company") + "\n" +
    "Candidate Strengths: " + ((analysis.strengths as string[]).slice(0, 3).join("; ") || "not specified") + "\n" +
    "Candidate Gaps: " + ((analysis.gaps as string[]).slice(0, 3).join("; ") || "none") + "\n" +
    "Fit Score: " + analysis.fitScore + "/100\n\n" +
    "Based on current market rates (2024-2025), provide a realistic salary estimate. Consider the role level implied by title and candidate profile.\n" +
    "Return ONLY valid JSON (no markdown):\n" +
    '{"low": <integer annual USD>, "mid": <integer annual USD>, "high": <integer annual USD>, "currency": "USD", "period": "year", ' +
    '"context": "<2-3 sentence market context explaining these numbers>", ' +
    '"factors": ["<factor that could push salary higher 1>", "<factor 2>", "<factor 3>"], ' +
    '"negotiationTips": ["<specific negotiation tip 1>", "<tip 2>", "<tip 3>"]}';

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let guide: {
      low: number; mid: number; high: number; currency: string; period: string;
      context: string; factors: string[]; negotiationTips: string[];
    };
    try {
      guide = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "Failed to parse salary guide" });
      return;
    }

    await db
      .update(analyses)
      .set({ salaryGuide: guide })
      .where(eq(analyses.id, params.data.id));

    res.json(guide);
  } catch (err) {
    logger.error({ err }, "Salary guide generation failed");
    res.status(500).json({ error: "Salary guide generation failed" });
  }
});

// --- Phase 1: Sharing ---

router.post("/analyses/:id/share", async (req, res): Promise<void> => {
  const params = ShareAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const token = existing.shareToken ?? randomUUID();
  await db
    .update(analyses)
    .set({ shareToken: token, isPublic: true })
    .where(eq(analyses.id, params.data.id));

  const host = req.headers.host ?? "";
  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const base = process.env.REPLIT_DEV_DOMAIN
    ? "https://" + process.env.REPLIT_DEV_DOMAIN
    : protocol + "://" + host;
  const shareUrl = base + "/share/" + token;

  req.log.info({ id: params.data.id, token }, "Analysis shared");
  res.json({ shareToken: token, shareUrl });
});

router.delete("/analyses/:id/share", async (req, res): Promise<void> => {
  const params = UnshareAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const [updated] = await db
    .update(analyses)
    .set({ isPublic: false })
    .where(eq(analyses.id, params.data.id))
    .returning();

  req.log.info({ id: params.data.id }, "Analysis unshared");
  res.json(updated);
});

router.get("/share/:token", async (req, res): Promise<void> => {
  const params = GetSharedAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.shareToken, params.data.token));

  if (!row || !row.isPublic) {
    res.status(404).json({ error: "Shared analysis not found" });
    return;
  }

  res.json(row);
});

// --- Phase 3: Job URL Import ---

router.post("/fetch-job", async (req, res): Promise<void> => {
  const body = FetchJobDescriptionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  const { url } = body.data;

  req.log.info({ url }, "Fetching job description from URL");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OptiMatch/1.0; +https://optimatch.app)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      res.status(400).json({ error: "Could not fetch that URL. Try copying the job description manually." });
      return;
    }

    const html = await response.text();

    // Strip HTML tags and extract readable text
    const text = html
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
      .slice(0, 12000);

    if (text.length < 100) {
      res.status(400).json({ error: "Could not extract content from that URL. Try copying the job description manually." });
      return;
    }

    // Use AI to extract the structured job info
    const extractPrompt =
      "Extract the job description from this webpage text. Return ONLY valid JSON:\n" +
      '{"jobTitle": "<job title or empty string>", "companyName": "<company name or empty string>", "jobDescription": "<full job description text, cleaned up, 200-2000 words>"}\n\n' +
      "Webpage text:\n" + text;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: extractPrompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let extracted: { jobTitle?: string; companyName?: string; jobDescription?: string } = {};
    try {
      extracted = JSON.parse(raw);
    } catch {
      extracted = { jobDescription: text.slice(0, 3000) };
    }

    if (!extracted.jobDescription || extracted.jobDescription.length < 50) {
      res.status(400).json({ error: "Could not extract job description from that URL. Try copying the text manually." });
      return;
    }

    res.json({
      jobDescription: extracted.jobDescription,
      jobTitle: extracted.jobTitle ?? "",
      companyName: extracted.companyName ?? "",
    });
  } catch (err) {
    logger.error({ err, url }, "Job URL fetch failed");
    res.status(400).json({ error: "Could not fetch that URL. Please copy the job description text manually." });
  }
});

// --- Generation routes ---

router.post("/analyses/:id/cover-letter", async (req, res): Promise<void> => {
  const params = GenerateCoverLetterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = GenerateCoverLetterBody.safeParse(req.body ?? {});
  const tone = (body.success ? body.data.tone : null) ?? "professional";

  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  req.log.info({ id: params.data.id }, "Generating cover letter");

  const prompt =
    "You are an award-winning cover letter writer. Write a compelling, personalized cover letter.\n\n" +
    "Candidate's Resume:\n" + analysis.resumeText + "\n\n" +
    "Job Description:\n" + analysis.jobDescriptionText + "\n\n" +
    "Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "the company") + "\n" +
    "Tone: " + tone + "\n\n" +
    "Write a " + tone + " cover letter that: (1) Opens with a specific, genuine insight about this company/role, (2) Highlights the top 3-4 most relevant achievements from the resume matching the JD requirements, using quantified results, (3) Addresses any gaps as learning opportunities not weaknesses, (4) Closes with genuine enthusiasm and confident call to action. Keep it 3-4 paragraphs, no longer than 250 words. Start with 'Dear Hiring Manager,' and write ONLY the cover letter text, no subject lines or commentary.";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "";

    await db
      .update(analyses)
      .set({ coverLetter: content })
      .where(eq(analyses.id, params.data.id));

    res.json({ content });
  } catch (err) {
    logger.error({ err }, "Cover letter generation failed");
    res.status(500).json({ error: "Cover letter generation failed" });
  }
});

router.post("/analyses/:id/linkedin-post", async (req, res): Promise<void> => {
  const params = GenerateLinkedinPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  req.log.info({ id: params.data.id }, "Generating LinkedIn post");

  const prompt =
    "You are a LinkedIn content strategist. Write an authentic, compelling LinkedIn post for a job seeker.\n\n" +
    "Resume Summary:\n" + analysis.resumeText.slice(0, 1500) + "\n\n" +
    "Target Role: " + analysis.jobTitle + " at " + (analysis.companyName ?? "a company") + "\n" +
    "Fit Score: " + analysis.fitScore + "/100\n\n" +
    "Write 150-250 word LinkedIn post with: (1) A compelling hook that shows genuine insight about the role/industry, (2) 2-3 key achievements demonstrating enthusiasm for THIS role with numbers and results, (3) 2-3 specific strengths that make them ideal, (4) Specific call-to-action about roles they're exploring. Use line breaks for readability, 1-2 natural hashtags only, no emojis unless natural, no forced exclamation marks. Make it authentic. Write ONLY the post text, no preamble.";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "";

    await db
      .update(analyses)
      .set({ linkedinPost: content })
      .where(eq(analyses.id, params.data.id));

    res.json({ content });
  } catch (err) {
    logger.error({ err }, "LinkedIn post generation failed");
    res.status(500).json({ error: "LinkedIn post generation failed" });
  }
});

router.post("/analyses/:id/interview-questions", async (req, res): Promise<void> => {
  const params = GenerateInterviewQuestionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  req.log.info({ id: params.data.id }, "Generating interview questions");

  const strengths = (analysis.strengths as string[]).slice(0, 5).join("; ");
  const gaps = (analysis.gaps as string[]).slice(0, 5).join("; ");
  const missingKeywords = (analysis.atsKeywordsMissing as string[]).slice(0, 10).join(", ");

  const prompt =
    "You are a senior interview coach. Generate 10 likely interview questions for this role and candidate.\n\n" +
    "Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "the company") + "\n" +
    "Strengths: " + strengths + "\n" +
    "Gaps: " + gaps + "\n" +
    "Missing Skills: " + missingKeywords + "\n\n" +
    "Generate a mix: 3 behavioral (STAR format), 3 technical/domain targeting their gaps, 2 role-specific deep-dives, 1 culture fit, 1 pressure/adversity question. " +
    "Each question targets specific needs. Keep concise (1-2 sentences max). Questions should be specific to THIS role, not generic. " +
    "Do NOT include answer hints or frameworks. Return ONLY a JSON array of strings with no other text: [\"Question 1?\", \"Question 2?\", ...]";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    let questions: string[] = [];
    try {
      questions = JSON.parse(raw);
      if (!Array.isArray(questions)) questions = [];
    } catch {
      questions = [];
    }

    await db
      .update(analyses)
      .set({ interviewQuestions: questions })
      .where(eq(analyses.id, params.data.id));

    res.json({ questions });
  } catch (err) {
    logger.error({ err }, "Interview questions generation failed");
    res.status(500).json({ error: "Interview questions generation failed" });
  }
});

router.post("/analyses/:id/learning-plan", async (req, res): Promise<void> => {
  const params = GenerateLearningPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  req.log.info({ id: params.data.id }, "Generating learning plan");

  const gaps = (analysis.gaps as string[]).join("; ");
  const missingKeywords = (analysis.atsKeywordsMissing as string[]).join(", ");

  const prompt =
    "You are a senior career coach. Create a focused learning plan for this candidate.\n\n" +
    "Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "the company") + "\n" +
    "Skill Gaps: " + (gaps || "none") + "\n" +
    "Missing Skills/Keywords: " + (missingKeywords || "none") + "\n\n" +
    "Create a realistic, prioritized learning plan focusing on 4-6 most critical gaps. " +
    "For each item include: skill name, why it matters for THIS role, priority level (high/medium/low), timeframe (e.g., 4-6 weeks), and 2 concrete real resources (with exact course/cert names, platforms like Coursera/Udemy/AWS/Google Cloud, and how it helps). " +
    'Return ONLY valid JSON, no markdown: {"items": [{"skill": "name", "why": "reason", "priority": "high", "timeframe": "weeks", "resources": [{"title": "exact name", "type": "course|certification|project|book", "description": "what and why", "platform": "platform name"}]}]}';

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let parsed: { items: unknown[] } = { items: [] };
    try {
      parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.items)) parsed.items = [];
    } catch {
      parsed = { items: [] };
    }

    await db
      .update(analyses)
      .set({ learningPlan: parsed.items as Parameters<typeof db.update>[0] })
      .where(eq(analyses.id, params.data.id));

    res.json(parsed);
  } catch (err) {
    logger.error({ err }, "Learning plan generation failed");
    res.status(500).json({ error: "Learning plan generation failed" });
  }
});

router.post("/analyses/:id/rewrite-bullet", async (req, res): Promise<void> => {
  const params = RewriteBulletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = RewriteBulletBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  req.log.info({ id: params.data.id }, "Rewriting resume bullet");

  const missingKeywords = (analysis.atsKeywordsMissing as string[]).slice(0, 10).join(", ");
  const gaps = (analysis.gaps as string[]).slice(0, 5).join("; ");

  const prompt =
    "You are an expert resume writer. Rewrite the following resume bullet point to be stronger, more impactful, and to naturally incorporate relevant keywords from the job description.\n\n" +
    "Original bullet:\n\"" + body.data.bulletText + "\"\n\n" +
    "Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "the company") + "\n\n" +
    "Key missing ATS keywords to incorporate where relevant: " + (missingKeywords || "none specified") + "\n" +
    "Gaps identified in the resume: " + (gaps || "none specified") + "\n\n" +
    "Rules:\n" +
    "- Start with a strong action verb\n" +
    "- Include quantified results if the original has metrics, or suggest placeholders like [X%] if appropriate\n" +
    "- Naturally weave in 1-3 of the missing keywords only if they genuinely fit\n" +
    "- Keep it to 1-2 lines, concise and punchy\n" +
    "- Do NOT make up facts not implied by the original\n" +
    "- Return ONLY the rewritten bullet text, nothing else, no quotes";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const rewritten = completion.choices[0]?.message?.content?.trim() ?? "";

    res.json({ original: body.data.bulletText, rewritten });
  } catch (err) {
    logger.error({ err }, "Bullet rewrite failed");
    res.status(500).json({ error: "Bullet rewrite failed" });
  }
});

export default router;
