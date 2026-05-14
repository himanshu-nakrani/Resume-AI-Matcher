export const DEEPSEEK_KEY_STORAGE_KEY = "optimatch_deepseek_api_key";

export function readDeepseekApiKeyFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DEEPSEEK_KEY_STORAGE_KEY);
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}
