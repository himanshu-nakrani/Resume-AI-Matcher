import type { Analysis } from "@workspace/api-client-react";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function CoverLetterTab({ analysis: _analysis, id: _id }: TabProps) {
  return <div>Cover letter placeholder</div>;
}
