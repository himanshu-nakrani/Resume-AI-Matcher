import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "api-server",
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    setupFiles: ["src/test/setup.ts"],
  },
});
