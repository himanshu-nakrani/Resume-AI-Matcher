import type { Request } from "express";
import { getAiClient } from "@workspace/integrations-openai-ai-server";

/** OpenAI-compatible client pointed at DeepSeek, using the browser-provided API key when present. */
export function getAiFromRequest(req: Request) {
  const headerKey = req.get("x-deepseek-api-key")?.trim();
  return getAiClient(headerKey || undefined);
}

/** Prefer explicit body key (create analysis), then header, then env inside getAiClient. */
export function resolveDeepseekKeyForCreate(req: Request, bodyKey?: string | undefined) {
  const fromBody = bodyKey?.trim();
  if (fromBody) return fromBody;
  return req.get("x-deepseek-api-key")?.trim() || undefined;
}
