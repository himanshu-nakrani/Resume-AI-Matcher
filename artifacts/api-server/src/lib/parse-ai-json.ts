/**
 * Strips markdown code fences and isolates the outermost JSON object or array
 * from LLM output (models often wrap JSON in ```json ... ```).
 */
export function extractAiJsonPayload(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*\r?\n?/i, "");
  s = s.replace(/\r?\n?```\s*$/i, "");
  s = s.trim();
  const objStart = s.indexOf("{");
  const objEnd = s.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    return s.slice(objStart, objEnd + 1);
  }
  const arrStart = s.indexOf("[");
  const arrEnd = s.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    return s.slice(arrStart, arrEnd + 1);
  }
  return s;
}

/** Parses JSON from model text that may include fences or leading/trailing prose. */
export function parseAiJson<T>(raw: string): T {
  return JSON.parse(extractAiJsonPayload(raw)) as T;
}
