import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/fixtures";

const SEARCH_PLACEHOLDER = "Search commands, apps, actions...";

/**
 * Helper to open command palette
 */
async function openCommandPalette(page: Page) {
  await page.waitForFunction(() => window.peakyDB?.isOpen?.() === true);
  await page.waitForTimeout(300);
  const trigger = page
    .getByRole("button", { name: /Open command palette|Quick actions/ })
    .first();
  await expect(trigger).toBeVisible();
  await expect(async () => {
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Helper to search in command palette
 */
async function searchCommand(page: Page, query: string) {
  const searchInput = page.getByPlaceholder(SEARCH_PLACEHOLDER);
  await searchInput.fill(query);
  // Wait for debounced search
  await page.waitForTimeout(200);
}

/**
 * Helper to execute a command by clicking on it
 */
async function executeCommand(page: Page, commandTitle: string | RegExp) {
  await page.getByRole("dialog").getByText(commandTitle).first().click();
}

test.describe("Command Palette - In-Page Actions", () => {
  // TODO: Teams routes don't have command palette providers yet (only /applications/ routes do)
  test.describe.skip("Team Details Page", () => {
    test.beforeEach(async ({ page, seed }) => {
      await page.goto(`/teams/${seed.team.id}`);
      await page.waitForLoadState("domcontentloaded");
    });

    test("shows 'Start new review' action", async ({ page, seed }) => {
      await openCommandPalette(page);
      await searchCommand(page, "new review");

      await expect(page.getByRole("dialog")).toContainText("Start new review");
    });

    test("shows review navigation commands", async ({ page, seed }) => {
      await openCommandPalette(page);
      // Search for part of the seeded review name
      await searchCommand(page, "Test Review");

      // Should show the review navigation
      await expect(page.getByRole("dialog")).toContainText(
        /Go to.*Test Review/i
      );
    });

    test("navigates to review when clicking review command", async ({
      page,
      seed,
    }) => {
      await openCommandPalette(page);
      await searchCommand(page, "Test Review");
      await executeCommand(page, /Go to.*Test Review/i);

      await expect(page).toHaveURL(
        new RegExp(`/teams/${seed.team.id}/reviews/${seed.review.id}`)
      );
    });
  });

  // TODO: Teams routes don't have command palette providers yet (only /applications/ routes do)
  test.describe.skip("Review Details Page", () => {
    test.beforeEach(async ({ page, seed }) => {
      await page.goto(`/teams/${seed.team.id}/reviews/${seed.review.id}`);
      await page.waitForLoadState("domcontentloaded");
    });

    test("shows 'Go to Assessment' action", async ({ page, seed }) => {
      await openCommandPalette(page);
      await searchCommand(page, "assessment");

      await expect(page.getByRole("dialog")).toContainText("Go to Assessment");
    });

    test("does NOT show pillar navigation actions (they would navigate away)", async ({
      page,
      seed,
    }) => {
      await openCommandPalette(page);
      await searchCommand(page, "reliability");

      // Should NOT show pillar navigation on review details page
      const pillarCommands = page
        .getByRole("dialog")
        .getByText(/Go to Reliability pillar/i);
      await expect(pillarCommands).toHaveCount(0);
    });

    test("does NOT show pillar navigation for any pillar", async ({
      page,
      seed,
    }) => {
      await openCommandPalette(page);
      await searchCommand(page, "security");

      const pillarCommands = page
        .getByRole("dialog")
        .getByText(/Go to Security pillar/i);
      await expect(pillarCommands).toHaveCount(0);
    });

    test("navigates to assessment when clicking 'Go to Assessment'", async ({
      page,
      seed,
    }) => {
      await openCommandPalette(page);
      await searchCommand(page, "assessment");
      await executeCommand(page, "Go to Assessment");

      await expect(page).toHaveURL(
        new RegExp(
          `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`
        )
      );
    });
  });

  test.describe("Team Review Details Page", () => {
    test.beforeEach(async ({ page, seed }) => {
      await page.goto(`/teams/${seed.team.id}/reviews/${seed.review.id}`);
      await page.waitForLoadState("domcontentloaded");
    });

    test("opens the improvement plan from the command palette", async ({
      page,
      seed,
    }) => {
      await openCommandPalette(page);
      await searchCommand(page, "improvement plan");
      await executeCommand(page, "View follow-ups");

      await expect(page).toHaveURL(
        new RegExp(`/teams/${seed.team.id}/reviews/${seed.review.id}/plan$`)
      );
      await expect(
        page.getByRole("heading", { name: "Follow-ups" }).first()
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  // TODO: Teams assessment route doesn't have command palette providers yet
  test.describe.skip("Assessment Page", () => {
    test.beforeEach(async ({ page, seed }) => {
      await page.goto(
        `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`
      );
      await page.waitForLoadState("domcontentloaded");
    });

    test("shows pillar navigation commands", async ({ page, seed }) => {
      await openCommandPalette(page);
      await searchCommand(page, "reliability");

      await expect(page.getByRole("dialog")).toContainText(
        /Go to Reliability/i
      );
    });

    test("shows all pillar navigation commands", async ({ page, seed }) => {
      await openCommandPalette(page);
      // Clear search to show all
      await searchCommand(page, "");

      // Should have pillar commands in the Page group
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Page");
    });

    test("shows 'Save progress' action", async ({ page, seed }) => {
      await openCommandPalette(page);
      await searchCommand(page, "save");

      await expect(page.getByRole("dialog")).toContainText("Save progress");
    });

    test("shows survey mode toggle action", async ({ page, seed }) => {
      await openCommandPalette(page);
      await searchCommand(page, "survey");

      await expect(page.getByRole("dialog")).toContainText(/survey mode/i);
    });

    test("enter survey mode via command palette navigates to survey page", async ({
      page,
      seed,
    }) => {
      await openCommandPalette(page);
      await searchCommand(page, "enter survey");
      await executeCommand(page, /Enter survey mode/i);

      // Should navigate to survey page
      await expect(page).toHaveURL(
        new RegExp(`/teams/${seed.team.id}/reviews/${seed.review.id}/survey`)
      );
    });

    test("pillar navigation scrolls to pillar section", async ({
      page,
      seed,
    }) => {
      await openCommandPalette(page);
      await searchCommand(page, "reliability");
      await executeCommand(page, /Go to Reliability/i);

      // Command palette should close
      await expect(page.getByRole("dialog")).not.toBeVisible();

      // Should have scrolled to the reliability pillar
      const reliabilityPillar = page.locator("#pillar-reliability");
      await expect(reliabilityPillar).toBeVisible();
    });
  });

  test.describe("Survey Page", () => {
    test.beforeEach(async ({ page, seed }) => {
      await page.goto(
        `/teams/${seed.team.id}/reviews/${seed.review.id}/survey`
      );
      await page.waitForLoadState("domcontentloaded");
    });

    // The survey route runs on the kiosk layout, which deliberately drops the
    // command palette along with the sidebar and header — it's personal nav
    // chrome that doesn't belong on a shared meeting-room monitor. "Exit
    // survey" in the page's own header is the only way out now.
    test("command palette does not open in kiosk mode", async ({ page }) => {
      await page.keyboard.press("Meta+k");
      await expect(page.getByRole("dialog")).not.toBeVisible();
    });

    test("Exit survey navigates back to the assessment page", async ({
      page,
      seed,
    }) => {
      await page.getByRole("link", { name: /exit survey/i }).click();

      // Should navigate to assessment page
      await expect(page).toHaveURL(
        new RegExp(
          `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`
        )
      );
    });
  });

  test.describe("Templates Page", () => {
    test.beforeEach(async ({ page, seed }) => {
      await page.goto("/templates");
      await page.waitForLoadState("domcontentloaded");
    });

    test("shows 'Create new template' action", async ({ page, seed }) => {
      await openCommandPalette(page);
      await searchCommand(page, "create template");

      await expect(page.getByRole("dialog")).toContainText(
        "Create new template"
      );
    });

    test("shows template navigation commands", async ({ page, seed }) => {
      await openCommandPalette(page);
      await searchCommand(page, seed.template.name);

      await expect(page.getByRole("dialog")).toContainText(
        new RegExp(
          `View ${seed.template.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          "i"
        )
      );
    });

    test("does not expose the page-level Edit draft command", async ({
      page,
    }) => {
      await openCommandPalette(page);
      await searchCommand(page, "draft");

      await expect(
        page
          .getByRole("dialog")
          .getByText("Edit draft template", { exact: true })
      ).toHaveCount(0);
    });

    test("navigates to template editor when clicking template command", async ({
      page,
      seed,
    }) => {
      await openCommandPalette(page);
      await searchCommand(page, seed.template.name);
      await executeCommand(
        page,
        new RegExp(
          `View ${seed.template.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          "i"
        )
      );

      await expect(page).toHaveURL(/\/templates\/[^/]+\/edit(?:\?mode=view)?$/);
      await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
    });

    test("navigates to new template page when clicking create", async ({
      page,
      seed,
    }) => {
      await openCommandPalette(page);
      await searchCommand(page, "create");
      await executeCommand(page, "Create new template");

      await expect(page).toHaveURL(/\/templates\/new\/edit/);
    });
  });

  test.describe("Template Editor Page", () => {
    test.beforeEach(async ({ page, seed }) => {
      await page.goto(`/templates/${seed.template.id}/edit`);
      await page.waitForLoadState("domcontentloaded");
    });

    test("shows pillar navigation commands", async ({ page, seed }) => {
      await openCommandPalette(page);
      await searchCommand(page, "reliability");

      // Template editor uses "Go to: Reliability" format
      await expect(page.getByRole("dialog")).toContainText(
        /Go to:?\s*Reliability/i
      );
    });

    test("shows 'Add question' action", async ({ page, seed }) => {
      await openCommandPalette(page);
      await searchCommand(page, "add question");

      // Template editor uses "Add new question"
      await expect(page.getByRole("dialog")).toContainText(/Add.*question/i);
    });

    test("offers Edit draft from a safe template view", async ({
      page,
      seed,
    }) => {
      await page.goto("/templates");
      const templateRow = page.locator("tbody tr", {
        hasText: seed.template.name,
      });
      await expect(templateRow).toBeVisible({ timeout: 10000 });
      await templateRow.click();
      await expect(page.getByText("Read-only", { exact: true })).toBeVisible();

      await openCommandPalette(page);
      await searchCommand(page, "draft");
      await executeCommand(page, "Edit draft template");

      await expect(
        page.getByText("Read-only", { exact: true })
      ).not.toBeVisible();
      await expect(
        page.getByRole("button", { name: "Save Draft" })
      ).toBeVisible();
    });
  });

  test.describe("Command Cleanup on Navigation", () => {
    // TODO: Teams routes don't have command palette providers yet
    // Re-enable when command palette is wired up for /teams/ routes

    test("new page commands are available immediately after navigation", async ({
      page,
      seed,
    }) => {
      // Start on home page
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Navigate to templates page
      await page.goto("/templates");
      await page.waitForLoadState("domcontentloaded");

      // Template commands should be immediately available
      await openCommandPalette(page);
      await searchCommand(page, "create template");

      await expect(page.getByRole("dialog")).toContainText(
        "Create new template"
      );
    });
  });

  test.describe("Global commands", () => {
    test("'Go to Dashboard' is available on app-shell pages", async ({
      page,
      seed,
    }) => {
      const pagesToTest = [
        "/templates",
        `/teams/${seed.team.id}`,
        `/teams/${seed.team.id}/reviews/${seed.review.id}`,
        `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`,
      ];

      for (const url of pagesToTest) {
        await page.goto(url);
        await page.waitForLoadState("domcontentloaded");

        await openCommandPalette(page);
        await searchCommand(page, "dashboard");

        await expect(page.getByRole("dialog")).toContainText(
          "Go to Teams dashboard"
        );
        await page.keyboard.press("Escape");
      }
    });

    test("'Toggle dark mode' is available on app-shell pages", async ({
      page,
      seed,
    }) => {
      const pagesToTest = ["/templates", `/teams/${seed.team.id}`];

      for (const url of pagesToTest) {
        await page.goto(url);
        await page.waitForLoadState("domcontentloaded");

        await openCommandPalette(page);
        await searchCommand(page, "dark mode");

        await expect(page.getByRole("dialog")).toContainText(
          "Toggle dark mode"
        );
        await page.keyboard.press("Escape");
      }
    });
  });
});
