import { expect, test } from "./helpers/fixtures";
import { selectTemplateInWizard } from "./helpers/ui";

test.describe("Local-first write paths", () => {
  test("team review creation does not call team review create API", async ({
    page,
    seed,
  }) => {
    test.setTimeout(60000);
    const reviewName = `[E2E] Team Review ${Date.now()}`;
    let remoteCreateCalls = 0;

    await page.route("**/api/teams/*/reviews", async (route) => {
      if (route.request().method() === "POST") {
        remoteCreateCalls += 1;
        await route.fulfill({ status: 503, body: "blocked in test" });
        return;
      }
      await route.continue();
    });

    await page.goto(`/teams/${seed.team.id}`);

    await page
      .getByRole("link", { name: /start new review/i })
      .first()
      .click();
    await selectTemplateInWizard(page, seed.template);
    await page.getByTestId("wizard-next").click();
    await page.getByTestId("wizard-skip").click();
    await page.getByRole("textbox").first().fill(reviewName);
    await page.getByTestId("wizard-create").click();

    await expect(page).toHaveURL(
      new RegExp(`/teams/${seed.team.id}/reviews/[^/]+/assessment$`)
    );
    const reviewDetailsUrl = page.url().replace(/\/assessment$/, "");
    await page.goto(reviewDetailsUrl);
    await expect(page.getByText(/failed to load review/i)).toHaveCount(0);

    await page.goto(`${reviewDetailsUrl}/plan`);
    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible(
      { timeout: 15_000 }
    );
    // Wait for plan workspace to finish loading before asserting issue list
    await expect(
      page.getByRole("heading", { name: "Items needing attention" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("review-plan-issue-list")).toBeVisible({
      timeout: 10_000,
    });

    expect(remoteCreateCalls).toBe(0);
  });

  test("product review creation does not call product review create API", async ({
    page,
    seed,
  }) => {
    test.setTimeout(60000);
    const reviewName = `[E2E] Product Review ${Date.now()}`;
    let remoteCreateCalls = 0;

    await page.route("**/api/products/*/reviews", async (route) => {
      if (route.request().method() === "POST") {
        remoteCreateCalls += 1;
        await route.fulfill({ status: 503, body: "blocked in test" });
        return;
      }
      await route.continue();
    });

    await page.goto(`/products/${seed.product.id}`);

    await page
      .getByRole("link", { name: /start new review/i })
      .first()
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/products/${seed.product.id}/reviews/new$`)
    );

    await selectTemplateInWizard(page, seed.template);
    await page.getByTestId("wizard-next").click();
    await page.getByRole("textbox").first().fill(reviewName);
    await page.getByTestId("wizard-create").click();

    await expect(page).toHaveURL(
      new RegExp(`/products/${seed.product.id}/reviews/[^/]+/assessment$`)
    );
    const reviewDetailsUrl = page.url().replace(/\/assessment$/, "");
    await page.goto(reviewDetailsUrl);
    await expect(page.getByText(/failed to load review/i)).toHaveCount(0);

    expect(remoteCreateCalls).toBe(0);
  });
});
