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
  ShareAnalysisParams,
  UnshareAnalysisParams,
  GetSharedAnalysisParams,
  FetchJobDescriptionBody,
  DuplicateAnalysisParams,
} from "@workspace/api-zod";
import {
  getAiClient,
  runAiCompletion,
  isAiError,
  FIREWORKS_DEFAULT_MODEL,
} from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import { sendApiError } from "../lib/api-error";
import { sendAiError } from "../lib/send-ai-error";
import { parseAiJson } from "../lib/parse-ai-json";
import { optimizeLatexResume, canOptimizeLatex } from "../lib/latex-optimizer";
import { validateLatex, formatValidationErrors } from "../lib/latex-validator";
import { fetchReadableTextFromUrl, UnsafeUrlError } from "../lib/safe-url-fetch";

const router: IRouter = Router();
const execFileAsync = promisify(execFile);

type LatexCompiler = "tectonic" | "latexmk" | "pdflatex";

type LatexCompilerFailure = {
  compiler: LatexCompiler;
  message: string;
  stdout?: string;
  stderr?: string;
  code?: string | number;
};

class LatexCompileFailure extends Error {
  constructor(
    readonly failures: LatexCompilerFailure[],
    readonly workDir: string,
  ) {
    super(latexCompileFailureMessage(failures, workDir));
    this.name = "LatexCompileFailure";
  }
}

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

function safeScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function tryCompileLatex(
  compiler: LatexCompiler,
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
    .replace(/\\fa[A-Z][A-Za-z]*\b/g, "")
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
      // v3: legacy setcounter next to \begin{document} (broke some engines / templates)
      .replace(
        /% optmatch-pdf-resume-guards-v3\s*\r?\n\\setcounter\{secnumdepth\}\{0\}\s*\r?\n+(?=\\begin\{document\})/m,
        "",
      )
      .replace(
        /(\\begin\{document\})\s*\r?\n% optmatch-pdf-resume-guards-v3\s*\r?\n\\setcounter\{secnumdepth\}\{0\}\s*\r?\n/m,
        "$1\n",
      )
      // v3: \AtBeginDocument hook (strip before re-injecting)
      .replace(/% optmatch-pdf-resume-guards-v3\s*\r?\n\\AtBeginDocument\{\\setcounter\{secnumdepth\}\{0\}\}\s*\r?\n?/g, "")
  );
}

function injectResumePdfGuards(latex: string): string {
  const cleaned = stripInjectedResumePdfGuards(latex);
  const hookLine = "\\AtBeginDocument{\\setcounter{secnumdepth}{0}}";
  const guardBlock = `% optmatch-pdf-resume-guards-v3\n${hookLine}\n`;
  if (cleaned.includes("optmatch-pdf-resume-guards-v3") || cleaned.includes(hookLine))
    return cleaned;

  const withAfterClass = cleaned.replace(/(\\documentclass(?:\[[^\]]*\])?\s*\{[^}]+\}\s*)/m, `$1\n${guardBlock}`);
  if (withAfterClass !== cleaned) return withAfterClass;

  const idx = cleaned.indexOf("\\begin{document}");
  if (idx === -1) return cleaned;
  return cleaned.slice(0, idx) + guardBlock + cleaned.slice(idx);
}

function extractLatexFromModel(raw: string): string {
  const trimmed = raw.trim();

  const candidates: string[] = [];
  try {
    const parsed = parseAiJson<{ latex?: string }>(trimmed);
    if (typeof parsed.latex === "string" && parsed.latex.trim()) {
      candidates.push(parsed.latex.trim());
    }
  } catch {
    // Fall through to fenced/plain LaTeX extraction.
  }
  candidates.push(
    trimmed
      .replace(/^```(?:latex|tex)?\s*\r?\n?/i, "")
      .replace(/\r?\n?```\s*$/i, "")
      .trim(),
  );

  // Slice from \documentclass through \end{document}. Reasoning-heavy models
  // (GLM-5.2 etc.) may emit prose before/after the LaTeX; the compiler treats
  // those lines as LaTeX and fails with confusing errors.
  for (const c of candidates) {
    const start = c.indexOf("\\documentclass");
    if (start === -1) continue;
    const endMarker = "\\end{document}";
    const endIdx = c.lastIndexOf(endMarker);
    if (endIdx === -1 || endIdx <= start) continue;
    return c.slice(start, endIdx + endMarker.length).trim();
  }

  return trimmed;
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
  route: string,
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

  const completion = await runAiCompletion(getAiClient(), {
    model: FIREWORKS_DEFAULT_MODEL,
    max_completion_tokens: 32768,
    messages: [{ role: "user", content: prompt }],
  }, { route });

  const corrected = extractLatexFromModel(completion.choices[0]?.message?.content ?? "");
  assertCompleteLatex(corrected);
  return corrected;
}

function prepareLatexForPdfCompilation(latex: string): string {
  return sanitizeLatexForPdf(injectResumePdfGuards(latex));
}

function isPdfRepairRequested(req: Request): boolean {
  const repair = req.query.repair;
  return repair === "1" || repair === "true";
}

function stringOutput(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (value instanceof Uint8Array) {
    const trimmed = Buffer.from(value).toString("utf8").trim();
    return trimmed || undefined;
  }
  return undefined;
}

function compactJson(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  try {
    const json = JSON.stringify(value);
    return json === "{}" ? undefined : json;
  } catch {
    return undefined;
  }
}

function compilerFailureFromUnknown(
  compiler: LatexCompiler,
  err: unknown,
): LatexCompilerFailure {
  const source =
    err && typeof err === "object" ? (err as Record<string, unknown>) : null;
  const message =
    (err instanceof Error ? stringOutput(err.message) : undefined) ??
    stringOutput(err) ??
    compactJson(err) ??
    "Unknown compiler failure.";
  const stdout = stringOutput(source?.stdout);
  const stderr = stringOutput(source?.stderr);
  const code =
    typeof source?.code === "string" || typeof source?.code === "number"
      ? source.code
      : undefined;

  return { compiler, message, stdout, stderr, code };
}

function latexCompileFailureText(failure: LatexCompilerFailure): string {
  const parts = [failure.stderr, failure.stdout, failure.message]
    .filter((part): part is string => Boolean(part))
    .filter((part, index, all) => all.indexOf(part) === index);
  return parts.join("\n");
}

function latexCompileFailureMessage(
  failures: LatexCompilerFailure[],
  workDir: string,
): string {
  const noCompiler = failures.every((failure) => {
    const text = latexCompileFailureText(failure);
    return failure.code === "ENOENT" || text.includes("ENOENT");
  });
  if (noCompiler) {
    return "No LaTeX compiler found. Install tectonic, latexmk, or pdflatex on the API server.";
  }

  const realFailure =
    failures.find((failure) => failure.code !== "ENOENT" && !latexCompileFailureText(failure).includes("ENOENT")) ??
    failures.at(-1);
  return `LaTeX compilation failed in ${realFailure?.compiler ?? "compiler"}. ${
    realFailure ? latexCompileFailureText(realFailure) : ""
  } [workdir: ${workDir}]`.slice(0, 900);
}

export function formatLatexCompileError(err: unknown): string {
  const objectFailure =
    err && typeof err === "object"
      ? latexCompileFailureText(compilerFailureFromUnknown("tectonic", err))
      : undefined;
  const raw =
    err instanceof LatexCompileFailure
      ? latexCompileFailureText(
          err.failures.find((failure) => latexCompileFailureText(failure).match(/error|failed|missing|undefined|halted/i)) ??
            err.failures.at(-1) ?? {
              compiler: "tectonic",
              message: err.message,
            },
        )
      : err instanceof Error
        ? err.message
        : stringOutput(err) ?? objectFailure ?? compactJson(err) ?? "Unknown PDF compilation failure.";
  const lines = raw
    .replace(/\s*\[workdir: [^\]]+\]/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("Command failed:"));

  const usefulLines = lines.filter((line) => (
    /error|failed|missing|undefined|halted|no latex compiler/i.test(line)
  ));
  const detail = (usefulLines.length > 0 ? usefulLines : lines).slice(0, 5).join(" ");

  return detail
    ? `Could not compile optimized resume PDF. ${detail}`.slice(0, 700)
    : "Could not compile optimized resume PDF.";
}

function formatNotificationCreatedAt(value: Date | number | string): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(milliseconds).toISOString();
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    return new Date(milliseconds).toISOString();
  }
  return new Date(value).toISOString();
}

function isLatexCompileFailure(err: unknown): boolean {
  if (err instanceof LatexCompileFailure) return true;
  if (!(err instanceof Error)) return false;
  return err.message.includes("LaTeX compilation failed") || err.message.includes("No LaTeX compiler found");
}

async function compileLatexToPdf(latex: string): Promise<Buffer> {
  const workDir = await mkdtemp(path.join(tmpdir(), "optimatch-latex-"));
  let succeeded = false;
  try {
    await writeFile(path.join(workDir, "main.tex"), prepareLatexForPdfCompilation(latex), "utf8");

    const errors: LatexCompilerFailure[] = [];
    for (const compiler of ["tectonic", "latexmk", "pdflatex"] as const) {
      try {
        await tryCompileLatex(compiler, workDir);
        const pdf = await readFile(path.join(workDir, "main.pdf"));
        succeeded = true;
        return pdf;
      } catch (err) {
        errors.push(compilerFailureFromUnknown(compiler, err));
      }
    }

    throw new LatexCompileFailure(errors, workDir);
  } finally {
    if (succeeded) {
      await rm(workDir, { recursive: true, force: true });
    }
    // On failure, leave workDir behind so we can inspect the tex file. It's a
    // temp dir so it'll be cleaned up by the OS eventually.
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
    const ai = getAiClient();
    const completion = await runAiCompletion(ai, {
      model: FIREWORKS_DEFAULT_MODEL,
      max_completion_tokens: 32768,
      messages: [{ role: "user", content: prompt }],
    }, { route: "/analyses" });

    const finishReason = completion.choices[0]?.finish_reason;
    if (finishReason === "length") {
      logger.error({ finishReason, usage: completion.usage }, "AI analysis truncated");
      res.status(502).json({
        error: "AI analysis truncated (reached max token budget). Try again or shorten the resume/JD.",
      });
      return;
    }
    const content = completion.choices[0]?.message?.content ?? "{}";
    aiResult = parseAiJson(content);
  } catch (err) {
    logger.error({ err }, "AI analysis failed");
    if (isAiError(err)) {
      sendAiError(req, res, err, "AI analysis failed");
    } else {
      res.status(500).json({ error: "AI analysis failed" });
    }
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
        const ai = getAiClient();
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
    sendApiError(req, res, 400, "invalid_analysis_id", "The analysis id is invalid.");
    return;
  }

  const analysis = await db.query.analyses.findFirst({
    where: eq(analyses.id, params.data.id),
  });

  if (!analysis) {
    sendApiError(req, res, 404, "analysis_not_found", "Analysis not found");
    return;
  }

  const latex = analysis.optimizedLatex?.trim();
  if (!latex) {
    sendApiError(
      req,
      res,
      400,
      "optimized_latex_missing",
      "No optimized LaTeX is available for this analysis.",
    );
    return;
  }

  try {
    const preparedLatex = prepareLatexForPdfCompilation(latex);
    try {
      const pdf = await compileLatexToPdf(preparedLatex);
      if (preparedLatex !== latex) {
        await db
          .update(analyses)
          .set({ optimizedLatex: preparedLatex })
          .where(eq(analyses.id, params.data.id));
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeDownloadName([analysis.companyName, analysis.jobTitle], "pdf")}"`,
      );
      res.send(pdf);
      return;
    } catch (compileErr) {
      if (!isPdfRepairRequested(req)) {
        req.log.warn({ err: compileErr, id: params.data.id }, "Optimized resume PDF compilation failed");
        sendApiError(req, res, 422, "optimized_pdf_compile_failed", formatLatexCompileError(compileErr));
        return;
      }
      req.log.warn({ err: compileErr, id: params.data.id }, "Initial LaTeX compilation failed; attempting AI repair");
    }

    const correctedLatex = await validateAndCorrectLatexForPdf(req, preparedLatex, {
      jobTitle: analysis.jobTitle,
      companyName: analysis.companyName,
    }, "/analyses/:id/validate-latex");
    const finalLatex = prepareLatexForPdfCompilation(correctedLatex.trim());
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
    logger.error({ err, id: params.data.id }, "Optimized resume PDF compilation failed");
    if (isAiError(err)) {
      sendAiError(req, res, err);
    } else if (isLatexCompileFailure(err)) {
      sendApiError(req, res, 422, "optimized_pdf_compile_failed", formatLatexCompileError(err));
    } else {
      const message = err instanceof Error ? err.message : "Could not compile optimized resume PDF.";
      sendApiError(req, res, 500, "optimized_pdf_export_failed", message);
    }
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

  const avgFit = rows.reduce((sum, r) => sum + safeScore(r.fitScore), 0) / total;
  const avgAts = rows.reduce((sum, r) => sum + safeScore(r.atsScore), 0) / total;

  const keywordCounts: Record<string, number> = {};
  for (const row of rows) {
    const missing = stringArray(row.atsKeywordsMissing);
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
      strengths: stringArray(original.strengths),
      gaps: stringArray(original.gaps),
      improvements: stringArray(original.improvements),
      atsKeywordsMatched: stringArray(original.atsKeywordsMatched),
      atsKeywordsMissing: stringArray(original.atsKeywordsMissing),
      atsScore: original.atsScore,
      coverLetter: null,
      linkedinPost: null,
      status: "not_applied",
      isFavorite: false,
      notes: null,
      shareToken: null,
      isPublic: false,
    })
    .returning();

  res.status(201).json(newRow);
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
    sendApiError(req, res, 400, "invalid_job_url", "Enter a valid job posting URL.");
    return;
  }

  const { url } = body.data;
  try {
    new URL(url);
  } catch {
    sendApiError(req, res, 400, "invalid_job_url", "Enter a valid job posting URL.");
    return;
  }

  req.log.info({ url }, "Fetching job description from URL");

  try {
    const text = (await fetchReadableTextFromUrl(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OptiMatch/1.0; +https://optimatch.app)",
        "Accept": "text/html,application/xhtml+xml",
      },
      timeoutMs: 15000,
      maxBytes: 1024 * 1024,
    })).slice(0, 12000);

    if (text.length < 100) {
      sendApiError(req, res, 400, "job_url_content_too_short", "Could not extract content from that URL. Try copying the job description manually.");
      return;
    }

    // Use AI to extract the structured job info
    const extractPrompt =
      "Extract the job description from this webpage text. Return ONLY valid JSON:\n" +
      '{"jobTitle": "<job title or empty string>", "companyName": "<company name or empty string>", "jobDescription": "<full job description text, cleaned up, 200-2000 words>"}\n\n' +
      "Webpage text:\n" + text;

    const completion = await runAiCompletion(getAiClient(), {
      model: FIREWORKS_DEFAULT_MODEL,
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: extractPrompt }],
    }, { route: "/fetch-job" });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let extracted: { jobTitle?: string; companyName?: string; jobDescription?: string } = {};
    try {
      extracted = parseAiJson(raw);
    } catch {
      extracted = { jobDescription: text.slice(0, 3000) };
    }

    if (!extracted.jobDescription || extracted.jobDescription.length < 50) {
      sendApiError(req, res, 400, "job_description_not_found", "Could not extract job description from that URL. Try copying the text manually.");
      return;
    }

    res.json({
      jobDescription: extracted.jobDescription,
      jobTitle: extracted.jobTitle ?? "",
      companyName: extracted.companyName ?? "",
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      logger.warn({ err, url }, "Rejected unsafe job URL");
      sendApiError(req, res, 400, "unsafe_job_url", "Could not fetch that URL. Please copy the job description text manually.");
      return;
    }

    logger.error({ err, url }, "Job URL fetch failed");
    if (isAiError(err)) {
      sendAiError(req, res, err, "Job URL fetch failed");
    } else {
      sendApiError(req, res, 400, "job_url_fetch_failed", "Could not fetch that URL. Please copy the job description text manually.");
    }
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
    const completion = await runAiCompletion(getAiClient(), {
      model: FIREWORKS_DEFAULT_MODEL,
      max_completion_tokens: 32768,
      messages: [{ role: "user", content: prompt }],
    }, { route: "/analyses/:id/cover-letter" });

    const content = completion.choices[0]?.message?.content ?? "";

    await db
      .update(analyses)
      .set({ coverLetter: content })
      .where(eq(analyses.id, params.data.id));

    res.json({ content });
  } catch (err) {
    logger.error({ err }, "Cover letter generation failed");
    if (isAiError(err)) {
      sendAiError(req, res, err, "Cover letter generation failed");
    } else {
      res.status(500).json({ error: "Cover letter generation failed" });
    }
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
    const completion = await runAiCompletion(getAiClient(), {
      model: FIREWORKS_DEFAULT_MODEL,
      max_completion_tokens: 32768,
      messages: [{ role: "user", content: prompt }],
    }, { route: "/analyses/:id/linkedin-post" });

    const content = completion.choices[0]?.message?.content ?? "";

    await db
      .update(analyses)
      .set({ linkedinPost: content })
      .where(eq(analyses.id, params.data.id));

    res.json({ content });
  } catch (err) {
    logger.error({ err }, "LinkedIn post generation failed");
    if (isAiError(err)) {
      sendAiError(req, res, err, "LinkedIn post generation failed");
    } else {
      res.status(500).json({ error: "LinkedIn post generation failed" });
    }
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

  const missingKeywords = stringArray(analysis.atsKeywordsMissing).slice(0, 10).join(", ");
  const gaps = stringArray(analysis.gaps).slice(0, 5).join("; ");

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
    const completion = await runAiCompletion(getAiClient(), {
      model: FIREWORKS_DEFAULT_MODEL,
      max_completion_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }, { route: "/analyses/:id/rewrite-bullet" });

    const rewritten = completion.choices[0]?.message?.content?.trim() ?? "";

    res.json({ original: body.data.bulletText, rewritten });
  } catch (err) {
    logger.error({ err }, "Bullet rewrite failed");
    if (isAiError(err)) {
      sendAiError(req, res, err, "Bullet rewrite failed");
    } else {
      res.status(500).json({ error: "Bullet rewrite failed" });
    }
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
    createdAt: formatNotificationCreatedAt(n.createdAt),
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
    createdAt: formatNotificationCreatedAt(updated.createdAt),
  });
  return;
});

export default router;
