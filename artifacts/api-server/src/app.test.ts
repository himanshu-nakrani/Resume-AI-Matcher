import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "./app";

describe("API fallback handling", () => {
  it("returns a structured JSON 404 with the request id", async () => {
    const response = await request(app)
      .get("/api/does-not-exist")
      .set("X-Request-Id", "test-request-404");

    expect(response.status).toBe(404);
    expect(response.headers["x-request-id"]).toBe("test-request-404");
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toMatchObject({
      error: {
        code: "not_found",
        message: "No API route matches GET /api/does-not-exist.",
        requestId: "test-request-404",
      },
    });
  });

  it("returns a structured JSON error for malformed request bodies", async () => {
    const response = await request(app)
      .post("/api/job-search")
      .set("X-Request-Id", "test-request-invalid-json")
      .set("Content-Type", "application/json")
      .send("{bad json");

    expect(response.status).toBe(400);
    expect(response.headers["x-request-id"]).toBe("test-request-invalid-json");
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toMatchObject({
      error: {
        code: "invalid_json",
        message: "Invalid JSON request body.",
        requestId: "test-request-invalid-json",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("SyntaxError");
  });
});
