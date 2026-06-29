import type { Analysis } from "@workspace/api-client-react";
import { JobTrackingSection } from "./shared";

interface TabProps {
  analysis: Analysis;
  id: number;
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
        tags: (analysis.tags as string[]) ?? [],
        portfolioLinks: (analysis.portfolioLinks as string[]) ?? [],
        jobTitle: analysis.jobTitle,
        companyName: analysis.companyName ?? null,
        versionLabel: (analysis as { versionLabel?: string | null }).versionLabel ?? null,
        location: (analysis as { location?: string | null }).location ?? null,
        salaryExpectation: (analysis as { salaryExpectation?: string | null }).salaryExpectation ?? null,
      }}
    />
  );
}
