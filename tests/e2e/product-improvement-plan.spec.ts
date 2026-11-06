import { test, expect } from "./helpers/fixtures";

/**
 * E2E tests for the product improvement plan page.
 *
 * Uses the server-seeded demo product (Demo Payments Scalability).
 * The product has team contributors (payments-scalability team) whose
 * reviews have all questions unanswered — so plan items are predictably present.
 */

const DEMO_PRODUCT_ID = "01932b3c-7d00-7000-8000-000000000001";
const DEMO_PRODUCT_REVIEW_ID = "01932b3c-7d00-7000-8000-000000003001";
const MATURITY_REVIEW_ID = "01932b3c-7d00-7000-8000-000000002001";
const OVERFLOW_REVIEW_ID = "01932b3c-7d00-7000-8000-000000002007";
const SECOND_OVERFLOW_REVIEW_ID = "01932b3c-7d00-7000-8000-000000002008";
const PLAN_URL = `/products/${DEMO_PRODUCT_ID}/plan`;
const PRODUCT_URL = `/products/${DEMO_PRODUCT_ID}`;
const PRODUCT_REVIEW_URL = `${PRODUCT_URL}/reviews/${DEMO_PRODUCT_REVIEW_ID}`;
const PRODUCT_REVIEW_PLAN_URL = `${PRODUCT_REVIEW_URL}/plan`;

test.describe("Product Improvement Plan", () => {
  test.setTimeout(60_000);

  // NOTE: Tests that navigate via the product/review details page are
  // skipped because the local-first SQLite database is not seeded with demo
  // data in the E2E environment (OPFS/WASM initialisation is unreliable in
  // Playwright headless). The plan-page tests below work because they call
  // the Nitro server API directly, bypassing the local DB.

  test.skip("product details page shows Follow-ups button", async ({
    page,
  }) => {
    await page.goto(PRODUCT_URL);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("link", { name: /Follow-ups/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test.skip("product review details header shows Follow-ups button", async ({
    page,
  }) => {
    await page.goto(PRODUCT_REVIEW_URL);
    await page.waitForLoadState("domcontentloaded");

    const planButton = page.getByRole("button", { name: /Follow-ups/i });
    await expect(planButton).toBeVisible({ timeout: 15_000 });
    await planButton.click();

    await expect(page).toHaveURL(new RegExp(`${PRODUCT_REVIEW_PLAN_URL}$`), {
      timeout: 10_000,
    });
  });

  test("product plan page loads with contributor section", async ({ page }) => {
    await page.goto(PLAN_URL);
    await page.waitForLoadState("domcontentloaded");

    // Page should load and show "Follow-ups" heading
    await expect(
      page.getByRole("heading", { name: "Follow-ups" }).first()
    ).toBeVisible({ timeout: 15_000 });

    // The contributor factors table keeps each source review visible.
    await expect(
      page.getByRole("heading", { name: "Contributor factors" })
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test("product plan page shows team contributor section", async ({ page }) => {
    await page.goto(PLAN_URL);
    await page.waitForLoadState("domcontentloaded");

    // Wait for plan to fully load
    await expect(
      page.getByRole("heading", { name: "Contributor factors" })
    ).toBeVisible({ timeout: 15_000 });

    // Should have contributor rows (payments-scalability team reviews)
    // The demo product has teamIds: ["payments-scalability"] which has reviews
    await expect(page.getByText("Team", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("product plan includes product-level, application, and team contributors", async ({
    page,
  }) => {
    await page.goto(PLAN_URL);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: "Contributor factors" })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText("Product review", { exact: true }).first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Application", { exact: true }).first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Team", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    await page
      .getByRole("button", { name: "Filter contributors by type" })
      .click();
    await page.getByRole("menuitem", { name: "Product reviews" }).click();
    const contributors = page.locator(".product-plan-contributors");
    await expect(
      contributors.getByRole("link", {
        name: "Demo Product Review",
        exact: true,
      })
    ).toBeVisible();
    await expect(
      contributors.getByText("Application", { exact: true })
    ).toHaveCount(0);
  });

  test("product follow-ups keep each Review Revision result separate", async ({
    page,
  }) => {
    await page.goto(PLAN_URL);
    await expect(
      page.getByRole("heading", { name: "Contributor factors" })
    ).toBeVisible({ timeout: 15_000 });

    const contributors = page.locator(".product-plan-contributors");
    const reviewLink = contributors.getByRole("link", {
      name: "2026 Operational Readiness Review",
      exact: true,
    });
    const row = contributors
      .locator(".product-plan-contributors__row")
      .filter({ hasText: "2026 Operational Readiness Review" })
      .first();
    const revisionLines = row.locator(".maturity-compact > a");
    await expect(revisionLines).toHaveCount(2);
    await expect(revisionLines.nth(0)).toContainText("Revision 1");
    await expect(revisionLines.nth(0)).toContainText("59%");
    await expect(revisionLines.nth(0)).toContainText("Stage 4 · Measured");
    await expect(revisionLines.nth(0)).toContainText("6/10 answered");
    await expect(revisionLines.nth(0)).toContainText("Provisional");
    await expect(revisionLines.nth(0)).toHaveAttribute(
      "href",
      new RegExp(
        `/teams/payments-scalability/reviews/${MATURITY_REVIEW_ID}/plan\\?templateRevisionId=`
      )
    );
    await expect(revisionLines.nth(1)).toContainText("Revision 1");
    await expect(revisionLines.nth(1)).toContainText("13%");
    await expect(revisionLines.nth(1)).toContainText("Stage 2 · Ad-hoc");
    await expect(revisionLines.nth(1)).toContainText("2/4 answered");
    await expect(revisionLines.nth(1)).toContainText("Provisional");

    const sourceRevisionLine = page
      .getByTestId("product-plan-rollups")
      .locator(".product-plan-rollups__sources .maturity-compact > a")
      .first();
    await expect(sourceRevisionLine).toBeVisible();
    await expect(sourceRevisionLine).toContainText(/Revision \d+/);
    await expect(sourceRevisionLine).toHaveAttribute(
      "href",
      /\/plan\?templateRevisionId=/
    );

    const labels = await revisionLines
      .locator(":scope > span:first-child")
      .allTextContents();
    expect(labels).toHaveLength(2);
    expect(labels[0]).not.toBe(labels[1]);
    await expect(revisionLines.nth(0)).not.toContainText(labels[1]!);
    await expect(revisionLines.nth(1)).not.toContainText(labels[0]!);
    await expect(page.locator(".product-plan__main")).not.toContainText(
      /combined score|overall score|team maturity|product maturity/i
    );

    await reviewLink.focus();
    await page.keyboard.press("Tab");
    await expect(revisionLines.nth(0)).toBeFocused();

    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize({ width: 1440, height: 900 });
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
        await expect(revisionLines.nth(0)).toBeVisible();
        await expect(sourceRevisionLine).toBeVisible();
        await expect
          .poll(() =>
            page
              .locator(".product-plan")
              .evaluate(
                (element) => element.scrollWidth <= element.clientWidth + 1
              )
          )
          .toBe(true);
      }
    }
  });

  test("rollup source grouping exposes every contributing Review", async ({
    page,
  }) => {
    for (const reviewId of [OVERFLOW_REVIEW_ID, SECOND_OVERFLOW_REVIEW_ID]) {
      await page.route(
        `**/api/reviews/${reviewId}/workspace`,
        async (route) => {
          const response = await route.fetch({
            url: route
              .request()
              .url()
              .replace(reviewId, "01932b3c-7d00-7000-8000-000000002001"),
          });
          const workspace = await response.json();
          await route.fulfill({
            response,
            json: {
              ...workspace,
              review: {
                ...workspace.review,
                id: reviewId,
                name: `Synthetic overflow review ${reviewId.slice(-1)}`,
              },
            },
          });
        }
      );
    }
    await page.route(
      `**/api/products/${DEMO_PRODUCT_ID}/contributors`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            productId: DEMO_PRODUCT_ID,
            productName: "Demo Payments Scalability",
            contributors: [
              {
                reviewId: DEMO_PRODUCT_REVIEW_ID,
                reviewName: "Demo Product Review",
                contributorType: "product-review",
                sourceName: "Demo Payments Scalability",
                sourceId: DEMO_PRODUCT_ID,
              },
              {
                reviewId: "01932b3c-7d00-7000-8000-000000002001",
                reviewName: "2026 Operational Readiness Review",
                contributorType: "team",
                sourceName: "Payments Scalability",
                sourceId: "payments-scalability",
              },
              {
                reviewId: "01932b3c-7d00-7000-8000-000000002006",
                reviewName: "Demo Payments Scalability Reliability Drill",
                contributorType: "application",
                sourceName: "ModificationQueueProcessor",
                sourceId: "modificationqueueprocessor",
              },
              {
                reviewId: OVERFLOW_REVIEW_ID,
                reviewName: "Synthetic overflow review 7",
                contributorType: "application",
                sourceName: "Synthetic overflow contributor 7",
                sourceId: "modificationqueueprocessor",
              },
              {
                reviewId: SECOND_OVERFLOW_REVIEW_ID,
                reviewName: "Synthetic overflow review 8",
                contributorType: "application",
                sourceName: "Synthetic overflow contributor 8",
                sourceId: "modificationqueueprocessor",
              },
            ],
          }),
        })
    );

    await page.goto(PLAN_URL);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByTestId("product-plan-rollups")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/Repeated in \d+ reviews/).first()
    ).toBeVisible();
    const firstRollup = page
      .getByTestId("product-plan-rollups")
      .locator(".plan-section-card__item")
      .first();
    await expect
      .poll(async () => {
        const questionId = await firstRollup
          .locator(".plan-section-card__question-id")
          .boundingBox();
        const actions = await firstRollup
          .locator(".plan-section-card__actions")
          .boundingBox();
        if (!questionId || !actions) return false;
        return (
          questionId.x + questionId.width <= actions.x ||
          questionId.y + questionId.height <= actions.y ||
          actions.y + actions.height <= questionId.y
        );
      })
      .toBe(true);

    const sourceReviews = firstRollup.getByRole("list", {
      name: "Source reviews",
    });
    await expect(sourceReviews.getByRole("listitem")).not.toHaveCount(0);
    const syntheticSource = sourceReviews.getByRole("listitem", {
      name: "Synthetic overflow review 8 source",
    });
    await expect(syntheticSource).toBeVisible({ timeout: 10_000 });
    await expect(
      syntheticSource.locator(".maturity-compact > a").first()
    ).toBeVisible();
    await expect(
      syntheticSource.locator(".maturity-compact > a").first()
    ).toContainText(/Revision \d+/);
  });

  test.skip("navigates from product details to plan and back", async ({
    page,
  }) => {
    await page.goto(PRODUCT_URL);
    await page.waitForLoadState("domcontentloaded");

    // Click Follow-ups button
    const planLink = page.getByRole("link", { name: /Follow-ups/i });
    await expect(planLink).toBeVisible({ timeout: 15_000 });
    await planLink.click();

    await expect(page).toHaveURL(new RegExp(`${PLAN_URL}$`), {
      timeout: 10_000,
    });

    // Page loads with the plan heading
    await expect(
      page.getByRole("heading", { name: "Follow-ups" }).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
