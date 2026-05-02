import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, analyses } from "@workspace/db";
import {
  CreateAnalysisBody,
  GetAnalysisParams,
  DeleteAnalysisParams,
  GenerateCoverLetterParams,
  GenerateCoverLetterBody,
  GenerateLinkedinPostParams,
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

  const prompt = `You are an expert resume analyst, career coach, and ATS (Applicant Tracking System) specialist.

Analyze this resume against the provided job description and return a comprehensive JSON response.

Resume:
${resumeText}

Job Description:
${jobDescriptionText}

Job Title: ${jobTitle}
Company: ${companyName ?? "Not specified"}

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "fitScore": <integer 0-100>,
  "fitRationale": "<2-3 sentence explanation of the fit score>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>", "<gap 3>"],
  "improvements": ["<specific actionable improvement 1>", "<specific actionable improvement 2>", "<specific actionable improvement 3>", "<specific actionable improvement 4>", "<specific actionable improvement 5>"],
  "atsKeywordsMatched": ["<keyword1>", "<keyword2>", "<keyword3>"],
  "atsKeywordsMissing": ["<missing keyword1>", "<missing keyword2>", "<missing keyword3>"],
  "atsScore": <integer 0-100>
}

Guidelines:
- fitScore: Overall match between resume and JD (skills, experience, qualifications)
- strengths: What the candidate does well relative to this role
- gaps: Critical missing skills or experience
- improvements: Specific, actionable resume edits (e.g., "Add quantified metrics to your project descriptions")
- atsKeywordsMatched: Key terms from the JD that appear in the resume
- atsKeywordsMissing: Important JD keywords absent from the resume
- atsScore: How well the resume will pass ATS filters (keyword density, formatting)`;

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

  const prompt = `You are an expert cover letter writer. Write a compelling, tailored cover letter.

Candidate's Resume:
${analysis.resumeText}

Job Description:
${analysis.jobDescriptionText}

Job Title: ${analysis.jobTitle}
Company: ${analysis.companyName ?? "the company"}
Tone: ${tone}

Write a professional cover letter that:
1. Opens with a strong hook that shows genuine enthusiasm
2. Highlights the most relevant experience and skills from the resume that match the JD
3. Addresses any gaps strategically
4. Includes specific examples and quantified achievements where possible
5. Closes with a confident call to action

Write ONLY the cover letter text, no subject lines or extra commentary. Start directly with "Dear Hiring Manager," or similar salutation.`;

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

  const prompt = `You are a LinkedIn content strategist. Write an engaging LinkedIn post for a job seeker.

Resume Summary (key highlights):
${analysis.resumeText.slice(0, 1500)}

Target Role: ${analysis.jobTitle} at ${analysis.companyName ?? "a company"}
Fit Score: ${analysis.fitScore}/100

Write a LinkedIn post that:
1. Announces or hints at their job search journey (without sounding desperate)
2. Highlights 2-3 key strengths relevant to their target role
3. Shows genuine enthusiasm for the industry/role
4. Ends with a call to action (open to connections, opportunities, etc.)
5. Uses appropriate LinkedIn formatting (line breaks, no markdown)
6. Is 150-250 words
7. Feels authentic, not like a template

Write ONLY the post text. No hashtags unless they feel natural. No emojis unless they fit. Start directly with the post content.`;

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

export default router;
