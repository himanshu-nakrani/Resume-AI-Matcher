import { Router, type IRouter, type Request } from "express";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { z } from "zod";
import { db, analyses, notifications } from "@workspace/db";
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
  GetPracticeFeedbackBody,
  PredictOfferParams,
  ConductMockInterviewParams,
  ConductMockInterviewBody,
} from "@workspace/api-zod";
import { getAiClient } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import { getAiFromRequest, resolveDeepseekKeyForCreate } from "../lib/ai-from-request";
import { parseAiJson } from "../lib/parse-ai-json";
import { optimizeLatexResume, canOptimizeLatex } from "../lib/latex-optimizer";
import { validateLatex, formatValidationErrors } from "../lib/latex-validator";

const router: IRouter = Router();
const execFileAsync = promisify(execFile);

function safeDownloadName(parts: Array<string | null | undefined>, extension: string): string {
  const base = parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base || "optimized-resume"}.${extension}`;
}

async function tryCompileLatex(
  compiler: "tectonic" | "latexmk" | "pdflatex",
  workDir: string,
): Promise<void> {
  switch (compiler) {
    case "tectonic":
      await execFileAsync("tectonic", ["main.tex", "--outdir", workDir], {
        cwd: workDir,
        timeout: 45_000,
      });
      return;
    case "latexmk":
      await execFileAsync("latexmk", ["-pdf", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], {
        cwd: workDir,
        timeout: 60_000,
      });
      return;
    case "pdflatex":
      await execFileAsync(
        "pdflatex",
        ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", workDir, "main.tex"],
        { cwd: workDir, timeout: 60_000 },
      );
      return;
    default: {
      const _never: never = compiler;
      return _never;
    }
  }
}

function sanitizeLatexForPdf(latex: string): string {
  return latex
    // The AI sometimes emits pdfTeX-only accessibility helpers. Tectonic runs XeTeX.
    .replace(/\\input\{glyphtounicode\}\s*/g, "")
    .replace(/\\pdfgentounicode\s*=\s*1\s*/g, "")
    // fontawesome5 can abort Tectonic in this environment; remove icons but keep link text.
    .replace(/\\usepackage(?:\[[^\]]*\])?\{fontawesome5\}\s*/g, "")
    .replace(/\\faIcon\{[^}]+\}/g, "")
    .replace(/\\fa[A-Za-z]+\b/g, "")
    // Keep common resume punctuation representable with the default LaTeX fonts.
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, "--")
    .replace(/–/g, "-")
    .replace(/\u00a0/g, " ");
}

/**
 * PDF-only tweaks that must not fight the resume template.
 * - Hides standard section numbers ("7 CERTIFICATIONS") via `secnumdepth`.
 * Aggressive `fancyhdr` / `\\sectionmark` hooks (v2) broke real resumes (headers/body order);
 * those are stripped when present; v3 is intentionally minimal.
 */
function stripInjectedResumePdfGuards(latex: string): string {
  return (
    latex
      // v2 preamble hook + secnumdepth block before \begin{document}
      .replace(
        /% optmatch-pdf-resume-guards-v2 \(preamble\)\r?\n[\s\S]*?\\makeatother\s*(?=\r?\n*\\begin\{document\})/m,
        "",
      )
      // v2 body block immediately after \begin{document}
      .replace(
        /(\\begin\{document\}\s*\r?\n)% optmatch-pdf-resume-guards-v2 \(body\)\r?\n[\s\S]*?\\makeatother\r?\n/m,
        "$1",
      )
      // v1 one-line marker + fancy clear after \begin{document}
      .replace(
        /% optmatch-pdf-resume-guards\r?\n\\makeatletter\r?\n[\s\S]*?\\makeatother\r?\n?/m,
        "",
      )
  );
}

function injectResumePdfGuards(latex: string): string {
  if (latex.includes("optmatch-pdf-resume-guards-v3")) return latex;

  const cleaned = stripInjectedResumePdfGuards(latex);

  return cleaned.replace(
    /(\\begin\{document\})/,
    "% optmatch-pdf-resume-guards-v3\n" + "\\setcounter{secnumdepth}{0}\n\n" + "$1\n",
  );
}

function extractLatexFromModel(raw: string): string {
  const trimmed = raw.trim();
  try {
    const parsed = parseAiJson<{ latex?: string }>(trimmed);
    if (typeof parsed.latex === "string" && parsed.latex.trim()) {
      return parsed.latex.trim();
    }
  } catch {
    // Fall through to fenced/plain LaTeX extraction.
  }

  return trimmed
    .replace(/^```(?:latex|tex)?\s*\r?\n?/i, "")
    .replace(/\r?\n?```\s*$/i, "")
    .trim();
}

function assertCompleteLatex(latex: string): void {
  if (!/\\documentclass\b/.test(latex) || !/\\begin\{document\}/.test(latex) || !/\\end\{document\}/.test(latex)) {
    throw new Error("The corrected LaTeX was incomplete. Try regenerating the optimization or downloading the .tex file.");
  }
}

async function validateAndCorrectLatexForPdf(
  req: Request,
  inputLatex: string,
  context: { jobTitle: string; companyName: string | null },
): Promise<string> {
  const prompt =
    "You are a senior LaTeX resume production editor. Validate and correct this optimized resume LaTeX before PDF compilation.\n\n" +
    "Goal: produce a clean, readable PDF resume with no overlapping text, no header collisions, no section title collisions, and no content spilling off the page.\n\n" +
    "Rules:\n" +
    "- Return a COMPLETE compilable LaTeX document, not a diff.\n" +
    "- Preserve the candidate's factual content. Do not invent experience, companies, education, dates, links, awards, or metrics.\n" +
    "- It is OK to adjust spacing, margins, font sizes, section formatting, line breaks, tabular widths, and package choices.\n" +
    "- The top name/contact block must be visually isolated: no running headers, no `\\\\leftmark`/`\\\\rightmark` text, and no section titles or section numbers printed beside the name.\n" +
    "- Hide section numbering in the PDF (prefer `\\\\setcounter{secnumdepth}{0}` or unnumbered section macros) so headings read \"CERTIFICATIONS\", not \"7 CERTIFICATIONS\".\n" +
    "- If `fancyhdr` is used, avoid overlapping header text with the name (do not place `\\\\leftmark`/`\\\\rightmark` or section titles in the same header band as the name); prefer a minimal footer for page numbers rather than clearing the whole page style unless necessary.\n" +
    "- Remove or replace fragile icon/font packages if they hurt compilation or layout.\n" +
    "- Remove pdfTeX-only commands that break XeTeX/Tectonic, such as glyphtounicode/pdfgentounicode.\n" +
    "- Keep contact links as plain readable text when icons are removed.\n" +
    "- Prefer a compact ATS-friendly resume that fits neatly without text overlap.\n" +
    "- Return ONLY valid JSON with this shape: {\"latex\":\"<complete corrected LaTeX>\"}\n\n" +
    `Target role: ${context.jobTitle}\n` +
    `Company: ${context.companyName ?? "Not specified"}\n\n` +
    "LaTeX to correct:\n" +
    inputLatex;

  const completion = await getAiFromRequest(req).chat.completions.create({
    model: "deepseek-chat",
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const corrected = extractLatexFromModel(completion.choices[0]?.message?.content ?? "");
  assertCompleteLatex(corrected);
  return corrected;
}

function prepareLatexForPdfCompilation(latex: string): string {
  return sanitizeLatexForPdf(injectResumePdfGuards(latex));
}

async function compileLatexToPdf(latex: string): Promise<Buffer> {
  const workDir = await mkdtemp(path.join(tmpdir(), "optimatch-latex-"));
  try {
    await writeFile(path.join(workDir, "main.tex"), prepareLatexForPdfCompilation(latex), "utf8");

    const errors: Array<{ compiler: string; message: string }> = [];
    for (const compiler of ["tectonic", "latexmk", "pdflatex"] as const) {
      try {
        await tryCompileLatex(compiler, workDir);
        return await readFile(path.join(workDir, "main.pdf"));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ compiler, message });
      }
    }

    const noCompiler = errors.every((error) => error.message.includes("ENOENT"));
    const realError = errors.find((error) => !error.message.includes("ENOENT")) ?? errors.at(-1);
    throw new Error(
      noCompiler
        ? "No LaTeX compiler found. Install tectonic, latexmk, or pdflatex on the API server."
        : `LaTeX compilation failed in ${realError?.compiler ?? "compiler"}. ${realError?.message ?? ""}`.slice(0, 700),
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

router.get("/analyses", async (req, res): Promise<void> => {
  req.log.info("Listing analyses");
  const rows = await db
    .select()
    .from(analyses)
    .orderBy(desc(analyses.createdAt));

  // Auto-create notifications for deadlines ≤3 days and overdue follow-ups
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const toInsert: (typeof notifications.$inferInsert)[] = [];

  for (const a of rows) {
    if (a.deadline) {
      const dl = new Date(a.deadline);
      if (dl >= now && dl <= threeDaysFromNow) {
        const exists = await db.query.notifications.findFirst({
          where: (n, { eq, and }) => and(eq(n.analysisId, a.id), eq(n.type, "deadline")),
        });
        if (!exists) {
          const daysLeft = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          toInsert.push({
            type: "deadline",
            title: "Application deadline soon",
            body: (a.jobTitle) + " at " + (a.companyName ?? "the company") + " — " + (daysLeft === 0 ? "due today" : daysLeft === 1 ? "due tomorrow" : "due in " + daysLeft + " days"),
            analysisId: a.id,
            read: false,
          });
        }
      }
    }
    if (a.followUpDate) {
      const fu = new Date(a.followUpDate);
      if (fu <= now) {
        const exists = await db.query.notifications.findFirst({
          where: (n, { eq, and }) => and(eq(n.analysisId, a.id), eq(n.type, "follow_up")),
        });
        if (!exists) {
          toInsert.push({
            type: "follow_up",
            title: "Follow-up reminder",
            body: "Time to follow up on " + (a.jobTitle) + (a.companyName ? " at " + a.companyName : "") + ".",
            analysisId: a.id,
            read: false,
          });
        }
      }
    }
  }

  if (toInsert.length > 0) {
    await db.insert(notifications).values(toInsert);
  }

  res.json(rows);
});

router.post("/analyses", async (req, res): Promise<void> => {
  const parsed = CreateAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { jobTitle, companyName, resumeText, jobDescriptionText } = parsed.data;
  const sourceLatex = "sourceLatex" in parsed.data ? parsed.data.sourceLatex : undefined;
  const originalFileName = "originalFileName" in parsed.data ? parsed.data.originalFileName : undefined;
  const originalFileType = "originalFileType" in parsed.data ? parsed.data.originalFileType : undefined;
  const deepseekApiKey = "deepseekApiKey" in parsed.data ? parsed.data.deepseekApiKey : undefined;

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
    '  "atsScore": <integer 0-100>,\n' +
    '  "sourceLatex": "<complete LaTeX conversion of the original resume before optimization>",\n' +
    '  "optimizedLatex": "<complete, compilable LaTeX resume tailored to this JD>"\n' +
    "}\n\n" +
    "Detailed Guidelines:\n" +
    "- fitScore: Overall match 0-100 considering required skills presence, experience level, and qualifications match\n" +
    "- fitRationale: Explain WHY this score - reference specific requirements and what the resume delivers\n" +
    "- strengths: Extract 3 most relevant strengths - be specific\n" +
    "- gaps: List critical missing items that would concern a hiring manager\n" +
    "- improvements: Provide 5 specific, immediately actionable edits with examples\n" +
    "- atsKeywordsMatched: Extract 5+ exact keywords/phrases from JD that appear in resume\n" +
    "- atsKeywordsMissing: Extract 5+ important keywords/phrases from JD missing from resume\n" +
    "- atsScore: Rate how ATS will parse resume 0-100\n" +
    "- sourceLatex: If source LaTeX is provided, return it unchanged except for cleanup. If the resume came from PDF or text, convert the original resume into clean, compilable LaTeX and store it here.\n" +
    "- optimizedLatex: Return a complete LaTeX resume that preserves truthful facts from the candidate resume, improves wording for ATS, naturally includes matched JD keywords, and does not invent experience. If source LaTeX is provided, preserve its structure and update the content.\n\n" +
    "Source LaTeX if available:\n" + (sourceLatex || "Not provided");

  let aiResult: {
    fitScore: number;
    fitRationale: string;
    strengths: string[];
    gaps: string[];
    improvements: string[];
    atsKeywordsMatched: string[];
    atsKeywordsMissing: string[];
    atsScore: number;
    sourceLatex?: string;
    optimizedLatex?: string;
  };

  try {
    const ai = getAiClient(resolveDeepseekKeyForCreate(req, deepseekApiKey));
    const completion = await ai.chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    aiResult = parseAiJson(content);
  } catch (err) {
    logger.error({ err }, "AI analysis failed");
    res.status(500).json({ error: "AI analysis failed" });
    return;
  }

  // Use multi-stage optimization if source LaTeX is available
  let finalOptimizedLatex = aiResult.optimizedLatex ?? sourceLatex ?? null;
  const finalSourceLatex = aiResult.sourceLatex ?? sourceLatex ?? null;

  if (finalSourceLatex) {
    req.log.info({ jobTitle }, "Running multi-stage LaTeX optimization");
    
    // Check if optimization is feasible
    const canOptimize = canOptimizeLatex(finalSourceLatex);
    
    if (canOptimize.canOptimize) {
      try {
        const ai = getAiClient(resolveDeepseekKeyForCreate(req, deepseekApiKey));
        const optimizationResult = await optimizeLatexResume(ai, finalSourceLatex, {
          jobTitle,
          companyName: companyName ?? null,
          jobDescription: jobDescriptionText,
          resumeText,
          targetKeywords: aiResult.atsKeywordsMissing ?? [],
          gaps: aiResult.gaps ?? [],
        });

        if (optimizationResult.success) {
          finalOptimizedLatex = optimizationResult.optimizedLatex;
          req.log.info(
            {
              stages: optimizationResult.stages,
              processingTimeMs: optimizationResult.metadata.processingTimeMs,
            },
            "Multi-stage optimization completed successfully"
          );
        } else {
          req.log.warn(
            {
              errors: optimizationResult.validationResult.errors.length,
              warnings: optimizationResult.validationResult.warnings.length,
            },
            "Multi-stage optimization completed with validation errors"
          );
          // Fall back to AI-generated LaTeX if optimization failed
          finalOptimizedLatex = aiResult.optimizedLatex ?? finalSourceLatex;
        }
      } catch (err) {
        req.log.error({ err }, "Multi-stage optimization failed, using fallback");
        // Fall back to AI-generated LaTeX
        finalOptimizedLatex = aiResult.optimizedLatex ?? finalSourceLatex;
      }
    } else {
      req.log.warn({ reason: canOptimize.reason }, "Skipping multi-stage optimization");
    }
  }

  const [row] = await db
    .insert(analyses)
    .values({
      jobTitle,
      companyName: companyName ?? null,
      resumeText,
      originalFileName: originalFileName ?? null,
      originalFileType: originalFileType ?? "text",
      sourceLatex: finalSourceLatex,
      optimizedLatex: finalOptimizedLatex,
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

router.post("/analyses/:id/validate-latex", async (req, res): Promise<void> => {
  const params = GetAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const analysis = await db.query.analyses.findFirst({
    where: eq(analyses.id, params.data.id),
  });

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const latex = analysis.optimizedLatex?.trim();
  if (!latex) {
    res.status(400).json({ error: "No LaTeX content available for validation" });
    return;
  }

  req.log.info({ id: params.data.id }, "Validating LaTeX");

  const validationResult = validateLatex(latex);
  const formattedErrors = formatValidationErrors(validationResult);

  res.json({
    isValid: validationResult.isValid,
    errors: validationResult.errors,
    warnings: validationResult.warnings,
    stats: validationResult.stats,
    formattedReport: formattedErrors,
  });
});

router.get("/analyses/:id/resume.pdf", async (req, res): Promise<void> => {
  const params = GetAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const analysis = await db.query.analyses.findFirst({
    where: eq(analyses.id, params.data.id),
  });

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const latex = analysis.optimizedLatex?.trim();
  if (!latex) {
    res.status(400).json({ error: "No optimized LaTeX is available for this analysis." });
    return;
  }

  try {
    const correctedLatex = await validateAndCorrectLatexForPdf(req, latex, {
      jobTitle: analysis.jobTitle,
      companyName: analysis.companyName,
    });
    const normalizedLatex = correctedLatex.trim();
    const finalLatex = prepareLatexForPdfCompilation(normalizedLatex);
    if (finalLatex !== latex) {
      await db
        .update(analyses)
        .set({ optimizedLatex: finalLatex })
        .where(eq(analyses.id, params.data.id));
    }

    const pdf = await compileLatexToPdf(finalLatex);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeDownloadName([analysis.companyName, analysis.jobTitle], "pdf")}"`,
    );
    res.send(pdf);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not compile optimized resume PDF.";
    logger.error({ err, id: params.data.id }, "Optimized resume PDF compilation failed");
    res.status(500).json({ error: message });
  }
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
  if (body.data.portfolioLinks !== undefined) updates.portfolioLinks = body.data.portfolioLinks;
  if (body.data.versionLabel !== undefined) updates.versionLabel = body.data.versionLabel;
  if (body.data.location !== undefined) updates.location = body.data.location;
  if (body.data.salaryExpectation !== undefined) updates.salaryExpectation = body.data.salaryExpectation;

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
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let guide: {
      low: number; mid: number; high: number; currency: string; period: string;
      context: string; factors: string[]; negotiationTips: string[];
    };
    try {
      guide = parseAiJson(raw);
    } catch {
      res.status(500).json({ error: "Failed to parse salary guide" });
      return;
    }

    await db
      .update(analyses)
      .set({ salaryGuide: guide as import("@workspace/db").SalaryRange })
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

    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: extractPrompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let extracted: { jobTitle?: string; companyName?: string; jobDescription?: string } = {};
    try {
      extracted = parseAiJson(raw);
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
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
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
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
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
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    let questions: string[] = [];
    try {
      questions = parseAiJson(raw);
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
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let parsed: { items: unknown[] } = { items: [] };
    try {
      parsed = parseAiJson(raw);
      if (!Array.isArray(parsed.items)) parsed.items = [];
    } catch {
      parsed = { items: [] };
    }

    await db
      .update(analyses)
      .set({ learningPlan: parsed.items as import("@workspace/db").LearningPlanItem[] })
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
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
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

// --- Company Research ---

const CompanyResearchParams = GenerateSalaryGuideParams; // same shape: {id: number}

router.post("/analyses/:id/company-research", async (req, res): Promise<void> => {
  const params = CompanyResearchParams.safeParse(req.params);
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

  req.log.info({ id: params.data.id }, "Generating company research");

  const company = analysis.companyName ?? "the company";
  const prompt =
    "You are a career research specialist. Provide a concise company research brief for a job candidate interviewing at this company.\n\n" +
    "Company: " + company + "\n" +
    "Role: " + analysis.jobTitle + "\n" +
    "Job Description excerpt: " + analysis.jobDescriptionText.slice(0, 1500) + "\n\n" +
    "Based on publicly available knowledge about this company and role, provide a useful research brief.\n" +
    "Return ONLY valid JSON (no markdown):\n" +
    '{"overview": "<2-3 sentence company overview: what they do, size, industry>", ' +
    '"culture": "<2-3 sentence culture description based on values, mission, and typical work environment>", ' +
    '"interviewProcess": "<typical interview process description for this type of role>", ' +
    '"recentNews": ["<relevant company news/development 1>", "<item 2>", "<item 3>"], ' +
    '"glassdoorRating": "<estimated rating or N/A with brief note>", ' +
    '"tips": ["<specific preparation tip 1 for THIS role/company>", "<tip 2>", "<tip 3>"]}';

  try {
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let research: {
      overview: string; culture: string; interviewProcess: string;
      recentNews: string[]; glassdoorRating: string; tips: string[];
    };
    try {
      research = parseAiJson(raw);
    } catch {
      res.status(500).json({ error: "Failed to parse company research" });
      return;
    }

    await db
      .update(analyses)
      .set({ companyResearch: research })
      .where(eq(analyses.id, params.data.id));

    res.json(research);
  } catch (err) {
    logger.error({ err }, "Company research generation failed");
    res.status(500).json({ error: "Company research generation failed" });
  }
});

// --- Red Flags ---

const RedFlagsParams = GenerateSalaryGuideParams;

router.post("/analyses/:id/red-flags", async (req, res): Promise<void> => {
  const params = RedFlagsParams.safeParse(req.params);
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

  req.log.info({ id: params.data.id }, "Detecting red flags");

  const prompt =
    "You are an experienced career counselor and job market expert. Analyze this job description for potential red flags that a candidate should be aware of before applying.\n\n" +
    "Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "not specified") + "\n" +
    "Job Description:\n" + analysis.jobDescriptionText + "\n\n" +
    "Look for: unrealistic expectations (wear many hats, 10x engineer, rockstar), vague compensation (competitive salary), unpaid overtime signals (fast-paced, startup mentality, work hard play hard), scope creep indicators, unclear reporting structure, high turnover signals, toxic culture hints, suspicious requirements, etc.\n" +
    "Be balanced — only flag genuine concerns, not normal job requirements. If the JD looks healthy, return few or no flags.\n" +
    "Return ONLY valid JSON (no markdown):\n" +
    '{"flags": [{"severity": "high|medium|low", "title": "<short name>", "description": "<explanation>", "quote": "<exact phrase from JD that triggered this flag>"}], ' +
    '"summary": "<1-2 sentence overall assessment>", ' +
    '"overallRisk": "low|medium|high"}';

  try {
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: {
      flags: Array<{ severity: string; title: string; description: string; quote: string }>;
      summary: string;
      overallRisk: string;
    };
    try {
      result = parseAiJson(raw);
      if (!Array.isArray(result.flags)) result.flags = [];
    } catch {
      res.status(500).json({ error: "Failed to parse red flags analysis" });
      return;
    }

    await db
      .update(analyses)
      .set({ redFlags: result.flags as import("@workspace/db").RedFlag[] })
      .where(eq(analyses.id, params.data.id));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Red flags detection failed");
    res.status(500).json({ error: "Red flags detection failed" });
  }
});

// --- Negotiation Simulator ---

const NegotiateParams = GenerateSalaryGuideParams;
const NegotiateBody = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
});

router.post("/analyses/:id/negotiate", async (req, res): Promise<void> => {
  const params = NegotiateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = NegotiateBody.safeParse(req.body);
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

  req.log.info({ id: params.data.id }, "Running negotiation simulation");

  const salaryContext = analysis.salaryGuide
    ? "Market salary range: " + (analysis.salaryGuide as { low: number; mid: number; high: number; currency: string }).low + "–" + (analysis.salaryGuide as { low: number; mid: number; high: number; currency: string }).high + " " + (analysis.salaryGuide as { currency: string }).currency + "/year."
    : "";

  const systemPrompt =
    "You are a recruiter at " + (analysis.companyName ?? "a company") + " conducting a salary negotiation for the role of " + analysis.jobTitle + ". " +
    salaryContext + " " +
    "Play the role of a professional but firm recruiter. Be realistic — start with a reasonable offer, push back on high counter-offers, but show flexibility. " +
    "Keep responses concise (2-4 sentences). After your response, add a JSON field 'tip' with a brief coaching tip for the candidate (what they did well or could improve). " +
    "Return ONLY valid JSON: {\"message\": \"<recruiter response>\", \"tip\": \"<coaching tip>\"}";

  const messages = body.data.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  try {
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: { message: string; tip?: string };
    try {
      result = parseAiJson(raw);
    } catch {
      result = { message: raw };
    }

    res.json({ message: result.message ?? "", tip: result.tip ?? "" });
  } catch (err) {
    logger.error({ err }, "Negotiation simulation failed");
    res.status(500).json({ error: "Negotiation simulation failed" });
  }
});

// --- STAR Answer Generator ---

const StarAnswerParams = GenerateSalaryGuideParams;
const StarAnswerBody = z.object({
  question: z.string(),
  situation: z.string().optional(),
  task: z.string().optional(),
  action: z.string().optional(),
  result: z.string().optional(),
});

router.post("/analyses/:id/star-answer", async (req, res): Promise<void> => {
  const params = StarAnswerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = StarAnswerBody.safeParse(req.body);
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

  req.log.info({ id: params.data.id }, "Generating STAR answer");

  const hasDraft = body.data.situation || body.data.task || body.data.action || body.data.result;

  const prompt =
    "You are an expert interview coach. " +
    (hasDraft
      ? "Polish the candidate's STAR-method answer into a compelling, concise interview response.\n\n"
      : "Generate a strong STAR-method answer for this interview question based on the candidate's resume.\n\n") +
    "Interview Question: " + body.data.question + "\n" +
    "Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "the company") + "\n" +
    "Candidate Strengths: " + ((analysis.strengths as string[]).slice(0, 3).join("; ") || "not specified") + "\n\n" +
    (hasDraft
      ? "Candidate's draft:\n" +
        "Situation: " + (body.data.situation ?? "(not provided)") + "\n" +
        "Task: " + (body.data.task ?? "(not provided)") + "\n" +
        "Action: " + (body.data.action ?? "(not provided)") + "\n" +
        "Result: " + (body.data.result ?? "(not provided)") + "\n\n"
      : "Resume excerpt:\n" + analysis.resumeText.slice(0, 1200) + "\n\n") +
    "Write a polished 150-250 word STAR answer. Make it specific, confident, and quantified where possible. " +
    "Also provide 2-3 coaching tips. Return ONLY valid JSON (no markdown):\n" +
    '{"answer": "<full polished STAR answer>", "tips": ["<tip 1>", "<tip 2>", "<tip 3>"]}';

  try {
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: { answer: string; tips: string[] };
    try {
      result = parseAiJson(raw);
      if (!Array.isArray(result.tips)) result.tips = [];
    } catch {
      result = { answer: raw, tips: [] };
    }

    res.json({ answer: result.answer ?? "", tips: result.tips ?? [] });
  } catch (err) {
    logger.error({ err }, "STAR answer generation failed");
    res.status(500).json({ error: "STAR answer generation failed" });
  }
});

// ─── Notifications ────────────────────────────────────────────────────────────

router.get("/notifications", async (req, res): Promise<void> => {
  const items = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt));
  res.json(items.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    analysisId: n.analysisId,
    read: n.read,
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : String(n.createdAt),
  })));
  return;
});

router.patch("/notifications", async (_req, res): Promise<void> => {
  await db.update(notifications).set({ read: true });
  res.status(204).end();
  return;
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json({
    id: updated.id,
    type: updated.type,
    title: updated.title,
    body: updated.body,
    analysisId: updated.analysisId,
    read: updated.read,
    createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : String(updated.createdAt),
  });
  return;
});

// ─── Market Insights ──────────────────────────────────────────────────────────

router.post("/analyses/:id/market-insights", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const analysis = await db.query.analyses.findFirst({ where: eq(analyses.id, id) });
  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const prompt =
    "You are a job market analyst. Based on the job title and description below, provide current job market data.\n\n" +
    "Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "unknown") + "\n" +
    "Job Description (first 600 chars): " + analysis.jobDescriptionText.slice(0, 600) + "\n\n" +
    "Provide real-world market data for this role. Return ONLY valid JSON (no markdown):\n" +
    '{"demandLevel":"high|medium|low","salaryMin":<annual USD integer>,"salaryMax":<annual USD integer>,"salaryCurrency":"USD","salaryPeriod":"year","topSkills":["<5 most in-demand skills for this role>"],"marketContext":"<2-3 sentence market overview>","hiringTrend":"<one sentence: growing/stable/declining and why>","remoteOutlook":"<one sentence about remote/hybrid/onsite prevalence>"}';

  try {
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: { demandLevel: string; salaryMin: number; salaryMax: number; salaryCurrency: string; salaryPeriod: string; topSkills: string[]; marketContext: string; hiringTrend: string; remoteOutlook: string };
    try { result = parseAiJson(raw); } catch { result = { demandLevel: "medium", salaryMin: 80000, salaryMax: 120000, salaryCurrency: "USD", salaryPeriod: "year", topSkills: [], marketContext: raw, hiringTrend: "", remoteOutlook: "" }; }
    res.json({
      demandLevel: ["high", "medium", "low"].includes(result.demandLevel) ? result.demandLevel : "medium",
      salaryMin: Number(result.salaryMin) || 80000,
      salaryMax: Number(result.salaryMax) || 120000,
      salaryCurrency: result.salaryCurrency ?? "USD",
      salaryPeriod: ["year", "month", "hour"].includes(result.salaryPeriod) ? result.salaryPeriod : "year",
      topSkills: Array.isArray(result.topSkills) ? result.topSkills.slice(0, 5) : [],
      marketContext: result.marketContext ?? "",
      hiringTrend: result.hiringTrend ?? "",
      remoteOutlook: result.remoteOutlook ?? "",
    });
    return;
  } catch (err) {
    logger.error({ err }, "Market insights generation failed");
    res.status(500).json({ error: "Market insights generation failed" });
    return;
  }
});

// ─── Career Path ──────────────────────────────────────────────────────────────

router.post("/analyses/:id/career-path", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const analysis = await db.query.analyses.findFirst({ where: eq(analyses.id, id) });
  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const prompt =
    "You are an expert career coach. Based on the target job below, map out a realistic career progression.\n\n" +
    "Target Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "unknown") + "\n" +
    "Matched Skills: " + (analysis.strengths ?? []).slice(0, 5).join(", ") + "\n" +
    "Skill Gaps: " + (analysis.gaps ?? []).slice(0, 5).join(", ") + "\n\n" +
    "Provide a career path. Return ONLY valid JSON (no markdown):\n" +
    '{"currentRoleInference":"<infer likely current role based on gaps>","nextSteps":[{"title":"<role>","description":"<1 sentence>","timeframe":"<e.g. 1-2 years>","keySkills":["<3 skills>"],"isStretch":false},{"title":"<role>","description":"<1 sentence>","timeframe":"<e.g. 2-3 years>","keySkills":["<3 skills>"],"isStretch":false},{"title":"<role>","description":"<1 sentence>","timeframe":"<e.g. 3-4 years>","keySkills":["<3 skills>"],"isStretch":false}],"stretchRoles":[{"title":"<senior/leadership role>","description":"<1 sentence>","timeframe":"<e.g. 5+ years>","keySkills":["<3 skills>"],"isStretch":true},{"title":"<executive/specialized role>","description":"<1 sentence>","timeframe":"<e.g. 7+ years>","keySkills":["<3 skills>"],"isStretch":true}],"overallTimeline":"<1 sentence summary of full journey>","keyThemes":["<3-4 career development themes>"]}';

  try {
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: { currentRoleInference: string; nextSteps: { title: string; description: string; timeframe: string; keySkills: string[]; isStretch: boolean }[]; stretchRoles: { title: string; description: string; timeframe: string; keySkills: string[]; isStretch: boolean }[]; overallTimeline: string; keyThemes: string[] };
    try { result = parseAiJson(raw); } catch { result = { currentRoleInference: "", nextSteps: [], stretchRoles: [], overallTimeline: raw, keyThemes: [] }; }
    res.json({
      currentRoleInference: result.currentRoleInference ?? "",
      nextSteps: Array.isArray(result.nextSteps) ? result.nextSteps.slice(0, 3) : [],
      stretchRoles: Array.isArray(result.stretchRoles) ? result.stretchRoles.slice(0, 2) : [],
      overallTimeline: result.overallTimeline ?? "",
      keyThemes: Array.isArray(result.keyThemes) ? result.keyThemes.slice(0, 4) : [],
    });
    return;
  } catch (err) {
    logger.error({ err }, "Career path generation failed");
    res.status(500).json({ error: "Career path generation failed" });
    return;
  }
});

// ─── Follow-up Email ──────────────────────────────────────────────────────────

router.post("/analyses/:id/follow-up-email", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const analysis = await db.query.analyses.findFirst({ where: eq(analyses.id, id) });
  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const emailType = (req.body?.emailType as string) ?? "after_apply";
  const emailTypeLabel =
    emailType === "after_interview" ? "after an interview" :
    emailType === "thank_you" ? "as a thank-you note after an interview" :
    "after submitting an application";

  const contactPart = analysis.contactName ? (" The hiring contact is " + analysis.contactName + ".") : "";
  const prompt =
    "You are a career coach writing a professional follow-up email " + emailTypeLabel + ".\n\n" +
    "Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "the company") + "\n" +
    "Key Strengths: " + (analysis.strengths ?? []).slice(0, 3).join(", ") + "\n" +
    contactPart + "\n\n" +
    "Write a concise, professional follow-up email. Return ONLY valid JSON (no markdown):\n" +
    '{"subject":"<email subject line>","body":"<full email body, 100-180 words, warm and professional, use [Your Name] placeholder>","tips":["<2-3 brief sending tips>"]}';

  try {
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: { subject: string; body: string; tips: string[] };
    try { result = parseAiJson(raw); } catch { result = { subject: "Following up on my application", body: raw, tips: [] }; }
    res.json({
      subject: result.subject ?? "Following up on my application",
      body: result.body ?? "",
      tips: Array.isArray(result.tips) ? result.tips.slice(0, 3) : [],
    });
    return;
  } catch (err) {
    logger.error({ err }, "Follow-up email generation failed");
    res.status(500).json({ error: "Follow-up email generation failed" });
    return;
  }
});

// ─── Predict Offer ────────────────────────────────────────────────────────────

router.post("/analyses/:id/predict-offer", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const analysis = await db.query.analyses.findFirst({ where: eq(analyses.id, id) });
  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const prompt =
    "You are a senior recruiter and data scientist predicting the likelihood of a job offer based on a resume vs job description match.\n\n" +
    "Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "the company") + "\n" +
    "Fit Score: " + analysis.fitScore + "/100\n" +
    "ATS Score: " + analysis.atsScore + "/100\n" +
    "Key Strengths: " + (analysis.strengths ?? []).slice(0, 4).join(", ") + "\n" +
    "Key Gaps: " + (analysis.gaps ?? []).slice(0, 4).join(", ") + "\n" +
    "Missing Keywords: " + (analysis.atsKeywordsMissing ?? []).slice(0, 5).join(", ") + "\n\n" +
    "Based on these signals, predict the probability of receiving an offer (0-100). " +
    "Be realistic — most candidates are 20-60%, exceptional is 70-85%, near-perfect is 85+%. " +
    "Return ONLY valid JSON (no markdown):\n" +
    '{"probability": <0-100>, "rating": "<strong|good|fair|weak>", "strengthFactors": ["<2-3 factors helping the odds>"], "riskFactors": ["<2-3 factors hurting the odds>"], "actionItems": ["<2-3 specific actions to improve odds>"], "summary": "<1 concise sentence prediction with reasoning>"}';

  try {
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: { probability: number; rating: string; strengthFactors: string[]; riskFactors: string[]; actionItems: string[]; summary: string };
    try { result = parseAiJson(raw); } catch {
      result = { probability: 50, rating: "fair", strengthFactors: [], riskFactors: [], actionItems: [], summary: raw };
    }
    res.json({
      probability: Math.max(0, Math.min(100, Number(result.probability) || 50)),
      rating: ["strong", "good", "fair", "weak"].includes(result.rating) ? result.rating : "fair",
      strengthFactors: Array.isArray(result.strengthFactors) ? result.strengthFactors.slice(0, 3) : [],
      riskFactors: Array.isArray(result.riskFactors) ? result.riskFactors.slice(0, 3) : [],
      actionItems: Array.isArray(result.actionItems) ? result.actionItems.slice(0, 3) : [],
      summary: result.summary ?? "",
    });
    return;
  } catch (err) {
    logger.error({ err }, "Offer prediction failed");
    res.status(500).json({ error: "Offer prediction failed" });
    return;
  }
});

// ─── Mock Interview ────────────────────────────────────────────────────────────

router.post("/analyses/:id/mock-interview", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const analysis = await db.query.analyses.findFirst({ where: eq(analyses.id, id) });
  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const messages: { role: string; content: string }[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const isStart = messages.length === 0;
  const turnCount = messages.filter((m) => m.role === "assistant").length;
  const maxTurns = 5;
  const isComplete = turnCount >= maxTurns;

  const systemPrompt =
    "You are a professional interviewer conducting a mock job interview for the role of " + analysis.jobTitle + " at " + (analysis.companyName ?? "the company") + ".\n" +
    "The candidate's key strengths are: " + (analysis.strengths ?? []).slice(0, 3).join(", ") + ".\n" +
    "Their gaps are: " + (analysis.gaps ?? []).slice(0, 3).join(", ") + ".\n\n" +
    "Rules:\n" +
    "- Ask one focused interview question at a time.\n" +
    "- If this is not the first question, provide 1-2 sentence feedback on the previous answer before asking the next question.\n" +
    "- Mix behavioural (STAR), technical, and situational questions relevant to the role.\n" +
    "- After " + maxTurns + " questions total, end with encouraging overall notes.\n\n" +
    (isComplete
      ? "The interview is now complete. Provide brief overall feedback (2-3 sentences) on interview performance based on the conversation."
      : isStart
        ? "Start the interview with a warm welcome and your first question."
        : "Provide brief feedback on the previous answer, then ask your next question.");

  const apiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 400,
      messages: apiMessages,
    });
    const responseText = completion.choices[0]?.message?.content?.trim() ?? "Let's continue the interview.";

    res.json({
      question: responseText,
      feedback: null,
      isComplete,
      overallNotes: isComplete ? responseText : null,
    });
    return;
  } catch (err) {
    logger.error({ err }, "Mock interview failed");
    res.status(500).json({ error: "Mock interview failed" });
    return;
  }
});

// ─── Practice Feedback ────────────────────────────────────────────────────────

router.post("/analyses/:id/practice-feedback", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const analysis = await db.query.analyses.findFirst({ where: eq(analyses.id, id) });
  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const body = GetPracticeFeedbackBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const prompt =
    "You are an expert interview coach evaluating a candidate's STAR-method answer.\n\n" +
    "Job Title: " + analysis.jobTitle + "\n" +
    "Company: " + (analysis.companyName ?? "the company") + "\n" +
    "Question: " + body.data.question + "\n" +
    "Time Used: " + body.data.timeUsed + " seconds\n\n" +
    "Candidate's Answer:\n" + body.data.answer + "\n\n" +
    "Evaluate the answer strictly on the STAR framework (Situation, Task, Action, Result). " +
    "Score 0-100 (25 pts per STAR component). Also provide 2-3 specific strengths, 2-3 improvement tips, and a model answer. " +
    "Return ONLY valid JSON (no markdown):\n" +
    '{"score": <0-100>, "feedback": "<1-2 sentence overall summary>", "strengths": ["..."], "improvements": ["..."], "modelAnswer": "<100-200 word STAR answer>"}';

  try {
    const completion = await getAiFromRequest(req).chat.completions.create({
      model: "deepseek-chat",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: { score: number; feedback: string; strengths: string[]; improvements: string[]; modelAnswer: string };
    try {
      result = parseAiJson(raw);
    } catch {
      result = { score: 50, feedback: raw, strengths: [], improvements: [], modelAnswer: "" };
    }

    res.json({
      score: Math.max(0, Math.min(100, Number(result.score) || 50)),
      feedback: result.feedback ?? "",
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      improvements: Array.isArray(result.improvements) ? result.improvements : [],
      modelAnswer: result.modelAnswer ?? "",
    });
    return;
  } catch (err) {
    logger.error({ err }, "Practice feedback generation failed");
    res.status(500).json({ error: "Practice feedback generation failed" });
    return;
  }
});

export default router;
