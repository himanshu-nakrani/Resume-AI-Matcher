import type { Analysis } from "@workspace/api-client-react";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function OverviewTab({ analysis: _analysis, id: _id }: TabProps) {
  return <div>Overview placeholder</div>;
}
