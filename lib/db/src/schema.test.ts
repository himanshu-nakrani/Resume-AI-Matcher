import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { analyses, insertAnalysisSchema } from "./schema/analyses";
import { createTestDb } from "./test-helpers";

describe("analyses schema", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
  });

  afterEach(() => {
    ctx.close();
  });

  it("inserts a row with all required fields", () => {
    const { db } = ctx;
    const result = db
      .insert(analyses)
      .values({
        jobTitle: "Engineer",
        resumeText: "resume content",
        jobDescriptionText: "job description content",
        fitScore: 80,
        fitRationale: "good fit",
        atsScore: 75,
      })
      .run();
    expect(result.changes).toBe(1);
  });

  it("rejects insert without jobTitle via drizzle-zod", () => {
    const result = insertAnalysisSchema.safeParse({
      resumeText: "resume",
      jobDescriptionText: "jd",
      fitScore: 80,
      fitRationale: "x",
      atsScore: 75,
    });
    expect(result.success).toBe(false);
  });

  it("applies json/default values on insert", () => {
    const { db } = ctx;
    db.insert(analyses)
      .values({
        jobTitle: "Engineer",
        resumeText: "resume",
        jobDescriptionText: "jd",
        fitScore: 80,
        fitRationale: "x",
        atsScore: 75,
      })
      .run();

    const rows = db.select().from(analyses).all();
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.strengths).toEqual([]);
    expect(row.gaps).toEqual([]);
    expect(row.improvements).toEqual([]);
    expect(row.atsKeywordsMatched).toEqual([]);
    expect(row.atsKeywordsMissing).toEqual([]);
    expect(row.tags).toEqual([]);
    expect(row.portfolioLinks).toEqual([]);
    expect(row.status).toBe("not_applied");
    expect(row.isFavorite).toBe(false);
    expect(row.isPublic).toBe(false);
  });
});
