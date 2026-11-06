/**
 * One-shot screenshot capture for /system documentation.
 *
 * NOT a regression test — captures into site/docs/assets/images/ so the
 * user-guide screenshots stay current. Runs under the opt-in `docs`
 * Playwright project so it doesn't run on `pnpm test:e2e`.
 *
 * **Recommended: capture against the live preview** so the screenshots
 * match the deployed UI exactly (no Nuxt devtools, no local-only state).
 * The password gate is handled automatically.
 *
 *   PLAYWRIGHT_BASE_URL=https://orr-sample.vercel.app \
 *     pnpm playwright test --project=docs scripts/docs/capture-system-screenshots.spec.ts
 *
 * Local fallback (when no preview is available — devtools is hidden via
 * the CSS injection below):
 *
 *   pnpm playwright test --project=docs scripts/docs/capture-system-screenshots.spec.ts
 */
import { test } from "@playwright/test";
import path from "node:path";
import {
  fullPageScreenshotWithFixedElements,
  handlePasswordGate,
  hideDevtoolsCss,
} from "./_capture-helpers";

const OUT_DIR = path.resolve("site/docs/assets/images");

test.describe("Capture /system screenshots", () => {
  test("capture light + dark full-page", async ({ page }) => {
    test.setTimeout(120_000);

    // Wait for bootstrap so we capture steady-state tiles, not Initializing.
    await page.goto("/system");
    await page.waitForLoadState("networkidle");
    await handlePasswordGate(page);
    await page.waitForTimeout(2000);

    await page.addStyleTag({ content: hideDevtoolsCss });

    const refreshButton = page.getByRole("button", { name: /refresh/i });
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(800);
    }

    // Light
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark")
    );
    await page.waitForTimeout(300);
    await fullPageScreenshotWithFixedElements(
      page,
      path.join(OUT_DIR, "system-page.png")
    );

    // Dark
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(300);
    await fullPageScreenshotWithFixedElements(
      page,
      path.join(OUT_DIR, "system-page-dark.png")
    );

    // ── Focused capture: Clear cache card (light + dark) ──────
    // The doc's Clear cache section needs a card-only shot that can sit
    // inline at body width without dwarfing the surrounding prose.
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark")
    );
    await page.waitForTimeout(300);
    const clearCacheCard = page
      .locator('section[aria-label="Actions"] >> :scope > *')
      .filter({ has: page.getByRole("heading", { name: /clear cache/i }) })
      .first();
    await clearCacheCard.scrollIntoViewIfNeeded();
    await clearCacheCard.screenshot({
      path: path.join(OUT_DIR, "system-clear-cache.png"),
    });

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(300);
    await clearCacheCard.scrollIntoViewIfNeeded();
    await clearCacheCard.screenshot({
      path: path.join(OUT_DIR, "system-clear-cache-dark.png"),
    });

    // ── Focused capture: each of the four engine-status tiles ────
    // The doc's "The four signals" subsections each describe one tile
    // in detail; readers scrolled past the hero forget which tile is
    // which. Card-level shots inline next to the prose anchor the
    // visual back to the description.
    const tileLabels = ["Database", "Sync", "Storage", "Schema"] as const;
    const tilesGrid = page.locator('section[aria-label="Engine status"]');

    for (const theme of ["light", "dark"] as const) {
      if (theme === "light") {
        await page.evaluate(() =>
          document.documentElement.classList.remove("dark")
        );
      } else {
        await page.evaluate(() =>
          document.documentElement.classList.add("dark")
        );
      }
      await page.waitForTimeout(300);

      for (const label of tileLabels) {
        const tile = tilesGrid
          .locator(":scope > *")
          .filter({ hasText: label })
          .first();
        await tile.scrollIntoViewIfNeeded();
        const slug = label.toLowerCase();
        const suffix = theme === "dark" ? "-dark" : "";
        await tile.screenshot({
          path: path.join(OUT_DIR, `system-tile-${slug}${suffix}.png`),
        });
      }
    }
  });
});
