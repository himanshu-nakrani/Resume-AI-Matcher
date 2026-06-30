import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "integrations-openai-ai-server",
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
