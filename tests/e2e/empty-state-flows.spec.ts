/**
 * Wizard-only E2E coverage — exercises the "create from zero" path that
 * seeded tests can't reach.
 *
 * Why this exists: every other product-flow / teams-flow test takes the
 * seeded shortcut (`{ page, seed }`) which inserts fixtures directly into
 * the local DB before the UI loads. Useful for asserting downstream
 * behaviour, but it skips the actual product-creation wizard a brand-new
 * user walks through. Without this file, the wizard could break and 127
 * green E2E tests wouldn't catch it.
 *
 * The catalog directory (teams + people) loads regardless of seed, so
 * this test still has team/PM data available — it just doesn't pre-seed
 * any user-created entities (products, reviews, templates) via the
 * `__peakySeed` shortcut. Whatever the server returns on initial sync is
 * the only state present when the wizard runs.
 */
import { test, expect, type Page } from "@playwright/test";
import { waitForLocalDb } from "./helpers/seed";

async function selectCatalogUser(
  page: Page,
  fieldLabel: string,
  query: string,
  optionPattern: RegExp
): Promise<void> {
  const input = page
    .locator("label", { hasText: fieldLabel })
    .locator("..")
    .getByRole("textbox");
  await input.click();
  await input.fill(query);
  const option = page.getByRole("button", { name: optionPattern }).first();
  await expect(option).toBeVisible({ timeout: 15000 });
  await option.click();
}

async function selectCatalogEntity(
  page: Page,
  placeholder: string,
  query: string,
  optionPattern: RegExp
): Promise<void> {
  const input = page.getByPlaceholder(placeholder);
  await input.click();
  await input.fill(query);
  const option = page.getByRole("button", { name: optionPattern }).first();
  await expect(option).toBeVisible({ timeout: 15000 });
  await option.click();
}

test.describe("Onboarding — wizard works without the seed shortcut", () => {
  test("create-product wizard end-to-end with no `seed` fixture", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    // Bootstrap the local DB without using the seed fixture. The server
    // may pull demo data on first sync — we don't care; the wizard must
    // work in either case.
    await page.goto("/");
    await waitForLocalDb(page);

    const productName = `[E2E] Wizard ${Date.now()}`;

    // ── Reach the wizard from the products dashboard ──────────
    await page.goto("/products");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    // Whatever state /products renders (empty or with bootstrap data),
    // the "New Product" CTA must always be reachable as the primary
    // entry point.
    await page
      .getByRole("button", { name: /new product/i })
      .first()
      .click();
    await page.waitForURL(/\/products\/new$/, { timeout: 15000 });

    // ── Wizard step 1: Identity ────────────────────────────────
    await page.getByPlaceholder("e.g., Checkout, Launchpad").fill(productName);
    await page.getByText("Bespoke", { exact: true }).click();
    await selectCatalogUser(page, "Product Manager", "vlad", /vlad\.skuba/i);
    await page.getByRole("button", { name: /continue/i }).click();

    // ── Wizard step 2: Teams (catalog-driven, no seed needed) ─
    await selectCatalogEntity(
      page,
      "Search teams...",
      "payments-scalability",
      /payments-scalability/i
    );
    await page.getByRole("button", { name: /continue/i }).click();

    // ── Wizard step 3: Applications (skip — none seeded) ──────
    await page.getByRole("button", { name: /skip/i }).click();

    // ── Wizard step 4: Review + create ─────────────────────────
    await expect(page.getByText(productName)).toBeVisible();
    await page.getByRole("button", { name: /create product/i }).click();

    // ── Land on details ────────────────────────────────────────
    await page.waitForURL(/\/products\/[^/]+$/, { timeout: 15000 });
    await expect(
      page.getByText("Product created", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: productName, level: 1 })
    ).toBeVisible();

    // ── /products list should now show the newly-created product ─
    await page.goto("/products");
    await expect(page.getByRole("cell", { name: productName })).toBeVisible();
  });
});
