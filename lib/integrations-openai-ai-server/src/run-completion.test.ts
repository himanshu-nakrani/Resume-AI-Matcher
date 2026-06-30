import { describe, it, expect } from "vitest";
import OpenAI, {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  RateLimitError,
} from "openai";
import { runAiCompletion, isAiError } from "./run-completion";

/**
 * Build a fake OpenAI client whose `chat.completions.create` is driven by
 * a queue of behaviors. Each call shifts the next behavior off the queue.
 */
function makeFakeClient(
  behaviors: Array<"success" | (() => never)>,
  apiKey: string = "real-key",
): OpenAI {
  const fake = {
    apiKey,
    chat: {
      completions: {
        create: async () => {
          const next = behaviors.shift();
          if (next === "success") {
            return {
              id: "chatcmpl-test",
              choices: [
                {
                  message: { content: "ok", role: "assistant" },
                  index: 0,
                  finish_reason: "stop",
                },
              ],
              created: 0,
              model: "test-model",
              object: "chat.completion",
            } as unknown as OpenAI.Chat.ChatCompletion;
          }
          if (typeof next === "function") {
            return next() as never;
          }
          throw new Error("test setup: no behavior queued");
        },
      },
    },
  };
  return fake as unknown as OpenAI;
}

function buildApiError<E extends APIError>(
  ErrorClass: new (...args: never[]) => E,
  status: number,
  message: string,
  headers?: Record<string, string>,
): E {
  const err = Object.create(ErrorClass.prototype) as E;
  Object.assign(err, {
    status,
    message,
    name: ErrorClass.name,
    headers: headers ?? {},
  });
  Object.setPrototypeOf(err, ErrorClass.prototype);
  return err;
}

const PARAMS = {
  model: "test-model",
  messages: [{ role: "user", content: "hello" }],
} as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;

describe("runAiCompletion", () => {
  it("returns the completion on first success", async () => {
    const client = makeFakeClient(["success"]);
    const result = await runAiCompletion(client, PARAMS);
    expect(result.choices[0]?.message?.content).toBe("ok");
  });

  it("throws AI_CONFIG_MISSING when apiKey is 'missing-api-key'", async () => {
    const client = makeFakeClient([], "missing-api-key");
    await expect(runAiCompletion(client, PARAMS)).rejects.toMatchObject({
      code: "AI_CONFIG_MISSING",
      retryable: false,
    });
  });

  it("retries once on APIConnectionError, then succeeds", async () => {
    const client = makeFakeClient([
      () => {
        const err = Object.create(APIConnectionError.prototype) as APIConnectionError;
        Object.assign(err, { message: "connect ECONNRESET", name: "APIConnectionError" });
        throw err;
      },
      "success",
    ]);
    const result = await runAiCompletion(client, PARAMS, { retries: 1 });
    expect(result.choices[0]?.message?.content).toBe("ok");
  });

  it("throws AI_RATE_LIMITED with retryable: true after retries exhausted on 429", async () => {
    const fail = () => {
      throw buildApiError(RateLimitError, 429, "Too Many Requests");
    };
    const client = makeFakeClient([fail, fail]); // both attempts fail
    await expect(runAiCompletion(client, PARAMS, { retries: 1 })).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
      retryable: true,
    });
  });

  it("throws AI_AUTH_INVALID with retryable: false on 401", async () => {
    const client = makeFakeClient([
      () => {
        throw buildApiError(AuthenticationError, 401, "Invalid API key");
      },
    ]);
    await expect(runAiCompletion(client, PARAMS, { retries: 1 })).rejects.toMatchObject({
      code: "AI_AUTH_INVALID",
      retryable: false,
    });
  });

  it("throws AI_BAD_REQUEST with retryable: false on 400", async () => {
    const client = makeFakeClient([
      () => {
        throw buildApiError(BadRequestError, 400, "Bad request");
      },
    ]);
    await expect(runAiCompletion(client, PARAMS, { retries: 1 })).rejects.toMatchObject({
      code: "AI_BAD_REQUEST",
      retryable: false,
    });
  });

  it("isAiError narrows correctly", () => {
    const aiErr = Object.assign(new Error("x"), { code: "AI_UNKNOWN", retryable: true });
    expect(isAiError(aiErr)).toBe(true);
    expect(isAiError(new Error("regular"))).toBe(false);
    expect(isAiError(null)).toBe(false);
    expect(isAiError({ code: "OTHER" })).toBe(false);
  });
});
