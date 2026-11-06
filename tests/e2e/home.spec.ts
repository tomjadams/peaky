import { test, expect } from "./helpers/fixtures";

// OIDC is disabled in the e2e/local harness (no NUXT_OIDC_* env vars), so
// every visitor counts as signed in and "/" renders the landing's
// signed-in variant — "Go to Teams" in place of "Continue with Okta".
test.describe("Home page", () => {
  test("links the landing page to the teams dashboard", async ({
    page,
    seed,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Every “ready” has blind spots." })
    ).toBeVisible();

    await page.getByRole("button", { name: "Go to Teams" }).first().click();

    await expect(page).toHaveURL(/\/teams$/);
    await expect(
      page.getByRole("heading", { name: /teams dashboard/i })
    ).toBeVisible();
    await expect(page.getByText(seed.team.name)).toBeVisible();
  });
});
