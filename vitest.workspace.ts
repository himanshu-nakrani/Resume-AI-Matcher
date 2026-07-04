import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "lib/api-client-react/vitest.config.ts",
  "lib/api-zod/vitest.config.ts",
  "lib/db/vitest.config.ts",
  "lib/integrations-openai-ai-server/vitest.config.ts",
  "artifacts/api-server/vitest.config.ts",
  "artifacts/resume-matcher/vitest.config.ts",
]);
