/**
 * Playwright custom fixtures for E2E tests.
 *
 * Provides a `seed` fixture that inserts a standard scenario into the local DB
 * before each test, eliminating dependency on server demo data.
 *
 * Usage:
 *   import { test, expect } from "../helpers/fixtures";
 *
 *   test("my test", async ({ page, seed }) => {
 *     await page.goto(`/teams/${seed.team.id}`);
 *     // seed.template.id, seed.review.id, etc.
 *   });
 */

import { test as base, expect } from "@playwright/test";
import { waitForLocalDb, seedStandardScenario, type SeedResult } from "./seed";

export { expect };

export const test = base.extend<{ seed: SeedResult; seedMaturity: SeedResult }>(
  {
    seed: async ({ page }, use) => {
      await page.addInitScript(() => {
        localStorage.setItem(
          "peaky:current-actor",
          JSON.stringify({ id: "actor_admin", name: "Admin", roles: ["admin"] })
        );
      });
      // Navigate to the app root so the local DB is initialized
      await page.goto("/");
      await waitForLocalDb(page);

      // Insert standard scenario
      const result = await seedStandardScenario(page);

      // Reload so the UI picks up the seeded data
      await page.reload();
      await waitForLocalDb(page);

      await use(result);
    },
    /** Standard scenario whose pinned Revision carries a maturity definition. */
    seedMaturity: async ({ page }, use) => {
      await page.addInitScript(() => {
        localStorage.setItem(
          "peaky:current-actor",
          JSON.stringify({ id: "actor_admin", name: "Admin", roles: ["admin"] })
        );
      });
      await page.goto("/");
      await waitForLocalDb(page);

      const result = await seedStandardScenario(page, { maturity: true });

      await page.reload();
      await waitForLocalDb(page);

      await use(result);
    },
  }
);
