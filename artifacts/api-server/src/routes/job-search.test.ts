import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

const validResumeText =
  "Senior software engineer with TypeScript, React, Node.js, API design, testing, observability, and production operations experience.";

describe("POST /api/job-search/pre-screen", () => {
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
