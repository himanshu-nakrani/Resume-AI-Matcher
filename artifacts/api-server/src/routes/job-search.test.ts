import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

const validResumeText =
  "Senior software engineer with TypeScript, React, Node.js, API design, testing, observability, and production operations experience.";

describe("POST /api/job-search/pre-screen", () => {
  it("returns a structured AI configuration error when the provider key is missing", async () => {
    const prevFireworks = process.env.FIREWORKS_API_KEY;
    const prevLegacy = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.FIREWORKS_API_KEY;
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    try {
      const response = await request(app)
        .post("/api/job-search/pre-screen")
        .send({
          resumeText: validResumeText,
          jobText: "Backend engineer role requiring TypeScript, API design, testing, and production ownership.",
        });

      expect(response.status).toBe(503);
      expect(response.body.error).toMatchObject({
        code: "ai_missing_key",
        retryable: false,
      });
      expect(response.body.error.message).toContain("FIREWORKS_API_KEY");
    } finally {
      if (prevFireworks !== undefined) process.env.FIREWORKS_API_KEY = prevFireworks;
      if (prevLegacy !== undefined) process.env.AI_INTEGRATIONS_OPENAI_API_KEY = prevLegacy;
    }
  });

  it("rejects localhost job URLs before fetching or scoring", async () => {
    const response = await request(app)
      .post("/api/job-search/pre-screen")
      .send({
        resumeText: validResumeText,
        jobUrl: "http://localhost:8080/internal-job",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Job URL is not allowed");
  });

  it("rejects private IP job URLs before fetching or scoring", async () => {
    const response = await request(app)
      .post("/api/job-search/pre-screen")
      .send({
        resumeText: validResumeText,
        jobUrl: "http://10.0.0.5/internal-job",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Job URL is not allowed");
  });
});
