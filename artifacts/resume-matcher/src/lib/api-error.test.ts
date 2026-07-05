import { describe, expect, it } from "vitest";
import { apiErrorMessage, unknownErrorMessage } from "./api-error";

describe("apiErrorMessage", () => {
  it("formats nested backend envelopes with request ids", () => {
    expect(
      apiErrorMessage(
        { error: { message: "Saved jobs unavailable.", requestId: "req-123" } },
        "Fallback message.",
      ),
    ).toBe("Saved jobs unavailable. (request req-123)");
  });

  it("supports legacy string errors", () => {
    expect(apiErrorMessage({ error: "Already saved." }, "Fallback.")).toBe(
      "Already saved.",
    );
  });

  it("falls back for missing or malformed payloads", () => {
    expect(apiErrorMessage({ error: { code: "INTERNAL" } }, "Try later.")).toBe(
      "Try later.",
    );
    expect(apiErrorMessage(null, "Try later.")).toBe("Try later.");
  });
});

describe("unknownErrorMessage", () => {
  it("prefers structured API client payloads over generic error messages", () => {
    const error = Object.assign(new Error("Request failed with status 500"), {
      data: {
        error: {
          message: "Analysis service unavailable.",
          requestId: "api-500",
        },
      },
    });

    expect(unknownErrorMessage(error)).toBe(
      "Analysis service unavailable. (request api-500)",
    );
  });

  it("supports response data payloads from request libraries", () => {
    expect(
      unknownErrorMessage({
        response: {
          data: { error: "Saved search was not found." },
        },
      }),
    ).toBe("Saved search was not found.");
  });

  it("uses real error messages before the fallback", () => {
    expect(unknownErrorMessage(new Error("Network failed."))).toBe(
      "Network failed.",
    );
    expect(unknownErrorMessage("oops", "Retry shortly.")).toBe(
      "Retry shortly.",
    );
  });
});
