import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "api-client-react",
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
