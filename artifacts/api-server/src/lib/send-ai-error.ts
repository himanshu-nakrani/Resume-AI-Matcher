import type { Request, Response } from "express";
import type { AiError, AiErrorCode } from "@workspace/integrations-openai-ai-server";

const HTTP_BY_CODE: Record<AiErrorCode, number> = {
  AI_TIMEOUT: 504,
  AI_RATE_LIMITED: 429,
  AI_AUTH_INVALID: 503,
  AI_QUOTA_EXCEEDED: 503,
  AI_BAD_REQUEST: 400,
  AI_CONFIG_MISSING: 503,
  ai_missing_key: 503,
  AI_UNKNOWN: 502,
};

const FRIENDLY_BY_CODE: Record<AiErrorCode, string> = {
  AI_TIMEOUT: "The AI service took too long to respond. Try again.",
  AI_RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  AI_AUTH_INVALID: "AI service authentication failed. Contact the server admin.",
  AI_QUOTA_EXCEEDED: "AI service quota exceeded. Try again later.",
  AI_BAD_REQUEST: "The AI service rejected the request. Please try a different input.",
  AI_CONFIG_MISSING: "AI features are not configured on this server.",
  ai_missing_key: "AI provider is not configured on the server. Set FIREWORKS_API_KEY.",
  AI_UNKNOWN: "The AI service returned an unexpected error. Try again.",
};

/**
 * Translate an AiError into the wire envelope:
 *   { error: { code, message, requestId, retryable, retryAfterMs? } }
 *
 * `friendlyMessageOverride` lets callers customize the user-facing message
 * (e.g. "Cover letter generation failed") while preserving the structured code.
 */
function requestId(req: Request): string | undefined {
  return (req as Request & { id?: string }).id;
}

export function sendAiError(
  req: Request,
  res: Response,
  err: AiError,
  friendlyMessageOverride?: string,
): void {
  const status = HTTP_BY_CODE[err.code] ?? 500;
  res.status(status).json({
    error: {
      code: err.code,
      message: friendlyMessageOverride ?? FRIENDLY_BY_CODE[err.code],
      requestId: requestId(req),
      retryable: err.retryable,
      ...(err.retryAfterMs != null ? { retryAfterMs: err.retryAfterMs } : {}),
    },
  });
}
