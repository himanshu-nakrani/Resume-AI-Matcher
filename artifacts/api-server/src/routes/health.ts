import { Router, type IRouter } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { HealthCheckResponse, GetSystemStatusResponse } from "@workspace/api-zod";
import { getAiModel } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();
const execFileAsync = promisify(execFile);
const latexCompilers = ["tectonic", "latexmk", "pdflatex"] as const;
type LatexCompiler = (typeof latexCompilers)[number];
let compilerCache: { expiresAt: number; value: LatexCompiler[] } | null = null;

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

function hasEnv(...names: string[]): boolean {
  return names.some((name) => Boolean(process.env[name]?.trim()));
}

async function commandAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync("which", [command], { timeout: 1_000 });
    return true;
  } catch {
    return false;
  }
}

async function getAvailableCompilers(): Promise<LatexCompiler[]> {
  const now = Date.now();
  if (compilerCache && compilerCache.expiresAt > now) return compilerCache.value;

  const value = (
    await Promise.all(
      latexCompilers.map(async (compiler) => ({
        compiler,
        available: await commandAvailable(compiler),
      })),
    )
  )
    .filter((entry) => entry.available)
    .map((entry) => entry.compiler);

  compilerCache = { expiresAt: now + 60_000, value };
  return value;
}

router.get("/status", async (_req, res) => {
  const availableCompilers = await getAvailableCompilers();
  const aiConfigured = hasEnv("FIREWORKS_API_KEY", "AI_INTEGRATIONS_OPENAI_API_KEY");
  const jobSearchConfigured = hasEnv("EXA_API_KEY");
  const pdfConfigured = availableCompilers.length > 0;

  const data = GetSystemStatusResponse.parse({
    status: aiConfigured && jobSearchConfigured && pdfConfigured ? "operational" : "degraded",
    services: {
      ai: {
        configured: aiConfigured,
        label: "AI optimization",
        detail: aiConfigured ? `Ready with ${getAiModel()}` : "Set FIREWORKS_API_KEY to enable resume optimization.",
      },
      jobSearch: {
        configured: jobSearchConfigured,
        label: "Job search",
        detail: jobSearchConfigured ? "Exa search is configured." : "Set EXA_API_KEY to enable job search.",
      },
      pdfExport: {
        configured: pdfConfigured,
        label: "PDF export",
        detail: pdfConfigured
          ? `Using ${availableCompilers.join(", ")}.`
          : "Install tectonic, latexmk, or pdflatex to enable PDF export.",
        availableCompilers,
      },
    },
  });

  res.json(data);
});

export default router;
