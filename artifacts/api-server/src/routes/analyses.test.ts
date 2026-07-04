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

describe("GET /api/analyses/stats", () => {
  it("normalizes legacy keyword JSON shapes when aggregating stats", async () => {
    const legacyString = insertAnalysis({ jobTitle: "Legacy string keywords" });
    const legacyObject = insertAnalysis({ jobTitle: "Legacy object keywords" });
    insertAnalysis({
      jobTitle: "Normal keywords",
      atsKeywordsMissing: ["GraphQL", "Rust"],
    });

    const sqliteClient = (db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    sqliteClient.exec(`
      UPDATE analyses
      SET ats_keywords_missing = '"GraphQL"'
      WHERE id = ${legacyString.id};

      UPDATE analyses
      SET ats_keywords_missing = '{"bad": true}'
      WHERE id = ${legacyObject.id};
    `);

    const response = await request(app).get("/api/analyses/stats");

    expect(response.status).toBe(200);
    expect(response.body.totalAnalyses).toBe(3);
    expect(response.body.topMissingKeywords).toContain("GraphQL");
    expect(response.body.topMissingKeywords).toContain("Rust");
    expect(response.body.topMissingKeywords).not.toContain("bad");
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

describe("GET /api/analyses/:id/resume.pdf", () => {
  it("returns a readable error when optimized LaTeX cannot compile", async () => {
    const inserted = insertAnalysis({
      optimizedLatex: "\\documentclass{article}\n\\begin{document}\n\\undefinedResumeCommand\n\\end{document}",
    });

    const response = await request(app)
      .get(`/api/analyses/${inserted.id}/resume.pdf`)
      .set("Accept", "application/pdf, application/json");

    expect(response.status).toBe(422);
    expect(response.body.error).toContain("Could not compile optimized resume PDF.");
    expect(response.body.error).not.toBe("[object Object]");
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

describe("GET /api/notifications", () => {
  it("returns ISO timestamps when SQLite stores createdAt as Unix seconds", async () => {
    const sqliteClient = (db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    sqliteClient.exec(`
      INSERT INTO notifications (type, title, body, read, created_at)
      VALUES ('info', 'Timestamp check', 'Ensure notification dates render correctly.', 0, 1700000000);
    `);

    const response = await request(app).get("/api/notifications");

    expect(response.status).toBe(200);
    expect(response.body[0].createdAt).toBe("2023-11-14T22:13:20.000Z");
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
