import OpenAI from "openai";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export function getAiClient(apiKey?: string) {
  return new OpenAI({
    apiKey:
      apiKey ??
      process.env.DEEPSEEK_API_KEY ??
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??
      "missing-api-key",
    baseURL:
      process.env.DEEPSEEK_BASE_URL ??
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ??
      DEEPSEEK_BASE_URL,
  });
}

export const openai = getAiClient();
