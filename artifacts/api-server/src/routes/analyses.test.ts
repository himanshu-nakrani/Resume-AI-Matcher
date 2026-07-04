import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { db, analyses } from "@workspace/db";

function insertAnalysis(overrides: Partial<typeof analyses.$inferInsert> = {}) {
  const base = {
    jobTitle: "Engineer",
    resumeText: "resume",
    jobDescriptionText: "jd",
    fitScore: 80,
    fitRationale: "fits well",
    atsScore: 75,
  };
  const result = db
    .insert(analyses)
    .values({ ...base, ...overrides })
    .returning()
    .all();
  return result[0]!;
}

describe("GET /api/analyses", () => {
  it("returns an empty array when the DB is empty", async () => {
    const response = await request(app).get("/api/analyses");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns inserted rows in createdAt desc order", async () => {
    insertAnalysis({ jobTitle: "Older" });
    // Small delay so createdAt timestamps differ.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    insertAnalysis({ jobTitle: "Newer" });

    const response = await request(app).get("/api/analyses");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].jobTitle).toBe("Newer");
    expect(response.body[1].jobTitle).toBe("Older");
  });
});

describe("GET /api/analyses/:id", () => {
  it("returns 404 when the analysis does not exist", async () => {
    const response = await request(app).get("/api/analyses/9999");
    expect(response.status).toBe(404);
  });

  it("returns the row when present", async () => {
    const inserted = insertAnalysis({ jobTitle: "Findable" });
    const response = await request(app).get(`/api/analyses/${inserted.id}`);
    expect(response.status).toBe(200);
    expect(response.body.jobTitle).toBe("Findable");
  });
});

describe("DELETE /api/analyses/:id", () => {
  it("deletes the row", async () => {
    const inserted = insertAnalysis({ jobTitle: "ToDelete" });
    const deleteResponse = await request(app).delete(`/api/analyses/${inserted.id}`);
    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app).get(`/api/analyses/${inserted.id}`);
    expect(getResponse.status).toBe(404);
  });
});

describe("PATCH /api/analyses/:id", () => {
  it("updates editable fields", async () => {
    const inserted = insertAnalysis({ jobTitle: "Patchable" });
    const response = await request(app)
      .patch(`/api/analyses/${inserted.id}`)
      .send({ isFavorite: true, notes: "loved this role" });
    expect(response.status).toBe(200);

    const getResponse = await request(app).get(`/api/analyses/${inserted.id}`);
    expect(getResponse.body.isFavorite).toBe(true);
    expect(getResponse.body.notes).toBe("loved this role");
  });
});

describe("POST /api/analyses/:id/duplicate", () => {
  it("clones the row with a new id", async () => {
    const inserted = insertAnalysis({ jobTitle: "Original" });
    const response = await request(app).post(`/api/analyses/${inserted.id}/duplicate`);
    expect(response.status).toBe(201);
    expect(response.body.id).not.toBe(inserted.id);
    // The duplicate route appends " (copy)" to the job title.
    expect(response.body.jobTitle).toBe("Original (copy)");
  });
});

describe("POST /api/fetch-job", () => {
  it("rejects localhost URLs before fetching", async () => {
    const response = await request(app)
      .post("/api/fetch-job")
      .send({ url: "http://localhost:8080/internal-job" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Could not fetch");
  });

  it("rejects private IP URLs before fetching", async () => {
    const response = await request(app)
      .post("/api/fetch-job")
      .send({ url: "http://192.168.1.10/jobs/1" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Could not fetch");
  });
});

describe("Share flow", () => {
  it("issues a token, returns the analysis via /share/:token, then revokes it", async () => {
    const inserted = insertAnalysis({ jobTitle: "Shareable" });

    const shareResponse = await request(app).post(`/api/analyses/${inserted.id}/share`);
    expect(shareResponse.status).toBe(200);

    // The share endpoint returns { shareToken, shareUrl }.
    // shareToken is the raw UUID; shareUrl contains /share/<token>.
    const body = shareResponse.body as Record<string, unknown>;
    let token: string | null = null;
    if (typeof body.shareToken === "string") {
      token = body.shareToken;
    } else if (typeof body.shareUrl === "string") {
      token = body.shareUrl.split("/share/")[1] ?? null;
    } else if (typeof body.token === "string") {
      token = body.token;
    }
    expect(token).toBeTruthy();

    const fetchResponse = await request(app).get(`/api/share/${token}`);
    expect(fetchResponse.status).toBe(200);
    expect(fetchResponse.body.jobTitle).toBe("Shareable");

    const revokeResponse = await request(app).delete(`/api/analyses/${inserted.id}/share`);
    expect(revokeResponse.status).toBe(200);

    const afterRevoke = await request(app).get(`/api/share/${token}`);
    expect(afterRevoke.status).toBe(404);
  });
});
