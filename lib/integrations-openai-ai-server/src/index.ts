export { getAiClient, openai, DEEPSEEK_DEFAULT_BASE_URL } from "./client";
export { generateImageBuffer, editImages } from "./image";
export { batchProcess, batchProcessWithSSE, isRateLimitError, type BatchOptions } from "./batch";
export {
  runAiCompletion,
  isAiError,
  type AiError,
  type AiErrorCode,
} from "./run-completion";

// Re-export the OpenAI type so consumers can reach into its namespaced types
// (e.g. `OpenAI.Chat.ChatCompletionCreateParamsNonStreaming`) without taking
// a direct dependency on the `openai` package.
export type { default as OpenAI } from "openai";
