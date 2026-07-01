import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import { AiMissingKeyError } from "./client";

export type AiErrorCode =
  | "AI_TIMEOUT"
  | "AI_RATE_LIMITED"
  | "AI_AUTH_INVALID"
  | "AI_QUOTA_EXCEEDED"
  | "AI_BAD_REQUEST"
  | "AI_CONFIG_MISSING"
  | "ai_missing_key"
  | "AI_UNKNOWN";

export interface AiError extends Error {
  code: AiErrorCode;
  retryable: boolean;
  retryAfterMs?: number;
  cause?: unknown;
}

export function isAiError(err: unknown): err is AiError {
  if (typeof err !== "object" || err === null) return false;
  if (!("code" in err) || !("retryable" in err)) return false;
  const code = (err as { code: unknown }).code;
  if (typeof code !== "string") return false;
  return code.startsWith("AI_") || code === "ai_missing_key";
}

export type AiTokenEvent = {
  model: string;
  route: string;
  outcome: "success" | "error";
  tokens: number;
};

export type AiTokenRecorder = (event: AiTokenEvent) => void;

let tokenRecorder: AiTokenRecorder | null = null;

/**
 * Register a callback that receives a token-usage event after every
 * runAiCompletion call (success or classified failure). Pass `null` to
 * unregister. The recorder is wrapped in a try/catch internally — a thrown
 * exception from the recorder cannot crash the AI call.
 */
export function setAiTokenRecorder(fn: AiTokenRecorder | null): void {
  tokenRecorder = fn;
}

function recordAiTokens(event: AiTokenEvent): void {
  if (tokenRecorder) {
    try {
      tokenRecorder(event);
    } catch {
      /* swallow — metrics failures never crash AI calls */
    }
  }
}

interface RunOptions {
  /** Per-attempt timeout in ms. Default 30000. */
  timeoutMs?: number;
  /** Number of retries on retryable errors. Default 1. Set to 0 to disable. */
  retries?: number;
  /** Express route pattern (e.g. "/analyses/:id/cover-letter"). Used as a metrics label. */
  route?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_BACKOFF_MS = 500;

/**
 * Wrap `client.chat.completions.create` with a timeout, one retry on
 * retryable errors, and structured AiError mapping.
 *
 * A missing API key surfaces as an `AiMissingKeyError` thrown by `getAiClient()`
 * upstream; if such an error reaches this function's catch path it is classified
 * as `ai_missing_key` (non-retryable) rather than becoming an unknown failure.
 */
export async function runAiCompletion(
  client: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  opts: RunOptions = {},
): Promise<OpenAI.Chat.ChatCompletion> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.retries ?? DEFAULT_RETRIES;

  let lastError: AiError | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await client.chat.completions.create(params, { timeout: timeoutMs });
      recordAiTokens({
        model: params.model,
        route: opts.route ?? "unknown",
        outcome: "success",
        tokens: completion.usage?.total_tokens ?? 0,
      });
      return completion;
    } catch (err) {
      const aiErr = classifyAiError(err);
      lastError = aiErr;
      if (attempt < maxRetries && aiErr.retryable) {
        const delay = aiErr.retryAfterMs ?? DEFAULT_BACKOFF_MS * (attempt + 1);
        await sleep(delay);
        continue;
      }
      recordAiTokens({
        model: params.model,
        route: opts.route ?? "unknown",
        outcome: "error",
        tokens: 0,
      });
      throw aiErr;
    }
  }
  // Unreachable but TS doesn't know that.
  throw lastError ?? makeAiError("AI_UNKNOWN", true, "runAiCompletion: exhausted retries");
}

function makeAiError(
  code: AiErrorCode,
  retryable: boolean,
  message: string,
  retryAfterMs?: number,
  cause?: unknown,
): AiError {
  const err = new Error(message) as AiError;
  err.code = code;
  err.retryable = retryable;
  if (retryAfterMs != null) err.retryAfterMs = retryAfterMs;
  if (cause != null) err.cause = cause;
  return err;
}

function classifyAiError(err: unknown): AiError {
  // Already-classified errors (e.g. from nested calls) pass through.
  if (isAiError(err)) return err;

  // Missing key surfaces as a distinct, non-retryable class from `getAiClient()`.
  if (err instanceof AiMissingKeyError) {
    return makeAiError("ai_missing_key", false, err.message, undefined, err);
  }

  // OpenAI SDK class hierarchy. Order matters: more specific classes first.
  if (err instanceof APIConnectionTimeoutError) {
    return makeAiError("AI_TIMEOUT", true, "AI service timed out", undefined, err);
  }
  if (err instanceof APIConnectionError) {
    return makeAiError("AI_TIMEOUT", true, "AI service connection error", undefined, err);
  }
  if (err instanceof RateLimitError) {
    const retryAfterMs = parseRetryAfterMs(err);
    return makeAiError(
      "AI_RATE_LIMITED",
      true,
      "AI service rate-limited the request",
      retryAfterMs,
      err,
    );
  }
  if (err instanceof AuthenticationError) {
    return makeAiError("AI_AUTH_INVALID", false, "AI service rejected the API key", undefined, err);
  }
  if (err instanceof PermissionDeniedError) {
    return makeAiError(
      "AI_QUOTA_EXCEEDED",
      false,
      "AI service quota exceeded or permission denied",
      undefined,
      err,
    );
  }
  if (err instanceof BadRequestError) {
    return makeAiError("AI_BAD_REQUEST", false, "AI service rejected the request", undefined, err);
  }
  if (err instanceof APIError) {
    // Generic API error — likely a 5xx. Retryable.
    return makeAiError("AI_UNKNOWN", true, err.message || "AI service error", undefined, err);
  }

  // Anything else (e.g. native fetch errors, DNS failures) — treat as retryable unknown.
  const message = err instanceof Error ? err.message : "Unknown AI error";
  return makeAiError("AI_UNKNOWN", true, message, undefined, err);
}

function parseRetryAfterMs(err: RateLimitError): number | undefined {
  // The OpenAI SDK exposes response headers via err.headers when available.
  const headers = (err as unknown as { headers?: Record<string, string> | Headers }).headers;
  if (!headers) return undefined;
  const value = typeof (headers as Headers).get === "function"
    ? (headers as Headers).get("retry-after")
    : (headers as Record<string, string>)["retry-after"];
  if (!value) return undefined;
  // Retry-After can be seconds or an HTTP date. Handle seconds.
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds * 1000);
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
