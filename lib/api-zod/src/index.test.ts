import { describe, it, expect } from "vitest";
import { CreateAnalysisBody } from "./index";

describe("CreateAnalysisBody schema", () => {
  it("accepts a valid payload", () => {
    const result = CreateAnalysisBody.safeParse({
      jobTitle: "Senior Frontend Engineer",
      resumeText: "Jane Smith\n5 years React experience",
      jobDescriptionText: "We are hiring a senior frontend engineer.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when jobTitle is missing", () => {
    const result = CreateAnalysisBody.safeParse({
      resumeText: "Jane Smith\n5 years React experience",
      jobDescriptionText: "We are hiring a senior frontend engineer.",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("jobTitle"))).toBe(true);
    }
  });
});
