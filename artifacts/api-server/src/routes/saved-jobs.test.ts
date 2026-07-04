import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";

async function createSavedJob(
  overrides: Record<string, unknown> = {},
  requestId = "saved-job-create",
) {
  return request(app)
    .post("/api/saved-jobs")
    .set("X-Request-Id", requestId)
    .send({
      url: "https://example.com/jobs/frontend-engineer",
      title: "Frontend Engineer",
      company: "Example",
      source: "example.com",
      highlights: ["React", "TypeScript"],
      applyType: "ats",
      tags: ["frontend"],
      ...overrides,
    });
}

describe("saved jobs routes", () => {
  it("creates and lists saved jobs with normalized defaults", async () => {
    const createResponse = await createSavedJob();

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      url: "https://example.com/jobs/frontend-engineer",
      title: "Frontend Engineer",
      company: "Example",
      source: "example.com",
      highlights: ["React", "TypeScript"],
      applyType: "ats",
      tags: ["frontend"],
    });

    const listResponse = await request(app).get("/api/saved-jobs");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0]).toMatchObject({
      id: createResponse.body.id,
      title: "Frontend Engineer",
      tags: ["frontend"],
    });
  });

  it("returns a structured duplicate error with the existing job", async () => {
    await createSavedJob();
    const response = await createSavedJob({}, "saved-job-duplicate");

    expect(response.status).toBe(409);
    expect(response.headers["x-request-id"]).toBe("saved-job-duplicate");
    expect(response.body).toMatchObject({
      error: {
        code: "saved_job_exists",
        message: "Job already saved.",
        requestId: "saved-job-duplicate",
      },
      existing: {
        title: "Frontend Engineer",
        url: "https://example.com/jobs/frontend-engineer",
      },
    });
  });

  it("rejects invalid create payloads with zod issues", async () => {
    const response = await request(app)
      .post("/api/saved-jobs")
      .set("X-Request-Id", "saved-job-invalid")
      .send({ url: "not-a-url", title: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "invalid_saved_job",
      message: "Saved job payload is invalid.",
      requestId: "saved-job-invalid",
    });
    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["url"] }),
        expect.objectContaining({ path: ["title"] }),
      ]),
    );
  });

  it("updates notes and tags, then deletes the row", async () => {
    const createResponse = await createSavedJob();

    const patchResponse = await request(app)
      .patch(`/api/saved-jobs/${createResponse.body.id}`)
      .send({ notes: "Strong fit", tags: ["frontend", "priority"] });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body).toMatchObject({
      notes: "Strong fit",
      tags: ["frontend", "priority"],
    });

    const deleteResponse = await request(app).delete(
      `/api/saved-jobs/${createResponse.body.id}`,
    );
    expect(deleteResponse.status).toBe(204);

    const listResponse = await request(app).get("/api/saved-jobs");
    expect(listResponse.body).toEqual([]);
  });

  it("returns structured errors for invalid and missing ids", async () => {
    const invalidResponse = await request(app)
      .patch("/api/saved-jobs/not-a-number")
      .set("X-Request-Id", "saved-job-invalid-id")
      .send({ notes: "noop" });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error).toMatchObject({
      code: "invalid_id",
      message: "Invalid saved job id.",
      requestId: "saved-job-invalid-id",
    });

    const missingResponse = await request(app)
      .delete("/api/saved-jobs/999")
      .set("X-Request-Id", "saved-job-missing");

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.error).toMatchObject({
      code: "saved_job_not_found",
      message: "Saved job not found.",
      requestId: "saved-job-missing",
    });
  });
});
