import { test, expect } from "./helpers/fixtures";
import { seedReview } from "./helpers/seed";
import { selectTemplateInWizard } from "./helpers/ui";

const ORR_PUBLISHED_REVISION_ID = "01932b3c-7d00-7000-8100-000000001001";
const ORR_PUBLISHED_NAME = "Operational Readiness Review (ORR)";
const MULTI_REVISION_REVIEW_ID = "01932b3c-7d00-7000-8000-000000002001";
const SOC2_PUBLISHED_REVISION_ID = "01932b3c-7d00-7000-8100-000000001004";
const SOC2_QUESTION_ID = "01932b3c-7d00-7000-8100-000000001004:question:01:01";

test.describe("Teams flow", () => {
  test("teams dashboard loads and seeded team is searchable", async ({
    page,
    seed,
  }) => {
    await page.goto("/teams");

    await expect(
      page.getByRole("heading", { name: /teams dashboard/i })
    ).toBeVisible();
    await expect(
      page.getByRole("table", { name: /teams table/i })
    ).toBeVisible();

    const searchInput = page.getByPlaceholder("Search teams...");
    await searchInput.fill(seed.team.name);

    await expect(
      page.getByRole("link", { name: seed.team.name })
    ).toBeVisible();
  });

  test("clicking team link opens team details", async ({ page, seed }) => {
    await page.goto("/teams");

    const searchInput = page.getByPlaceholder("Search teams...");
    await searchInput.fill(seed.team.name);

    await page.getByRole("link", { name: seed.team.name }).click();

    await expect(page).toHaveURL(new RegExp(`/teams/${seed.team.id}$`));
    await expect(
      page.getByRole("link", { name: /start new review/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /follow-ups/i }).first()
    ).toBeVisible();
  });

  test("team details use local reviews when the remote API is unavailable", async ({
    page,
    seed,
  }) => {
    await page.route(`**/api/teams/${seed.team.id}/reviews**`, (route) =>
      route.abort("connectionfailed")
    );

    await page.goto(`/teams/${seed.team.id}`);

    await expect(
      page.getByRole("heading", { name: seed.team.name, level: 2 })
    ).toBeVisible();
    await expect(page.getByText("Failed to load team details")).toHaveCount(0);
    await expect(page.getByText(seed.review.name)).toBeVisible();
  });

  test("catalog-only and unknown team routes fail closed identically", async ({
    page,
  }) => {
    const expectedDescription =
      "This team is unavailable or you do not have access. Diagnostic: TEAM_NOT_FOUND.";

    for (const teamId of ["resilience-taskforce", "e2e-missing-team"]) {
      await page.goto(`/teams/${teamId}`);

      await expect(page.getByText("Failed to load team details")).toBeVisible();
      await expect(page.getByText(expectedDescription)).toBeVisible();
    }
  });

  test("team follow-ups keep each Review Revision result separate", async ({
    page,
  }) => {
    await page.goto("/teams/payments-scalability/plan");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: "Follow-ups" }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Contributor factors" })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("product-plan-rollups")).toBeVisible({
      timeout: 10_000,
    });

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
        `/teams/payments-scalability/reviews/${MULTI_REVISION_REVIEW_ID}/plan\\?templateRevisionId=`
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
    await expect(page.locator(".team-plan__main")).not.toContainText(
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
              .locator(".team-plan")
              .evaluate(
                (element) => element.scrollWidth <= element.clientWidth + 1
              )
          )
          .toBe(true);
      }
    }
  });

  test("assessment preserves the requested Revision when the sidebar loads first", async ({
    page,
  }) => {
    await page.route(
      `**/api/reviews/${MULTI_REVISION_REVIEW_ID}/workspace`,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 750));
        await route.continue();
      }
    );
    await page.goto(
      `/teams/payments-scalability/reviews/${MULTI_REVISION_REVIEW_ID}/assessment?templateRevisionId=${SOC2_PUBLISHED_REVISION_ID}`
    );

    const selector = page.getByRole("complementary", {
      name: "Template navigation",
    });
    await expect(
      selector.getByRole("button", { name: /SOC 2.*v1/i })
    ).toBeVisible();
    await expect(
      page.getByText(
        "Are privileged access paths protected with MFA and quarterly review?"
      )
    ).toBeVisible();
    await selector
      .getByRole("button", { name: /Operational Readiness Review/ })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`templateRevisionId=${ORR_PUBLISHED_REVISION_ID}`)
    );
    await expect(
      selector.getByRole("button", {
        name: /Operational Readiness Review \(ORR\).*v1/i,
      })
    ).toBeVisible();

    await page.goto(
      `/teams/payments-scalability/reviews/${MULTI_REVISION_REVIEW_ID}/assessment?templateRevisionId=${ORR_PUBLISHED_REVISION_ID}#question-${SOC2_QUESTION_ID}`
    );
    await expect(page).toHaveURL(
      new RegExp(`templateRevisionId=${SOC2_PUBLISHED_REVISION_ID}`)
    );
    const soc2Question = page.locator(`[id="question-${SOC2_QUESTION_ID}"]`);
    await expect(
      page.getByText(
        "Are privileged access paths protected with MFA and quarterly review?"
      )
    ).toBeVisible();
    await expect(soc2Question).toBeFocused();

    await page.goBack();
    await expect(page).toHaveURL(
      new RegExp(`templateRevisionId=${ORR_PUBLISHED_REVISION_ID}$`)
    );
    await expect(
      selector.getByRole("button", {
        name: /Operational Readiness Review \(ORR\).*v1/i,
      })
    ).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(
      new RegExp(
        `templateRevisionId=${SOC2_PUBLISHED_REVISION_ID}#question-${SOC2_QUESTION_ID}$`
      )
    );
    await expect(soc2Question).toBeFocused();
  });

  test("new Team Review wizard preserves exact Revision and application state", async ({
    page,
  }) => {
    const teamId = "payments-scalability";
    const reviewName = `[E2E] Wizard Review ${Date.now()}`;

    await page.goto(`/teams/${teamId}/reviews/new`);
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    const breadcrumbs = page.getByLabel("Breadcrumb");
    await expect(
      breadcrumbs.getByRole("link", { name: "Teams", exact: true })
    ).toBeVisible();
    await expect(
      breadcrumbs.getByRole("link", {
        name: "Payments Scalability",
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.getByText("New Review", { exact: true }).first()
    ).toBeVisible();

    const revisionCard = page.getByTestId(
      `template-card-${ORR_PUBLISHED_REVISION_ID}`
    );
    await expect(revisionCard).toBeVisible();
    await expect(revisionCard.getByText(ORR_PUBLISHED_NAME)).toBeVisible();
    await expect(revisionCard.getByText("v1", { exact: true })).toBeVisible();
    await expect(revisionCard.getByText(/\d+ pillars/)).toBeVisible();
    await expect(revisionCard.getByText(/\d+ questions/)).toBeVisible();
    await revisionCard.click();
    await page.getByTestId("wizard-next").click();

    await expect(page.getByTestId("wizard-step-2")).toBeVisible();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await expect(
      page.getByText(/covers only the team or a selected set of applications/i)
    ).toBeVisible();
    const teamOnly = page.getByRole("button", { name: /Team only/ });
    const selectedApps = page.getByRole("button", { name: /Selected apps/ });
    await expect(teamOnly).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByPlaceholder("Search applications...")).toBeHidden();

    await selectedApps.click();
    await expect(selectedApps).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("wizard-next").click();
    await expect(page.getByTestId("wizard-step-2")).toBeVisible();
    await expect(
      page.getByText(/Select at least one application for selected-app scope/i)
    ).toBeVisible();

    const firstApplication = page
      .getByRole("button", {
        name: /Link this application to track readiness outcomes/,
      })
      .first();
    await expect(firstApplication).toBeVisible();
    await expect(firstApplication).toHaveAttribute("aria-pressed", "false");
    await firstApplication.click();
    await expect(firstApplication).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Back" }).click();

    await expect(revisionCard).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("wizard-next").click();
    await expect(selectedApps).toHaveAttribute("aria-pressed", "true");
    await expect(firstApplication).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("wizard-skip").click();

    await expect(page.getByTestId("wizard-step-3")).toBeVisible();
    await expect(page.getByText("Step 3 of 3")).toBeVisible();
    await expect(page.getByText(ORR_PUBLISHED_NAME)).toBeVisible();
    await expect(page.getByText("v1", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Team-scoped — covers the team as a whole.")
    ).toBeVisible();
    await expect(page.getByTestId("wizard-create")).toBeDisabled();
    await page.getByRole("textbox", { name: "Review Name" }).fill(reviewName);
    await page.getByTestId("wizard-create").click();

    await page.waitForURL(
      new RegExp(`/teams/${teamId}/reviews/[^/]+/assessment$`),
      { timeout: 15_000 }
    );
    await expect(
      page.getByText("Review created", { exact: true })
    ).toBeVisible();
  });

  test("Team Review wizard Cancel returns to Team Details without creating", async ({
    page,
  }) => {
    await page.goto("/teams/payments-scalability/reviews/new");
    await expect(page.getByTestId("wizard-step-1")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page).toHaveURL("/teams/payments-scalability");
  });

  test("selecting a catalog team materializes an empty local team page", async ({
    page,
  }) => {
    const catalogTeamId = "resilience-taskforce";

    await page.goto("/teams");
    await expect(
      page.getByRole("table", { name: "Teams table" })
    ).toBeVisible();
    await page.getByRole("button", { name: "New Team Review" }).click();
    await page.waitForURL("/teams/reviews/new");
    await page.getByPlaceholder("Search teams...").fill(catalogTeamId);
    await page.getByRole("radio", { name: new RegExp(catalogTeamId) }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(`/teams/${catalogTeamId}/reviews/new`);

    await page.goto(`/teams/${catalogTeamId}`);
    await expect(page.getByText("Failed to load team details")).toHaveCount(0);
    await expect(page.getByText("No reviews yet")).toBeVisible();
  });

  test("global wizard creates a local profile before opening a catalog team", async ({
    page,
    seed,
  }) => {
    const catalogTeamId = "resilience-taskforce";
    const reviewName = `[E2E] Resilience Review ${Date.now()}`;

    await page.goto("/teams");
    await expect(
      page.getByRole("table", { name: "Teams table" })
    ).toBeVisible();
    await page.getByRole("button", { name: "New Team Review" }).click();
    await page.waitForURL("/teams/reviews/new");
    await page.getByPlaceholder("Search teams...").fill(catalogTeamId);
    await page.getByRole("radio", { name: new RegExp(catalogTeamId) }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.waitForURL(`/teams/${catalogTeamId}/reviews/new`);
    await selectTemplateInWizard(page, seed.template);
    await page.getByTestId("wizard-next").click();
    await page.getByTestId("wizard-skip").click();
    await page.getByRole("textbox").first().fill(reviewName);
    await page.getByTestId("wizard-create").click();

    await page.waitForURL(
      new RegExp(`/teams/${catalogTeamId}/reviews/[^/]+/assessment$`),
      { timeout: 15_000 }
    );
    await page
      .getByRole("link", { name: "Resilience Taskforce", exact: true })
      .click();

    await expect(page).toHaveURL(`/teams/${catalogTeamId}`);
    await expect(page.getByText("Failed to load team details")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: catalogTeamId, level: 2 })
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: reviewName })
    ).toBeVisible();
  });

  test("team appears in dashboard after creating review for catalog team with no prior local profile", async ({
    page,
    seed,
  }) => {
    // resilience-taskforce is a catalog group that has no entry in the local DB
    // until a review is created for it. This test covers the critical regression:
    // the team must be visible on the teams dashboard immediately afterward.
    const catalogTeamId = "resilience-taskforce";
    const reviewName = `[E2E] Catalog Team Review ${Date.now()}`;

    // Select the catalog Team through the global wizard so its local profile is
    // materialized before entering the Team-specific Review wizard.
    await page.goto("/teams");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "New Team Review" }).click();
    await page.waitForURL("/teams/reviews/new");
    await page.getByPlaceholder("Search teams...").fill(catalogTeamId);
    await page.getByRole("radio", { name: new RegExp(catalogTeamId) }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(`/teams/${catalogTeamId}/reviews/new`);

    // Step 1: Select template
    await selectTemplateInWizard(page, seed.template);
    await expect(page.getByTestId("wizard-next")).toBeEnabled();
    await page.getByTestId("wizard-next").click();

    // Step 2: Skip applications
    await expect(page.getByTestId("wizard-step-2")).toBeVisible();
    await page.getByTestId("wizard-skip").click();

    // Step 3: Name and create
    await expect(page.getByTestId("wizard-step-3")).toBeVisible();
    await page.getByRole("textbox").first().fill(reviewName);
    await page.getByTestId("wizard-create").click();

    // Wait for navigation to assessment
    await page.waitForURL(
      new RegExp(`/teams/${catalogTeamId}/reviews/[^/]+/assessment$`),
      { timeout: 15_000 }
    );

    // Navigate back to the teams dashboard
    await page.goto("/teams");
    await page.waitForLoadState("domcontentloaded");

    // The catalog team must now be visible (local profile was created by the wizard)
    const searchInput = page.getByPlaceholder("Search teams...");
    await searchInput.fill("resilience-taskforce");

    await expect(
      page.getByRole("link", { name: /resilience-taskforce/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test("review details route loads under teams", async ({ page, seed }) => {
    await page.goto(`/teams/${seed.team.id}/reviews/${seed.review.id}`);

    await expect(page).toHaveURL(
      new RegExp(`/teams/${seed.team.id}/reviews/${seed.review.id}$`)
    );
    await expect(
      page.getByRole("button", { name: /continue assessment/i })
    ).toBeVisible();
  });

  test("team review lifecycle supports archive, restore, and permanent delete", async ({
    page,
    seed,
  }) => {
    const reviewName = `[E2E] Lifecycle Review ${Date.now()}`;

    // Create a dedicated review for lifecycle testing via mutation
    await seedReview(page, {
      name: reviewName,
      subjectId: seed.team.id,
      subjectType: "team",
      templateRevisionIds: [seed.template.publishedRevisionId],
    });
    await page.reload();

    // Go to team details
    await page.goto(`/teams/${seed.team.id}`);

    const reviewRow = page.getByRole("row").filter({ hasText: reviewName });
    await expect(reviewRow).toBeVisible();

    // Archive
    await reviewRow.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    const archiveDialog = page.getByRole("dialog");
    await expect(archiveDialog).toContainText(`Archive ${reviewName}?`);
    await archiveDialog
      .getByRole("button", { name: /archive review/i })
      .click();
    await expect(
      page.getByText("Review archived", { exact: true })
    ).toBeVisible();

    // Switch to archived tab
    await page.getByRole("button", { name: /archived \(1\)/i }).click();
    const archivedRow = page.getByRole("row").filter({ hasText: reviewName });
    await expect(archivedRow).toBeVisible();

    // Restore
    await archivedRow.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Restore" }).click();
    await expect(
      page.getByText("Review restored", { exact: true })
    ).toBeVisible();

    // Archive again for permanent delete
    await page
      .getByRole("button", { name: /active/i })
      .first()
      .click();
    const restoredRow = page.getByRole("row").filter({ hasText: reviewName });
    await restoredRow.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /archive review/i })
      .click();
    await expect(
      page.getByText("Review archived", { exact: true })
    ).toBeVisible();

    // Permanent delete
    await page.getByRole("button", { name: /archived \(1\)/i }).click();
    const rowToDelete = page.getByRole("row").filter({ hasText: reviewName });
    await rowToDelete.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const deleteDialog = page.getByRole("dialog");
    await expect(deleteDialog).toContainText(
      `Delete ${reviewName} permanently?`
    );
    await deleteDialog.getByRole("textbox").fill(reviewName);
    await deleteDialog
      .getByRole("button", { name: /delete permanently/i })
      .click();

    await expect(
      page.getByText("Review deleted permanently", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: reviewName })
    ).toHaveCount(0);
  });
});
