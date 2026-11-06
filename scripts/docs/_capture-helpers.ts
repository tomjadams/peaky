/**
 * Shared helpers for the docs screenshot capture scripts.
 *
 * Not a Playwright spec — the leading underscore prevents Playwright
 * from picking this up as a test file. Imported by sibling
 * `capture-*.spec.ts` files.
 */
import type { Page } from "@playwright/test";

/**
 * Handles the orr-sample.vercel.app password gate.
 *
 * The live preview is protected by a simple password form. Call this
 * after every `page.goto()` + `waitForLoadState` — it's a no-op when
 * running against localhost or any host that doesn't show the gate.
 */
export async function handlePasswordGate(page: Page): Promise<void> {
  const passwordInput = page.getByRole("textbox", { name: /password/i });
  if (!(await passwordInput.isVisible({ timeout: 2000 }).catch(() => false))) {
    return;
  }
  await passwordInput.fill("stijne");
  await page.getByRole("button", { name: /authenticate/i }).click();
  await page.waitForLoadState("networkidle");
}

/**
 * Full-page screenshot that handles fixed-position elements correctly.
 *
 * Playwright's `fullPage: true` extends the document height to render
 * everything below the fold, but fixed-position elements anchored to
 * viewport units (e.g. `NavigationSidebar` uses
 * `height: calc(100vh - 5rem)`) stay at the original viewport's height.
 * Result: long pages show the sidebar cut off at ~half height in the
 * screenshot.
 *
 * Workaround: measure the document scroll-height first, resize the
 * viewport to match (capped to a sane max), then take a regular
 * screenshot. Fixed elements with `100vh` heights now stretch to fill.
 */
export async function fullPageScreenshotWithFixedElements(
  page: Page,
  outPath: string
): Promise<void> {
  const documentHeight = await page.evaluate(
    () => document.documentElement.scrollHeight
  );
  const viewport = page.viewportSize();
  const width = viewport?.width ?? 1280;
  // Cap at 6000px so a runaway page can't blow up the headless renderer.
  const height = Math.min(Math.max(documentHeight, 600), 6000);
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(150); // let layout settle after resize
  await page.screenshot({ path: outPath });
}

/**
 * CSS to hide every Nuxt devtools surface element. Inject via
 * `page.addStyleTag({ content: hideDevtoolsCss })` after navigation
 * but before the first screenshot. Only relevant when capturing
 * against local dev (preview deployments don't ship devtools).
 */
export const hideDevtoolsCss = `
  #nuxt-devtools-anchor,
  [data-v-inspector-host],
  nuxt-devtools-host-iframe,
  .nuxt-devtools__anchor,
  [class*="nuxt-devtools"],
  [id*="nuxt-devtools"] {
    display: none !important;
    visibility: hidden !important;
  }
`;
