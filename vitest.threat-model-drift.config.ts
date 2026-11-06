import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/guards/threat-model-drift.test.ts"],
    pool: "threads",
  },
});
