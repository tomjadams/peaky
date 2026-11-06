/**
 * One-shot screenshot capture for /events documentation.
 *
 * NOT a regression test — captures into site/docs/assets/images/. Runs
 * under the opt-in `docs` Playwright project so it doesn't run on
 * `pnpm test:e2e`.
 *
 * **Recommended: capture against the live preview** (same UI as
 * production, no Nuxt devtools). The password gate is handled automatically.
 *
 *   PLAYWRIGHT_BASE_URL=https://orr-sample.vercel.app \
 *     pnpm playwright test --project=docs scripts/docs/capture-events-screenshots.spec.ts
 *
 * Local fallback (devtools hidden via CSS injection below):
 *
 *   pnpm playwright test --project=docs scripts/docs/capture-events-screenshots.spec.ts
 */
import { test } from "@playwright/test";
import path from "node:path";
import {
  fullPageScreenshotWithFixedElements,
  handlePasswordGate,
  hideDevtoolsCss,
} from "./_capture-helpers";

const OUT_DIR = path.resolve("site/docs/assets/images");

test.describe("Capture /events screenshots", () => {
  test("capture light + dark full-page", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await handlePasswordGate(page);
    await page.waitForTimeout(1500);

    await page.addStyleTag({ content: hideDevtoolsCss });

    // Light
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark")
    );
    await page.waitForTimeout(300);
    await fullPageScreenshotWithFixedElements(
      page,
      path.join(OUT_DIR, "events-page.png")
    );

    // Dark
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(300);
    await fullPageScreenshotWithFixedElements(
      page,
      path.join(OUT_DIR, "events-page-dark.png")
    );
  });
});
