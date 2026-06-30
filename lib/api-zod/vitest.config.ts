import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "api-zod",
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
