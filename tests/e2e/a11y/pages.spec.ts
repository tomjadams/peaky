import type { Page } from "@playwright/test";
import { test, expect } from "../helpers/fixtures";
import AxeBuilder from "@axe-core/playwright";

async function recordFirstChecklistGap(page: Page): Promise<void> {
  const question = page.locator('article[id^="question-"]').first();
  await question.getByRole("button", { name: /items complete Expand/ }).click();
  const practice = question.getByRole("checkbox").first();
  await practice.check();
  await practice.uncheck();
  await page.waitForTimeout(400);
}

/**
 * Accessibility tests using axe-core to verify WCAG 2.0 AA and WCAG 2.1 AA compliance.
 * Tests pages against wcag2a, wcag2aa, wcag21a, and wcag21aa standards.
 */
test.describe("Accessibility - Pages", () => {
  test("home page has no critical accessibility violations", async ({
    page,
    seed,
  }) => {
    // "/" is the landing page — the product's concept page, reachable for
    // both signed-out visitors and signed-in teammates (e.g. via the
    // sidebar logo). OIDC is disabled in this harness, so every visitor
    // counts as signed in and the CTA reads "Go to Teams".
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Every “ready” has blind spots." })
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("templates page has no critical accessibility violations", async ({
    page,
    seed,
  }) => {
    await page.goto("/templates");
    await expect(
      page.getByRole("heading", { name: "Templates", level: 1 })
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("routed Follow-ups result passes axe at reflow width in both themes", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const reviewId = "01932b3c-7d00-7000-8000-000000002001";
    const planUrl = `/teams/payments-scalability/reviews/${reviewId}/plan`;

    await page.goto(
      `/teams/payments-scalability/reviews/${reviewId}/assessment`
    );
    await expect(page.getByText("Progress", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await recordFirstChecklistGap(page);
    await page.goto(planUrl);
    await expect(
      page.getByRole("region", { name: "Maturity estimate" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Follow-ups", level: 1 })
    ).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Needs attention" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /questions? still need/ })
    ).toBeVisible();

    for (const theme of ["light", "dark"] as const) {
      const dark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      if ((theme === "dark") !== dark) {
        await page
          .getByRole("button", {
            name:
              theme === "dark" ? "Switch to dark mode" : "Switch to light mode",
          })
          .click();
      }
      await expect(page.locator("html")).toHaveClass(
        theme === "dark" ? /dark/ : /light/
      );

      for (const width of [1440, 1280, 720, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth + 1
            )
          )
          .toBe(true);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(results.violations, `${theme} theme at ${width}px`).toEqual([]);
      }
    }
  });

  test("Review Details maturity result reflows and passes axe in both themes", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const reviewId = "01932b3c-7d00-7000-8000-000000002001";
    const reviewUrl = `/teams/payments-scalability/reviews/${reviewId}`;

    await page.goto(`${reviewUrl}/assessment`);
    await expect(page.getByText("Progress", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await recordFirstChecklistGap(page);
    await page.goto(reviewUrl);
    await expect(
      page.getByRole("heading", { name: "Maturity", level: 3 })
    ).toBeVisible({
      timeout: 15_000,
    });

    for (const theme of ["light", "dark"] as const) {
      const dark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      if ((theme === "dark") !== dark) {
        await page
          .getByRole("button", {
            name:
              theme === "dark" ? "Switch to dark mode" : "Switch to light mode",
          })
          .click();
      }
      for (const width of [1440, 720, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth + 1
            )
          )
          .toBe(true);
        const results = await new AxeBuilder({ page })
          .include(".review-breakdown")
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(results.violations, `${theme} theme at ${width}px`).toEqual([]);
      }
    }
  });

  test("assessment page has no critical accessibility violations", async ({
    page,
    seed,
  }) => {
    await page.goto(
      `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`
    );
    await page.waitForLoadState("networkidle");
    // Wait for actual page content to ensure page loaded (not a 404 error)
    await expect(page.getByText("Progress", { exact: true })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
