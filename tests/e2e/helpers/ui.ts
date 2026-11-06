/**
 * Reusable UI interaction helpers for E2E tests.
 *
 * These exercise the UI directly (clicks, form fills) and are NOT seed
 * functions — they don't insert data via mutations.  They exist to reduce
 * duplication in tests that share common interaction patterns.
 *
 * @see tests/e2e/helpers/seed.ts      — Data seeding via mutation functions
 * @see tests/e2e/helpers/fixtures.ts  — Playwright fixture wiring
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { SeedTemplate } from "./seed";

/**
 * Select a template in the review wizard by searching for its name.
 * Must be called when the wizard step 1 (template selection) is visible.
 */
export async function selectTemplateInWizard(
  page: Page,
  template: SeedTemplate
): Promise<void> {
  const searchInput = page.getByPlaceholder("Search Revisions...");
  await searchInput.fill(template.selectionName);

  const card = page.getByTestId(
    `template-card-${template.selectionRevisionId}`
  );
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.click({ force: true });
}
