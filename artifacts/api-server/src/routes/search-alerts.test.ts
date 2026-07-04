import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";

async function createAlert(
  overrides: Record<string, unknown> = {},
  requestId = "search-alert-create",
) {
  return request(app)
    .post("/api/search-alerts")
    .set("X-Request-Id", requestId)
    .send({
      name: "Senior React roles",
      query: "senior react engineer remote",
      searchType: "fast",
      userLocation: "US",
      recentOnly: true,
      filters: {
        experienceLevel: "senior",
        remote: "remote",
        companySize: "startup",
      },
      ...overrides,
    });
}

describe("search alerts routes", () => {
  it("creates, lists, and updates alerts", async () => {
    const createResponse = await createAlert();

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      name: "Senior React roles",
      query: "senior react engineer remote",
      searchType: "fast",
      userLocation: "US",
      recentOnly: true,
      enabled: true,
      filters: {
        experienceLevel: "senior",
        remote: "remote",
        companySize: "startup",
      },
    });

    const patchResponse = await request(app)
      .patch(`/api/search-alerts/${createResponse.body.id}`)
      .send({ name: "Paused React roles", enabled: false });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body).toMatchObject({
      name: "Paused React roles",
      enabled: false,
    });

    const listResponse = await request(app).get("/api/search-alerts");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0]).toMatchObject({
      id: createResponse.body.id,
      name: "Paused React roles",
      enabled: false,
    });
  });

  it("rejects invalid create payloads with a structured error", async () => {
    const response = await request(app)
      .post("/api/search-alerts")
      .set("X-Request-Id", "search-alert-invalid")
      .send({ query: "x", searchType: "slow" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "invalid_search_alert",
      message: "Search alert payload is invalid.",
      requestId: "search-alert-invalid",
    });
    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["query"] }),
        expect.objectContaining({ path: ["searchType"] }),
      ]),
    );
  });

  it("returns structured errors for invalid and missing ids", async () => {
    const invalidResponse = await request(app)
      .delete("/api/search-alerts/nope")
      .set("X-Request-Id", "search-alert-invalid-id");

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error).toMatchObject({
      code: "invalid_id",
      message: "Invalid search alert id.",
      requestId: "search-alert-invalid-id",
    });

    const missingResponse = await request(app)
      .patch("/api/search-alerts/999")
      .set("X-Request-Id", "search-alert-missing")
      .send({ enabled: false });

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.error).toMatchObject({
      code: "search_alert_not_found",
      message: "Search alert not found.",
      requestId: "search-alert-missing",
    });
  });

  it("returns a structured configuration error when alert checks lack Exa", async () => {
    const previousKey = process.env.EXA_API_KEY;
    delete process.env.EXA_API_KEY;

    try {
      const createResponse = await createAlert();
      const response = await request(app)
        .post(`/api/search-alerts/${createResponse.body.id}/check`)
        .set("X-Request-Id", "search-alert-check-no-key");

      expect(response.status).toBe(503);
      expect(response.body.error).toMatchObject({
        code: "exa_config_missing",
        message: "EXA_API_KEY not configured.",
        requestId: "search-alert-check-no-key",
      });
    } finally {
      if (previousKey !== undefined) process.env.EXA_API_KEY = previousKey;
    }
  });
});
