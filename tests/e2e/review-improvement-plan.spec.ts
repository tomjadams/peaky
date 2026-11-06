import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/fixtures";

/**
 * End-to-end coverage for review Follow-ups. The page keeps each pinned
 * Revision separate, groups explicit misses relative to its effective result,
 * and keeps no-result fallback selection scoped to the active Revision.
 */

const DEMO_TEAM_ID = "payments-scalability";
const DEMO_REVIEW_ID = "01932b3c-7d00-7000-8000-000000002001";
const REVIEW_URL = `/teams/${DEMO_TEAM_ID}/reviews/${DEMO_REVIEW_ID}`;
const PLAN_URL = `${REVIEW_URL}/plan`;
const PRODUCT_REVIEW_URL =
  "/products/01932b3c-7d00-7000-8000-000000000001/reviews/01932b3c-7d00-7000-8000-000000003001";

async function recordFirstChecklistGap(page: Page): Promise<void> {
  const question = page.locator('article[id^="question-"]').first();
  await question.getByRole("button", { name: /items complete Expand/ }).click();
  const practice = question.getByRole("checkbox").first();
  await practice.check();
  await expect(practice).toBeChecked();
  await practice.uncheck();
  await expect(practice).not.toBeChecked();
  await page.waitForTimeout(400);
}

test.describe("Review Follow-ups", () => {
  test.setTimeout(60_000);

  test("team review details opens Follow-ups", async ({ page }) => {
    await page.goto(REVIEW_URL);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: "Maturity estimate", level: 3 })
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
  });

  test("product Review Details restores per-Revision maturity results", async ({
    page,
  }) => {
    await page.goto(PRODUCT_REVIEW_URL);
    await expect(
      page.getByRole("heading", { name: "Maturity estimate", level: 3 })
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("main")).toHaveCount(1);
  });

  test("presents pinned Revisions separately through one selector", async ({
    page,
  }) => {
    await page.goto(PLAN_URL);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible(
      { timeout: 15_000 }
    );
    await expect(page.getByText("Loading follow-ups...")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Follow-ups", level: 1 })
    ).toHaveCount(1);

    const tabs = page.getByRole("tablist", { name: "Template revision" });
    const orr = tabs.getByRole("tab", { name: /Operational Readiness Review/ });
    const soc = tabs.getByRole("tab", { name: /SOC 2/ });
    await expect(orr).toHaveAttribute("aria-selected", "true");
    const context = page.getByRole("region", { name: "Maturity estimate" });
    await expect(context).toContainText("59%");
    await expect(context).toContainText("Stage 4 · Measured");
    await expect(page.getByText(/stage groups/i)).toHaveCount(0);

    await soc.click();
    await expect(soc).toHaveAttribute("aria-selected", "true");
    await expect(context).toContainText("13%");
    await expect(context).toContainText("Stage 2 · Ad-hoc");
    await expect(page.getByText("Total Items", { exact: false })).toHaveCount(
      0
    );
  });

  test("keeps the in-page handoff available with no selected gaps", async ({
    page,
  }) => {
    await page.goto(PLAN_URL);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: "Needs attention" })
    ).toBeVisible({ timeout: 15_000 });
    const handoff = page.getByRole("region", { name: "Handoff" });
    await expect(handoff).toBeVisible();
    await expect(handoff.getByText("Select a practice to start")).toBeVisible();
    await expect(page.locator(".handoff-panel__mobile")).toHaveCount(0);
  });

  test("a recorded gap can move into the visible ordered handoff", async ({
    page,
  }) => {
    await page.goto(`${REVIEW_URL}/assessment`);
    await expect(page.getByText("Progress", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await recordFirstChecklistGap(page);

    await page.goto(PLAN_URL);
    await expect(page.getByText("Loading follow-ups...")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Needs attention" })
    ).toBeVisible();
    await expect(page.getByText("Explore maturity stages")).toHaveCount(0);

    const addToHandoff = page
      .getByRole("checkbox", { name: /Add .+ to handoff/ })
      .first();
    await addToHandoff.click();
    await expect(
      page.getByRole("checkbox", { name: /Remove .+ from handoff/ }).first()
    ).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(async (reviewId) => {
          const result = await window.peakyDB.dumpTable(
            "review_handoff_practices",
            100
          );
          const rows = Array.isArray(result) ? result : result.rows;
          return rows.filter((row) =>
            Array.isArray(row)
              ? row[1] === reviewId
              : (row as { review_id?: string }).review_id === reviewId
          ).length;
        }, DEMO_REVIEW_ID)
      )
      .toBe(1);

    const handoff = page.getByRole("region", { name: "Handoff" });
    await expect(
      handoff.getByRole("list", { name: "Selected practices" })
    ).toBeVisible();
    await expect(
      handoff.getByRole("button", { name: "Copy Markdown" })
    ).toBeVisible();

    await page.setViewportSize({ width: 320, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1
        )
      )
      .toBe(true);
    await page.getByRole("tab", { name: /Handoff 1/ }).click();
    await expect(handoff).toBeVisible();
  });

  test("question links preserve a return place from the severity queue", async ({
    page,
  }) => {
    await page.goto(`${REVIEW_URL}/assessment`);
    await expect(page.getByText("Progress", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await recordFirstChecklistGap(page);
    await page.goto(PLAN_URL);

    await page
      .getByRole("button", { name: "Question details" })
      .first()
      .click();
    await page
      .getByRole("link", { name: "Open question in assessment" })
      .click();
    await expect(page).toHaveURL(
      /\/assessment\?templateRevisionId=[^#]+#question-/,
      { timeout: 10_000 }
    );

    await page.goBack();
    await expect(page).toHaveURL(/\/plan\?[^#]*followUpQuestionId=/, {
      timeout: 10_000,
    });
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id ?? ""))
      .toMatch(/^follow-up-/);
  });
});
