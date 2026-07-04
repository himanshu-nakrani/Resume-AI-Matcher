import type { ErrorResponse } from "@workspace/api-client-react";

export type ApiErrorPayload = Partial<ErrorResponse> & {
  message?: string;
  requestId?: string;
};

function stringField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function objectField(
  source: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!source) return null;
  const value = source[key];
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function apiErrorMessage(payload: unknown, fallback: string): string {
  const source =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  const nestedError = objectField(source, "error");
  const message =
    stringField(source?.error) ??
    stringField(nestedError?.message) ??
    stringField(source?.message) ??
    fallback;
  const requestId =
    stringField(nestedError?.requestId) ?? stringField(source?.requestId);

  return requestId ? `${message} (request ${requestId})` : message;
}

export function unknownErrorMessage(
  error: unknown,
  fallback = "Try again in a moment.",
): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
