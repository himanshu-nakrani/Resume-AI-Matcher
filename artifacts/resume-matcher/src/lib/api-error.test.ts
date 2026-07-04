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
  it("uses real error messages before the fallback", () => {
    expect(unknownErrorMessage(new Error("Network failed."))).toBe(
      "Network failed.",
    );
    expect(unknownErrorMessage("oops", "Retry shortly.")).toBe(
      "Retry shortly.",
    );
  });
});
