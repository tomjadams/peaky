/**
 * You might ask... why not using `projects` feature instead of two vitest cfg?
 *
 * The @nuxt/test-utils `defineVitestConfig` wrapper throws:
 * "The `projects` option is not supported with `defineVitestConfig`".
 *
 * Apparently it's because Nuxt test env uses auto-imports like ref/useState, etc.
 * that must be configured at the root level, not per-project.
 *
 * So we use separate config files with --config flag as the workaround.
 *
 * @see vitest.integration.config.ts for slow integration tests
 * @see https://nuxt.com/docs/getting-started/testing
 */
import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    environment: "nuxt",
    setupFiles: ["./tests/setup.ts"],
    // tests/guards/** are repository lints (generated files match their source,
    // specs still describe the code they claim to). They run here because they
    // are as fast as a unit test, but they assert about files, not behaviour.
    include: [
      "tests/unit/**/*.test.ts",
      "tests/nuxt/**/*.test.ts",
      "tests/guards/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      // Only measure coverage for code we unit test (services, composables, utils).
      // Vue components are covered by E2E tests, not unit tests.
      include: [
        "app/services/**",
        "app/composables/**",
        "app/ui/**",
        "app/local-db/**",
        "shared/**",
        "server/api/**",
        "server/utils/**",
      ],
      exclude: ["**/*.d.ts", "**/*.test.ts", "**/*.spec.ts", "server/data/**"],
      // Ratchet: set just below current levels to prevent regression.
      // Raise thresholds as coverage improves — never lower them.
      thresholds: {
        lines: 35,
        functions: 50,
        branches: 65,
        statements: 35,
      },
    },
  },
});
