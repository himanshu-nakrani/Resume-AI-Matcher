import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("GET /api/healthz", () => {
  it("returns 200 with a JSON body", async () => {
    const response = await request(app).get("/api/healthz");
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });
});

describe("GET /api/status", () => {
  it("reports degraded configured state without secrets", async () => {
    const prevFireworks = process.env.FIREWORKS_API_KEY;
    const prevLegacy = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const prevExa = process.env.EXA_API_KEY;
    delete process.env.FIREWORKS_API_KEY;
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.EXA_API_KEY;

    try {
      const response = await request(app).get("/api/status");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("degraded");
      expect(response.body.services.ai.configured).toBe(false);
      expect(response.body.services.jobSearch.configured).toBe(false);
      expect(Array.isArray(response.body.services.pdfExport.availableCompilers)).toBe(true);
      expect(JSON.stringify(response.body)).not.toContain("FIREWORKS_API_KEY=");
      expect(JSON.stringify(response.body)).not.toContain("EXA_API_KEY=");
    } finally {
      if (prevFireworks !== undefined) process.env.FIREWORKS_API_KEY = prevFireworks;
      if (prevLegacy !== undefined) process.env.AI_INTEGRATIONS_OPENAI_API_KEY = prevLegacy;
      if (prevExa !== undefined) process.env.EXA_API_KEY = prevExa;
    }
  });

  it("reports configured AI and job search without exposing key values", async () => {
    const prevFireworks = process.env.FIREWORKS_API_KEY;
    const prevExa = process.env.EXA_API_KEY;
    process.env.FIREWORKS_API_KEY = "fw_secret_for_test";
    process.env.EXA_API_KEY = "exa_secret_for_test";

    try {
      const response = await request(app).get("/api/status");
      const bodyText = JSON.stringify(response.body);

      expect(response.status).toBe(200);
      expect(response.body.services.ai.configured).toBe(true);
      expect(response.body.services.jobSearch.configured).toBe(true);
      expect(bodyText).not.toContain("fw_secret_for_test");
      expect(bodyText).not.toContain("exa_secret_for_test");
    } finally {
      if (prevFireworks !== undefined) process.env.FIREWORKS_API_KEY = prevFireworks;
      else delete process.env.FIREWORKS_API_KEY;
      if (prevExa !== undefined) process.env.EXA_API_KEY = prevExa;
      else delete process.env.EXA_API_KEY;
    }
  });
});
