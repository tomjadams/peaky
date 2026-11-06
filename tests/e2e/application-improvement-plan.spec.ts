import { test, expect } from "./helpers/fixtures";

const DEMO_APP_ID = "modificationqueueprocessor";
const DEMO_REVIEW_ID = "01932b3c-7d00-7000-8000-000000002006";
const REVIEW_URL = `/applications/${DEMO_APP_ID}/reviews/${DEMO_REVIEW_ID}`;
const PLAN_URL = `${REVIEW_URL}/plan`;

test.describe("Application Follow-ups", () => {
  test.setTimeout(60_000);

  test("application review details links to Follow-ups", async ({ page }) => {
    await page.goto(REVIEW_URL);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("region", { name: "Maturity estimate" })
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("main")).toHaveCount(1);
    const planButton = page.getByRole("button", { name: /Follow-ups/i });
    await expect(planButton).toBeVisible({ timeout: 15_000 });
    await planButton.click();

    await expect(page).toHaveURL(new RegExp(`${PLAN_URL}$`), {
      timeout: 10_000,
    });
    // The redesigned plan page (maturity-score/REQ-018) presents per-
    // Revision results instead of the removed severity-bucket table.
    await expect(
      page.getByRole("heading", { name: "Follow-ups", level: 1 })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("group", { name: "Selected template" })
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("region", { name: "Maturity estimate" })
    ).toBeVisible();
  });

  test("application plan links back to the application assessment", async ({
    page,
  }) => {
    await page.goto(PLAN_URL);
    await page.waitForLoadState("domcontentloaded");

    // The demo application review is unanswered, so the explicit no-result
    // state offers the assessment deep link with the application route.
    const answerLink = page.getByRole("link", {
      name: "Continue assessment",
    });
    await expect(answerLink.first()).toBeVisible({ timeout: 15_000 });
    await answerLink.first().click();

    await expect(page).toHaveURL(
      new RegExp(
        `/applications/${DEMO_APP_ID}/reviews/${DEMO_REVIEW_ID}/assessment`
      ),
      { timeout: 10_000 }
    );
  });
});
