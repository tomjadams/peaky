import { test, expect } from "./helpers/fixtures";

test.describe("Assessment persistence", () => {
  test("saved answers rehydrate review details and assessment progress", async ({
    page,
    seed,
  }) => {
    const assessmentUrl = `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`;
    const reviewUrl = `/teams/${seed.team.id}/reviews/${seed.review.id}`;

    await page.goto(assessmentUrl);
    await expect(page).toHaveURL(new RegExp(`/assessment$`));

    const firstQuestion = page.locator("article").first();
    const firstYesButton = firstQuestion.getByRole("button", { name: "Yes" });

    await firstYesButton.click();
    await expect(firstYesButton).toHaveAttribute("aria-pressed", "true");

    const assessmentProgress = (
      await page.locator(".dashboard__progress-percentage").textContent()
    )?.trim();

    expect(assessmentProgress).toBeTruthy();
    expect(assessmentProgress).not.toBe("0%");

    await page.getByTestId("assessment-save").click();
    await page
      .getByRole("dialog")
      .getByRole("textbox")
      .fill("Saved first answer");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save" })
      .click();

    await expect(
      page.getByText("Milestone saved!", { exact: true })
    ).toBeVisible();

    await page.goto(reviewUrl);

    await expect(page).toHaveURL(
      new RegExp(`/teams/${seed.team.id}/reviews/${seed.review.id}$`)
    );
    await expect(page.getByText("Overall Progress")).toBeVisible();
    await expect(
      page.getByText(assessmentProgress ?? "", { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByText(/1\s*\/\s*4/).first()).toBeVisible();
    const recentChanges = page.getByRole("table", { name: "Recent changes" });
    await expect(recentChanges).toContainText(seed.questions.yesNo1.text);
    await expect(recentChanges).toContainText("REL-1");
    await expect(recentChanges).toContainText("Admin");

    await page.goto(assessmentUrl);

    await expect(page).toHaveURL(new RegExp(`/assessment$`));
    await expect(
      firstQuestion.getByRole("button", { name: "Yes" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".dashboard__progress-percentage")).toHaveText(
      assessmentProgress ?? ""
    );
  });

  test("remote-only answers populate Recent changes", async ({ page }) => {
    const teamId = "payments-scalability";
    const reviewId = "01932b3c-7d00-7000-8000-000000002001";
    const assessmentUrl = `/teams/${teamId}/reviews/${reviewId}/assessment`;

    await page.goto(assessmentUrl);
    const firstQuestion = page.locator("article").first();
    await firstQuestion
      .getByRole("button", { name: /items complete expand/i })
      .click();
    const firstItem = firstQuestion.getByRole("checkbox").first();
    const wasChecked = await firstItem.isChecked();
    await firstItem.click();
    await expect(firstItem).toBeChecked({ checked: !wasChecked });

    await page
      .getByLabel("Breadcrumb")
      .getByRole("link", { name: "Review", exact: true })
      .click();
    await expect(page).toHaveURL(`/teams/${teamId}/reviews/${reviewId}`);

    const recentChanges = page.getByRole("table", { name: "Recent changes" });
    await expect(recentChanges.locator("tbody tr")).toHaveCount(1);
    const whoCell = recentChanges.locator("tbody tr").getByRole("cell").last();
    await expect(whoCell).toHaveText(/Heitor Lessa/);
    await expect(whoCell).not.toHaveText(/[0-9a-f]{8}-[0-9a-f-]{27,}/i);
  });
});
