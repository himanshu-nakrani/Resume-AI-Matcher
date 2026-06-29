import type { Analysis } from "@workspace/api-client-react";
import { NotesSection } from "./shared";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function NotesTab({ analysis, id }: TabProps) {
  return <NotesSection analysisId={id} initialNotes={analysis.notes ?? null} />;
}
