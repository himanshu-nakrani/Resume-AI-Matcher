import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

const validResumeText =
  "Senior software engineer with TypeScript, React, Node.js, API design, testing, observability, and production operations experience.";

describe("POST /api/job-search/pre-screen", () => {
  it("returns a structured validation error for short resumes", async () => {
    const response = await request(app)
      .post("/api/job-search/pre-screen")
      .set("X-Request-Id", "job-prescreen-invalid")
      .send({
        resumeText: "too short",
        jobText:
          "Backend engineer role requiring TypeScript, API design, testing, and production ownership.",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "invalid_prescreen_request",
        message: "resumeText is required (min 50 chars)",
        requestId: "job-prescreen-invalid",
      },
    });
  });

  it("returns a structured AI configuration error when the provider key is missing", async () => {
    const prevFireworks = process.env.FIREWORKS_API_KEY;
    const prevLegacy = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.FIREWORKS_API_KEY;
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    try {
      const response = await request(app)
        .post("/api/job-search/pre-screen")
        .set("X-Request-Id", "job-prescreen-no-ai")
        .send({
          resumeText: validResumeText,
          jobText:
            "Backend engineer role requiring TypeScript, API design, testing, and production ownership.",
        });

      expect(response.status).toBe(503);
      expect(response.body.error).toMatchObject({
        code: "ai_missing_key",
        requestId: "job-prescreen-no-ai",
        retryable: false,
      });
      expect(response.body.error.message).toContain("FIREWORKS_API_KEY");
    } finally {
      if (prevFireworks !== undefined)
        process.env.FIREWORKS_API_KEY = prevFireworks;
      if (prevLegacy !== undefined)
        process.env.AI_INTEGRATIONS_OPENAI_API_KEY = prevLegacy;
    }
  });

  it("rejects localhost job URLs before fetching or scoring", async () => {
    const response = await request(app)
      .post("/api/job-search/pre-screen")
      .set("X-Request-Id", "job-prescreen-localhost")
      .send({
        resumeText: validResumeText,
        jobUrl: "http://localhost:8080/internal-job",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "unsafe_job_url",
        message: "Job URL is not allowed",
        requestId: "job-prescreen-localhost",
      },
    });
  });

  it("rejects private IP job URLs before fetching or scoring", async () => {
    const response = await request(app)
      .post("/api/job-search/pre-screen")
      .set("X-Request-Id", "job-prescreen-private-ip")
      .send({
        resumeText: validResumeText,
        jobUrl: "http://10.0.0.5/internal-job",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "unsafe_job_url",
        message: "Job URL is not allowed",
        requestId: "job-prescreen-private-ip",
      },
    });
  });
});

describe("POST /api/job-search", () => {
  it("returns a structured validation error for invalid search bodies", async () => {
    const response = await request(app)
      .post("/api/job-search")
      .set("X-Request-Id", "job-search-invalid")
      .send({ query: "x" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "invalid_job_search_request",
      message: "query: String must contain at least 2 character(s)",
      requestId: "job-search-invalid",
    });
  });

  it("returns a structured configuration error when Exa is not configured", async () => {
    const prevExa = process.env.EXA_API_KEY;
    delete process.env.EXA_API_KEY;

    try {
      const response = await request(app)
        .post("/api/job-search")
        .set("X-Request-Id", "job-search-no-exa")
        .send({ query: "frontend engineer remote" });

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: {
          code: "job_search_not_configured",
          message:
            "Job search is not configured. Set EXA_API_KEY on the API server.",
          requestId: "job-search-no-exa",
        },
      });
    } finally {
      if (prevExa !== undefined) process.env.EXA_API_KEY = prevExa;
    }
  });
});

describe("POST /api/job-search/enrich", () => {
  it("returns a structured validation error for invalid enrichment bodies", async () => {
    const response = await request(app)
      .post("/api/job-search/enrich")
      .set("X-Request-Id", "job-enrich-invalid")
      .send({ url: "not-a-url" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "invalid_job_enrichment_request",
      message: "url: Invalid url",
      requestId: "job-enrich-invalid",
    });
  });

  it("returns a structured configuration error when Exa enrichment is not configured", async () => {
    const prevExa = process.env.EXA_API_KEY;
    delete process.env.EXA_API_KEY;

    try {
      const response = await request(app)
        .post("/api/job-search/enrich")
        .set("X-Request-Id", "job-enrich-no-exa")
        .send({ url: "https://example.com/jobs/frontend" });

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: {
          code: "job_enrichment_not_configured",
          message:
            "Job enrichment is not configured. Set EXA_API_KEY on the API server.",
          requestId: "job-enrich-no-exa",
        },
      });
    } finally {
      if (prevExa !== undefined) process.env.EXA_API_KEY = prevExa;
    }
  });
});
