import { test, expect } from "./helpers/fixtures";

const REVIEW_ID = "01932b3c-7d00-7000-8000-000000002001";
const REVIEW_URL = `/teams/payments-scalability/reviews/${REVIEW_ID}`;
const ASSESSMENT_URL = `${REVIEW_URL}/assessment`;
const PLAN_URL = `${REVIEW_URL}/plan`;

test.describe("Maturity and handoff experience", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test("Assessment updates maturity inside the existing progress row", async ({
    page,
  }) => {
    await page.goto(ASSESSMENT_URL);
    const live = page.getByRole("region", {
      name: "Live maturity calculation",
    });
    await expect(live).toBeVisible({ timeout: 15_000 });
    const before = await live.textContent();

    const question = page.locator('article[id^="question-"]').first();
    await question
      .getByRole("button", { name: /items complete Expand/ })
      .click();
    const practice = question.getByRole("checkbox").first();
    if (await practice.isChecked()) await practice.uncheck();
    else await practice.check();

    await expect
      .poll(() => live.textContent(), { timeout: 250, intervals: [20] })
      .not.toBe(before);
    const progress = page.getByRole("region", { name: "Overall Progress" });
    await expect(
      progress.getByRole("region", { name: "Live maturity calculation" })
    ).toBeVisible();
    await expect(live).not.toHaveClass(/bg-primary/);

    await live
      .getByRole("button", { name: "How live maturity is calculated" })
      .click();
    const explanation = page.getByRole("dialog");
    await expect(explanation).toContainText(
      "Template authors set it. Higher severity gives a question more points."
    );
    await expect(explanation).toContainText(
      "For a checklist item, it removes only that item's points."
    );
  });

  test("Review Details clears maturity overlays and reveals checklist evidence on demand", async ({
    page,
  }) => {
    await page.goto(REVIEW_URL);
    const maturity = page.getByRole("region", { name: "Maturity estimate" });
    await expect(maturity).toBeVisible({ timeout: 15_000 });
    await expect(maturity).not.toHaveClass(/bg-primary/);
    await expect
      .poll(async () => (await maturity.boundingBox())?.height ?? 999)
      .toBeLessThan(100);

    const triggers = page.getByRole("button", { name: /About .* maturity/ });
    for (let index = 0; index < (await triggers.count()); index += 1) {
      await triggers.nth(index).hover();
      await expect(page.locator('[role="dialog"]:visible')).toHaveCount(1);
    }
    await page.mouse.move(8, 8);
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0);
    await expect(triggers.last()).not.toBeFocused();

    await page
      .getByRole("table", { name: "Pillars breakdown" })
      .locator("tbody tr")
      .first()
      .click();
    const drawer = page.getByRole("dialog", {
      name: /Reliability & Resilience maturity/,
    });
    await expect(
      drawer.getByText("How each question contributes")
    ).toBeVisible();
    const meter = drawer.getByRole("button", {
      name: /View 17 checklist items/,
    });
    await meter.click();
    const evidence = drawer.locator('[id^="question-evidence-"]:visible');
    await expect(evidence.locator("ul > li")).toHaveCount(5);
    await expect(
      evidence.getByRole("button", { name: "Show 12 more" })
    ).toBeVisible();
    await expect(drawer.getByText("Opportunity", { exact: true })).toHaveCount(
      0
    );
  });

  test("Refine groups prior handoffs and manual closing preserves local history", async ({
    page,
  }) => {
    await page.goto(PLAN_URL);
    await expect(
      page.getByRole("heading", { name: "Needs attention" })
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /Refine/ }).click();
    const refine = page.getByRole("dialog", { name: "Refine follow-ups" });
    const severities = refine.getByRole("radiogroup", {
      name: "Filter by question severity",
    });
    await expect(severities.getByRole("radio")).toHaveText([
      "All severities",
      "Medium",
    ]);
    await expect(severities.getByRole("radio", { name: "High" })).toHaveCount(
      0
    );
    await refine.getByRole("button", { name: "Done" }).click();

    await page
      .getByRole("checkbox", { name: /Add .* to handoff/ })
      .first()
      .click();
    const handoff = page.getByRole("region", { name: "Handoff" });
    await expect(
      handoff.getByRole("heading", { name: "Handoff" })
    ).toBeVisible();
    await handoff
      .getByRole("button", { name: "Link existing work item" })
      .click();
    const linkModal = page.getByRole("dialog", {
      name: "Link existing work item",
    });
    await expect(
      linkModal.getByRole("textbox", { name: "Work item URL" })
    ).toBeVisible();
    await expect(
      linkModal.getByRole("textbox", { name: /^Provider$/ })
    ).toHaveCount(0);
    await linkModal
      .getByRole("textbox", { name: "Work item URL" })
      .fill("https://gitlab.example.com/group/project/-/issues/42");
    await expect(linkModal.getByText("Detected GitLab · 42")).toBeVisible();
    await page.keyboard.press("Escape");

    await handoff.getByRole("button", { name: "Clear all" }).click();
    await expect(handoff.getByText("Select a practice to start")).toBeVisible();
    await page
      .getByRole("checkbox", { name: /Add .* to handoff/ })
      .first()
      .click();
    await expect(
      handoff.getByRole("img", { name: /selected practices cover/ })
    ).toBeVisible();
    await handoff.getByRole("button", { name: "Close handoff" }).click();

    const modal = page.getByRole("dialog", { name: "Close handoff" });
    await expect(modal).toContainText("Assessment answers do not change");
    await expect(modal.getByText("Handoff 1", { exact: true })).toHaveCount(0);
    const confirm = modal.getByRole("button", { name: "Close handoff" });
    await expect(confirm).toBeDisabled();
    await modal
      .getByRole("textbox", { name: "Closing note" })
      .fill("Demo completed before updating the assessment.");
    await confirm.click();

    await expect(
      page.getByText(/Handoff (?:1 )?(?:completed|closed) on this device/)
    ).toHaveCount(0);
    await expect(
      page.getByRole("checkbox", { name: /Add .* to handoff/ }).first()
    ).toBeVisible();
    await page.getByRole("button", { name: /Refine/ }).click();
    const historyFilter = page.getByRole("dialog", {
      name: "Refine follow-ups",
    });
    await historyFilter
      .getByRole("radio", { name: "Handed off previously" })
      .click();
    await historyFilter.getByRole("button", { name: "Done" }).click();
    const previous = page
      .getByRole("checkbox", {
        name: /Handed off previously; still needs evidence in Assessment/,
      })
      .first();
    await expect(previous).toBeVisible();
    await previous.hover();
    await expect(
      page.getByText("Handed off before · still needs evidence").first()
    ).toBeVisible();
    await page.getByText(/Handoff history · 1/).click();
    await expect(
      page.getByText("Demo completed before updating the assessment.")
    ).toBeVisible();
    await expect(
      handoff.getByRole("button", { name: "Close handoff" })
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Reopen handoff" }).click();
    await expect(
      handoff.getByRole("button", { name: "Close handoff" })
    ).toBeVisible();
  });

  test("Assessment completion automatically closes a resolved local handoff", async ({
    page,
  }) => {
    await page.goto(PLAN_URL);
    const selection = page.getByRole("checkbox", {
      name: /Add .*deployment gates tied to error budget.* to handoff/i,
    });
    await expect(selection).toBeVisible({ timeout: 15_000 });
    await selection.click();

    await page
      .getByRole("button", { name: "Question details" })
      .first()
      .click();
    await page
      .getByRole("link", { name: "Open question in assessment" })
      .click();
    await page
      .getByRole("button", {
        name: /How mature is your service reliability definition/i,
      })
      .click();
    await page
      .getByRole("checkbox", { name: /deployment gates tied to error budget/i })
      .check();
    await expect
      .poll(async () =>
        page.evaluate(async (reviewId) => {
          const result = await window.peakyDB.dumpTable(
            "local_review_handoffs",
            20
          );
          const rows = Array.isArray(result) ? result : result.rows;
          const handoff = rows.find((row) =>
            Array.isArray(row)
              ? row[1] === reviewId
              : (row as { review_id?: string }).review_id === reviewId
          );
          return Array.isArray(handoff)
            ? handoff[3]
            : (handoff as { status?: string } | undefined)?.status;
        }, REVIEW_ID)
      )
      .toBe("completed");

    await page.goto(PLAN_URL);
    await expect(
      page.getByText(
        /Handoff (?:1 )?(?:completed|closed) automatically on this device/
      )
    ).toHaveCount(0);
    await page.getByText(/Handoff history · 1/).click();
    await expect(page.getByText("Closed automatically")).toBeVisible({
      timeout: 15_000,
    });
  });
});
