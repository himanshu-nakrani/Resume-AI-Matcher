import OpenAI from "openai";

/** OpenAI-compatible base URL for Fireworks AI chat completions. Override with `FIREWORKS_BASE_URL` or `AI_INTEGRATIONS_OPENAI_BASE_URL`. */
export const FIREWORKS_DEFAULT_BASE_URL = "https://api.fireworks.ai/inference/v1";

/** Default model. Override with `FIREWORKS_MODEL`. */
export const FIREWORKS_DEFAULT_MODEL = "accounts/fireworks/models/glm-5p2";

/** Thrown at client-construction time when no API key is available in env. */
export class AiMissingKeyError extends Error {
  readonly code = "ai_missing_key" as const;
  constructor() {
    super("FIREWORKS_API_KEY env var is not set");
    this.name = "AiMissingKeyError";
  }
}

/**
 * Build an OpenAI-compatible client pointed at Fireworks. Reads the key from
 * `FIREWORKS_API_KEY` (or the legacy `AI_INTEGRATIONS_OPENAI_API_KEY`). Throws
 * `AiMissingKeyError` if neither is set. Base URL and model are configurable
 * via env for testing.
 */
export function getAiClient(): OpenAI {
  const apiKey =
    process.env.FIREWORKS_API_KEY ??
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) throw new AiMissingKeyError();
  return new OpenAI({
    apiKey,
    baseURL:
      process.env.FIREWORKS_BASE_URL ??
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ??
      FIREWORKS_DEFAULT_BASE_URL,
  });
}

/** Configured model. Env override allows swapping without a redeploy. */
export function getAiModel(): string {
  return process.env.FIREWORKS_MODEL?.trim() || FIREWORKS_DEFAULT_MODEL;
}
