import type { Analysis } from "@workspace/api-client-react";
import { JobTrackingSection } from "./shared";

interface TabProps {
  analysis: Analysis;
  id: number;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return stringArray(parsed);
    } catch {
      return [trimmed];
    }

    return [trimmed];
  }

  return [];
}

export function PipelineTab({ analysis, id }: TabProps) {
  return (
    <JobTrackingSection
      analysisId={id}
      analysis={{
        deadline: analysis.deadline ?? null,
        contactName: analysis.contactName ?? null,
        contactEmail: analysis.contactEmail ?? null,
        followUpDate: analysis.followUpDate ?? null,
        tags: stringArray(analysis.tags),
        portfolioLinks: stringArray(analysis.portfolioLinks),
        jobTitle: analysis.jobTitle,
        companyName: analysis.companyName ?? null,
        versionLabel: (analysis as { versionLabel?: string | null }).versionLabel ?? null,
        location: (analysis as { location?: string | null }).location ?? null,
        salaryExpectation: (analysis as { salaryExpectation?: string | null }).salaryExpectation ?? null,
      }}
    />
  );
}
