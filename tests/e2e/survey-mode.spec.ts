import { test, expect } from "./helpers/fixtures";
import { seedReview } from "./helpers/seed";

test.describe("Survey Mode Navigation", () => {
  test("clicking Survey Mode navigates to survey page", async ({
    page,
    seed,
  }) => {
    const assessmentPath = `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`;
    const surveyPath = `/teams/${seed.team.id}/reviews/${seed.review.id}/survey`;

    await page.goto(assessmentPath);
    await page.waitForLoadState("domcontentloaded");

    const surveyModeButton = page.getByRole("button", {
      name: /survey mode/i,
    });
    await expect(surveyModeButton).toBeVisible();
    await surveyModeButton.click();

    await expect(page).toHaveURL(surveyPath);
  });

  test("survey page shows single question at a time", async ({
    page,
    seed,
  }) => {
    await page.goto(`/teams/${seed.team.id}/reviews/${seed.review.id}/survey`);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("article").getByRole("heading", { level: 2 })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /previous/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /next/i })).toBeVisible();

    // First question is yes-no so Yes/No buttons should be visible
    await expect(page.getByRole("button", { name: /^yes$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^no$/i })).toBeVisible();
  });

  test("can navigate between questions in survey", async ({ page, seed }) => {
    await page.goto(`/teams/${seed.team.id}/reviews/${seed.review.id}/survey`);
    await page.waitForLoadState("domcontentloaded");

    const question = page
      .getByRole("article")
      .getByRole("heading", { level: 2 });
    const initialText = await question.textContent();

    await page.getByRole("button", { name: /next/i }).click();
    await expect(question).not.toHaveText(initialText ?? "");
  });

  test("Exit survey on survey page returns to assessment", async ({
    page,
    seed,
  }) => {
    const assessmentPath = `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`;
    const surveyPath = `/teams/${seed.team.id}/reviews/${seed.review.id}/survey`;

    await page.goto(surveyPath);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("link", { name: /exit survey/i }).click();

    await expect(page).toHaveURL(assessmentPath);
  });

  test("not applicable link opens modal in survey", async ({ page, seed }) => {
    await page.goto(`/teams/${seed.team.id}/reviews/${seed.review.id}/survey`);
    await page.waitForLoadState("domcontentloaded");

    const answerGroup = page.getByRole("group", {
      name: "Primary answer options",
    });
    const notApplicable = answerGroup.getByRole("button", {
      name: /not applicable/i,
    });
    await expect(notApplicable).toHaveAttribute("aria-pressed", "false");
    await notApplicable.click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByText("Why is this question not applicable?")
    ).toBeVisible();
  });

  test("answering question shows selected state", async ({ page, seed }) => {
    await page.goto(`/teams/${seed.team.id}/reviews/${seed.review.id}/survey`);
    await page.waitForLoadState("domcontentloaded");

    const yesButton = page.getByRole("button", { name: /^yes$/i });
    await yesButton.click();

    await expect(yesButton).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Product Survey Mode", () => {
  test("product survey page shows single question at a time", async ({
    page,
    seed,
  }) => {
    const productReviewId = await seedReview(page, {
      name: `[E2E] Product Review ${Date.now()}`,
      subjectId: seed.product.id,
      subjectType: "product",
      templateRevisionIds: [seed.template.publishedRevisionId],
    });

    await page.goto(
      `/products/${seed.product.id}/reviews/${productReviewId}/survey`
    );
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("article").getByRole("heading", { level: 2 })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^yes$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^no$/i })).toBeVisible();
  });

  test("Survey Mode toggle navigates to product survey, Exit survey returns", async ({
    page,
    seed,
  }) => {
    const productReviewId = await seedReview(page, {
      name: `[E2E] Product Review ${Date.now()}`,
      subjectId: seed.product.id,
      subjectType: "product",
      templateRevisionIds: [seed.template.publishedRevisionId],
    });

    const assessmentPath = `/products/${seed.product.id}/reviews/${productReviewId}/assessment`;
    const surveyPath = `/products/${seed.product.id}/reviews/${productReviewId}/survey`;

    await page.goto(assessmentPath);
    await page.waitForLoadState("domcontentloaded");

    const surveyModeButton = page.getByRole("button", { name: /survey mode/i });
    await expect(surveyModeButton).toBeVisible();
    await surveyModeButton.click();
    await expect(page).toHaveURL(surveyPath);

    // The survey route's kiosk layout has no header toggle to click back with
    // — "Exit survey" is the only way out.
    await page.getByRole("link", { name: /exit survey/i }).click();
    await expect(page).toHaveURL(assessmentPath);
  });

  test("product survey answering question shows selected state", async ({
    page,
    seed,
  }) => {
    const productReviewId = await seedReview(page, {
      name: `[E2E] Product Review ${Date.now()}`,
      subjectId: seed.product.id,
      subjectType: "product",
      templateRevisionIds: [seed.template.publishedRevisionId],
    });

    await page.goto(
      `/products/${seed.product.id}/reviews/${productReviewId}/survey`
    );
    await page.waitForLoadState("domcontentloaded");

    const yesButton = page.getByRole("button", { name: /^yes$/i });
    await yesButton.click();

    await expect(yesButton).toHaveAttribute("aria-pressed", "true");
  });
});
