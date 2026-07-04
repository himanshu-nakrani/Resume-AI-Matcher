import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, customFetch } from "./custom-fetch";

describe("customFetch error messages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses nested API error messages and request ids", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "not_found",
                message: "No API route matches GET /api/missing.",
                requestId: "req-123",
              },
            }),
            {
              status: 404,
              statusText: "Not Found",
              headers: { "content-type": "application/json" },
            },
          ),
      ),
    );

    await expect(customFetch("/api/missing")).rejects.toMatchObject({
      name: "ApiError",
      message:
        "HTTP 404 Not Found: No API route matches GET /api/missing. (request req-123)",
    });
  });

  it("keeps the parsed error envelope on ApiError.data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "invalid_json",
                message: "Invalid JSON request body.",
                requestId: "req-json",
              },
            }),
            {
              status: 400,
              statusText: "Bad Request",
              headers: { "content-type": "application/json" },
            },
          ),
      ),
    );

    try {
      await customFetch("/api/job-search", { method: "POST" });
      throw new Error("Expected customFetch to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).data).toMatchObject({
        error: {
          code: "invalid_json",
          requestId: "req-json",
        },
      });
    }
  });
});
