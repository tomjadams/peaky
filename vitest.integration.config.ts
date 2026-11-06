import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
      "#shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  test: {
    name: "integration",
    include: [
      "tests/integration/migrations.test.ts",
      "tests/integration/maturity-definition-migration.test.ts",
      "tests/integration/maturity-override-migration.test.ts",
      "tests/integration/handoff-practices-migration.test.ts",
      "tests/integration/handoff-associations-migration.test.ts",
      "tests/integration/template-revisions-migration.test.ts",
      "tests/integration/template-revisions-schema.test.ts",
      "tests/integration/template-fixture-bootstrap.test.ts",
      "tests/integration/field-version-events-migration.test.ts",
      "tests/integration/foreign-key-cascade.test.ts",
      "tests/integration/review-workspace-materializer.test.ts",
      "tests/integration/api/sync.test.ts",
    ],
    environment: "node",
  },
});
