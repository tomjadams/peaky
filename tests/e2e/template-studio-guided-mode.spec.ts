import type { Locator } from "@playwright/test";
import { test, expect } from "./helpers/fixtures";

async function expectCurrentSection(
  room: Locator,
  sectionId: string,
  heading: string
) {
  const currentWaypoints = room.locator(
    '[data-testid^="guided-waypoint-"][aria-current="step"]'
  );
  await expect(currentWaypoints).toHaveCount(1);
  await expect(
    room.getByTestId(`guided-waypoint-${sectionId}`)
  ).toHaveAttribute("aria-current", "step");
  await expect(room.getByRole("heading", { name: heading })).toBeVisible();
}

/**
 * E2E tests for Template Studio Guided Mode
 *
 * Guided mode is a full-screen "drafting room" takeover (Teleport to body,
 * closed via Escape or `[data-testid='guided-room-done']`) rather than an
 * inline wizard, so these tests open the room and close it again before
 * asserting on the underlying card. Compact mode is unchanged and still
 * renders inline.
 *
 * These tests verify that the view mode toggle persists across page reloads
 * using localStorage.
 */

test.describe("Template Studio - Guided Mode Persistence", () => {
  test.beforeEach(async ({ page, seed }) => {
    // Use seeded template that already has pillars and questions
    await page.goto(`/templates/${seed.template.id}/edit`);
    await page.waitForLoadState("networkidle");

    // Wait for question cards to be rendered
    await expect(
      page.locator("[data-testid='question-card']").first()
    ).toBeVisible();
  });

  test("should default to Guided Mode on first visit", async ({
    page,
    seed,
  }) => {
    await page.evaluate(() =>
      localStorage.removeItem("templateStudio.viewMode")
    );
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Expand a question card
    const questionCard = page.locator("[data-testid='question-card']").first();
    await questionCard
      .getByRole("button", { name: /^Expand question / })
      .click();

    // Guided remains selected, but the room opens only after an explicit action.
    await expect(page.getByTestId("guided-drafting-room")).not.toBeVisible();
    const opener = page.getByTestId("open-drafting-room");
    await opener.click();
    const room = page.getByTestId("guided-drafting-room");
    await expect(room).toBeVisible();
    await expectCurrentSection(room, "type", "Question type");

    // Verify Guided button is active via data attribute
    await expect(
      page.locator("[data-testid='view-mode-guided']")
    ).toHaveAttribute("data-active", "true");

    await page.keyboard.press("Escape");
    await expect(room).not.toBeVisible();
    await expect(opener).toBeFocused();
  });

  test("changing editor mode never dirties the template", async ({ page }) => {
    await page.evaluate(() =>
      localStorage.removeItem("templateStudio.viewMode")
    );
    await page.reload();
    await page.waitForLoadState("networkidle");

    const saveDraft = page.getByRole("button", { name: "Save Draft" });
    await expect(saveDraft).toBeDisabled();
    const questionCard = page.locator("[data-testid='question-card']").first();
    await questionCard
      .getByRole("button", { name: /^Expand question / })
      .click();
    await page.getByTestId("view-mode-compact").click();

    await expect(saveDraft).toBeDisabled();
    await expect(page.getByText("Unsaved", { exact: true })).toHaveCount(0);

    await page.getByTestId("view-mode-guided").click();
    const room = page.getByTestId("guided-drafting-room");
    await expect(room).toBeVisible();
    await expect(room.getByText("Unsaved", { exact: true })).toHaveCount(0);
    await room.getByTestId("guided-room-done").click();
    await expect(saveDraft).toBeDisabled();
  });

  test("directly edits maturity boundaries and keeps the 720px layout contained", async ({
    page,
  }) => {
    const section = page.getByTestId("maturity-section");
    const saveDraft = page.getByRole("button", { name: "Save Draft" });
    await expect(section).toBeVisible();
    await expect(saveDraft).toBeDisabled();
    await expect(section.getByRole("slider")).toHaveCount(0);

    const rangeTrigger = section.getByRole("button", {
      name: "Adjust score ranges",
    });
    await rangeTrigger.click();
    await expect(rangeTrigger).toHaveAttribute("aria-expanded", "true");
    const sliders = section.getByRole("slider");
    await expect(sliders).toHaveCount(4);
    await expect(
      section.getByText("Drag a handle. Select it to type an exact percentage.")
    ).toBeVisible();
    await expect(section.getByText(/01→02/)).toHaveCount(0);
    const spectrum = section.getByTestId("maturity-score-spectrum");
    const openSpectrumBox = await spectrum.boundingBox();
    expect(openSpectrumBox).not.toBeNull();

    const first = sliders.first();
    expect(
      await first.evaluate((element) => getComputedStyle(element).cursor)
    ).toBe("ew-resize");
    const rail = section.getByTestId("maturity-score-band-rail");
    const [firstBox, railBox] = await Promise.all([
      first.boundingBox(),
      rail.boundingBox(),
    ]);
    expect(firstBox).not.toBeNull();
    expect(railBox).not.toBeNull();
    await page.mouse.move(
      firstBox!.x + firstBox!.width / 2,
      firstBox!.y + firstBox!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      railBox!.x + railBox!.width * 0.1,
      railBox!.y + railBox!.height / 2,
      { steps: 4 }
    );

    await expect(first).not.toHaveAttribute("aria-valuenow", "5");
    const draggedBoundary = Number(await first.getAttribute("aria-valuenow"));
    await expect(section.locator("[data-stage-range]").first()).toHaveText(
      `0 to under ${draggedBoundary}%`
    );
    await expect(saveDraft).toBeDisabled();

    await page.mouse.up();
    await expect(first).toHaveAttribute("data-selected", "true");
    const [selectedSpectrumBox, thumbBox, editorBox] = await Promise.all([
      spectrum.boundingBox(),
      first.locator("[data-slider-thumb]").boundingBox(),
      section.locator("[data-stage-start-editor]").boundingBox(),
    ]);
    expect(selectedSpectrumBox).not.toBeNull();
    expect(thumbBox).not.toBeNull();
    expect(editorBox).not.toBeNull();
    expect(
      Math.abs(selectedSpectrumBox!.height - openSpectrumBox!.height)
    ).toBeLessThanOrEqual(1);
    expect(editorBox!.y - (thumbBox!.y + thumbBox!.height)).toBeLessThanOrEqual(
      12
    );
    await expect(saveDraft).toBeEnabled();
    await saveDraft.click();
    await expect(
      page.getByText("Saved locally", { exact: true })
    ).toBeVisible();
    await expect(saveDraft).toBeDisabled();

    const persistedThresholds = await page.evaluate(async () => {
      const dumped = await window.peakyDB!.dumpTable("template_revisions", 100);
      const rows = (
        Array.isArray(dumped) ? dumped : dumped.rows
      ) as unknown[][];
      return rows.flat().flatMap((cell) => {
        if (typeof cell !== "string") return [];
        try {
          const parsed = JSON.parse(cell) as { thresholds?: number[] };
          return Array.isArray(parsed.thresholds) ? [parsed.thresholds] : [];
        } catch {
          return [];
        }
      });
    });
    expect(persistedThresholds).toEqual([[draggedBoundary, 25, 50, 75]]);

    const second = sliders.nth(1);
    const secondBefore = Number(await second.getAttribute("aria-valuenow"));
    await second.focus();
    await page.keyboard.press("ArrowRight");
    await expect(second).toHaveAttribute(
      "aria-valuenow",
      String(secondBefore + 1)
    );

    const third = sliders.nth(2);
    await third.focus();
    await page.keyboard.press("Enter");
    const numericEditor = section.getByRole("spinbutton", {
      name: "Measured starts at",
    });
    await expect(numericEditor).toBeFocused();
    await numericEditor.fill("not-a-number");
    await expect(numericEditor).toHaveAttribute("aria-invalid", "true");
    await numericEditor.fill("60");
    await page.keyboard.press("Enter");
    await expect(third).toHaveAttribute("aria-valuenow", "60");

    const reset = section.getByRole("button", { name: "Use default ranges" });
    await expect(reset).toBeEnabled();
    await reset.click();
    await expect(first).toHaveAttribute("aria-valuenow", "5");
    await expect(second).toHaveAttribute("aria-valuenow", "25");
    await expect(third).toHaveAttribute("aria-valuenow", "50");
    await expect(reset).toBeDisabled();

    await page.setViewportSize({ width: 720, height: 900 });
    await expect(
      section.getByText("Ad-hoc starts at", { exact: true }).first()
    ).toBeVisible();
    await expect(section.getByRole("slider")).toHaveCount(4);
    await expect(section.getByRole("spinbutton")).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1
      )
    ).toBe(true);
  });

  test("opens Follow-up placement from a collapsed row in one action", async ({
    page,
  }) => {
    const questionCard = page.locator("[data-testid='question-card']").first();
    await expect(questionCard).toHaveAttribute("data-expanded", "false");
    const shortcut = questionCard.getByRole("button", {
      name: /Edit Follow-up placement, Stage 1 · Not implemented/,
    });

    await shortcut.click();

    let room = page.getByTestId("guided-drafting-room");
    await expect(room).toBeVisible();
    await expectCurrentSection(
      room,
      "follow-up-placement",
      "Follow-up placement"
    );
    await expect(
      room.getByRole("combobox", {
        name: "Follow-up placement for this question",
      })
    ).toBeFocused();

    await room.getByTestId("guided-nav-previous").click();
    await expectCurrentSection(room, "resources", "Resources");

    await page.keyboard.press("Escape");
    await expect(room).not.toBeVisible();
    await expect(questionCard).toHaveAttribute("data-expanded", "false");
    await expect(shortcut).toBeFocused();

    await questionCard
      .getByRole("button", { name: /^Expand question / })
      .click();
    const normalOpener = page.getByTestId("open-drafting-room");
    await normalOpener.click();
    room = page.getByTestId("guided-drafting-room");
    await expectCurrentSection(room, "type", "Question type");
    await page.keyboard.press("Escape");
    await expect(normalOpener).toBeFocused();
  });

  test("should persist Compact Mode across page reload", async ({
    page,
    seed,
  }) => {
    // Expand the question, then enter the room explicitly.
    const questionCard = page.locator("[data-testid='question-card']").first();
    await questionCard
      .getByRole("button", { name: /^Expand question / })
      .click();
    await page.getByTestId("open-drafting-room").click();
    await expect(page.getByTestId("guided-drafting-room")).toBeVisible();

    // Leave the room — the mode toggle sits behind the takeover
    await page.getByTestId("guided-room-done").click();
    await expect(page.getByTestId("guided-drafting-room")).not.toBeVisible();

    // Switch to Compact Mode
    await page.locator("[data-testid='view-mode-compact']").click();

    // Verify Compact Mode is active (inline, no room, all sections visible)
    await expect(page.getByTestId("guided-drafting-room")).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Why this matters" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Leading practices" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Resources" })
    ).toBeVisible();

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Expand the question card again
    await page
      .locator("[data-testid='question-card']")
      .first()
      .getByRole("button", { name: /^Expand question / })
      .click();

    // Verify Compact Mode persisted after reload — no room should auto-open
    await expect(page.getByTestId("guided-drafting-room")).not.toBeVisible();
    await expect(
      page.locator("[data-testid='view-mode-compact']")
    ).toHaveAttribute("data-active", "true");
  });

  test("should persist Guided Mode across page reload", async ({
    page,
    seed,
  }) => {
    const questionCard = page.locator("[data-testid='question-card']").first();
    await questionCard
      .getByRole("button", { name: /^Expand question / })
      .click();
    await page.getByTestId("open-drafting-room").click();
    await expect(page.getByTestId("guided-drafting-room")).toBeVisible();
    await page.getByTestId("guided-room-done").click();

    // Switch to Compact then back to Guided
    await page.locator("[data-testid='view-mode-compact']").click();
    await page.locator("[data-testid='view-mode-guided']").click();

    await expect(page.getByTestId("guided-drafting-room")).toBeVisible();
    await page.getByTestId("guided-room-done").click();

    await page.reload();
    await page.waitForLoadState("networkidle");

    await page
      .locator("[data-testid='question-card']")
      .first()
      .getByRole("button", { name: /^Expand question / })
      .click();
    await page.getByTestId("open-drafting-room").click();

    // Verify Guided Mode persisted and can reopen the room
    await expect(page.getByTestId("guided-drafting-room")).toBeVisible();
    await expect(
      page.locator("[data-testid='view-mode-guided']")
    ).toHaveAttribute("data-active", "true");
  });

  test("should apply mode preference to all question cards", async ({
    page,
    seed,
  }) => {
    // Expand first question, leave the room, and set to Compact
    const firstCard = page.locator("[data-testid='question-card']").first();
    await firstCard.getByRole("button", { name: /^Expand question / }).click();
    await page.getByTestId("open-drafting-room").click();
    await expect(page.getByTestId("guided-drafting-room")).toBeVisible();
    await page.getByTestId("guided-room-done").click();
    await page.locator("[data-testid='view-mode-compact']").click();

    // Collapse first question via Compact's own Done button
    await page.getByRole("button", { name: /Done/i }).click();

    // Expand second question
    const secondCard = page.locator("[data-testid='question-card']").nth(1);
    await secondCard.getByRole("button", { name: /^Expand question / }).click();

    // Verify second question also opens in Compact Mode — no room
    await expect(page.getByTestId("guided-drafting-room")).not.toBeVisible();
    await expect(
      page.locator("[data-testid='view-mode-compact']")
    ).toHaveAttribute("data-active", "true");
  });

  test("supports free navigation across sections via the rail", async ({
    page,
  }) => {
    await page
      .locator("[data-testid='question-card']")
      .first()
      .getByRole("button", { name: /^Expand question / })
      .click();
    await page.getByTestId("open-drafting-room").click();
    await expect(page.getByTestId("guided-drafting-room")).toBeVisible();
    await expect(page.getByTestId("guided-nav-skip")).toHaveCount(0);

    const room = page.getByTestId("guided-drafting-room");
    await expectCurrentSection(room, "type", "Question type");

    // Rail supports free, non-linear navigation.
    await room.getByTestId("guided-waypoint-practices").click();
    await expectCurrentSection(room, "practices", "Leading practices");

    // Next advances to Resources.
    await room.getByTestId("guided-nav-next").click();
    await expectCurrentSection(room, "resources", "Resources");

    await room.getByTestId("guided-waypoint-type").click();
    await expectCurrentSection(room, "type", "Question type");

    // Next and Previous move exactly one section in either direction.
    await room.getByTestId("guided-nav-next").click();
    await expectCurrentSection(room, "question", "Question");

    await room.getByTestId("guided-nav-previous").click();
    await expectCurrentSection(room, "type", "Question type");

    await page.getByTestId("guided-room-done").click();
  });

  test("keeps placement controls usable at 720 CSS pixels", async ({
    page,
    seed,
  }) => {
    await page.evaluate(
      async ({ questionId }) => {
        const bridge = (
          window as unknown as {
            __peakySeed: {
              updateQuestion: (
                id: string,
                updates: Record<string, unknown>
              ) => Promise<void>;
            };
          }
        ).__peakySeed;
        await bridge.updateQuestion(questionId, {
          checklistItems: [
            {
              id: "practice-incident-review",
              order: 1,
              text: "Incident reviews include security findings.",
            },
            {
              id: "practice-threat-model",
              order: 2,
              text: "Threat models are kept current.",
            },
          ],
        });
      },
      { questionId: seed.questions.checklist1.id }
    );
    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.locator('[data-pillar-slug="security"]').click();
    await expect(
      page.getByRole("heading", { name: "Security", exact: true })
    ).toBeVisible();
    await page
      .locator("[data-testid='question-card']")
      .first()
      .getByRole("button", { name: /^Expand question / })
      .click();
    await page.getByTestId("open-drafting-room").click();
    const room = page.getByTestId("guided-drafting-room");
    await expect(room).toBeVisible();
    const activePlacementWaypoint = room.getByTestId(
      "guided-waypoint-follow-up-placement"
    );
    await activePlacementWaypoint.click();
    await page.setViewportSize({ width: 720, height: 900 });
    await expect(room).toBeVisible();
    await expect
      .poll(async () => {
        const [rail, waypoint] = await Promise.all([
          room.getByTestId("guided-rail").boundingBox(),
          activePlacementWaypoint.boundingBox(),
        ]);
        return Boolean(
          rail &&
          waypoint &&
          waypoint.x >= rail.x &&
          waypoint.x + waypoint.width <= rail.x + rail.width + 1
        );
      })
      .toBe(true);
    const [railBox, waypointBox] = await Promise.all([
      room.getByTestId("guided-rail").boundingBox(),
      activePlacementWaypoint.boundingBox(),
    ]);
    expect(railBox).not.toBeNull();
    expect(waypointBox).not.toBeNull();
    expect(waypointBox!.x).toBeGreaterThanOrEqual(railBox!.x);
    expect(waypointBox!.x + waypointBox!.width).toBeLessThanOrEqual(
      railBox!.x + railBox!.width + 1
    );

    const placementRows = room.getByTestId("guided-placement-row");
    await expect(placementRows).toHaveCount(2);
    expect(
      await placementRows
        .first()
        .locator("span")
        .first()
        .evaluate((element) => element.getBoundingClientRect().width)
    ).toBeGreaterThan(300);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1
      )
    ).toBe(true);

    const placementName =
      "Follow-up placement for Incident reviews include security findings.";
    const accessibleTrigger = room.getByRole("combobox", {
      name: placementName,
    });
    await expect(accessibleTrigger).toBeVisible();
    const trigger = room.locator(`button[aria-label="${placementName}"]`);
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const option = page.getByRole("option", { name: /Stage 2 · Ad-hoc/ });
    await expect(option).toBeVisible();
    await expect(
      option.getByText(
        "Practices exist in places but depend on individual effort."
      )
    ).toBeVisible();
    expect(
      await trigger
        .locator('[data-slot="value"]')
        .evaluate((value) => value.scrollWidth <= value.clientWidth + 1)
    ).toBe(true);
    const [triggerBox, menuBox] = await Promise.all([
      trigger.boundingBox(),
      option.locator('xpath=ancestor::*[@data-slot="content"]').boundingBox(),
    ]);
    expect(triggerBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.width).toBeGreaterThan(triggerBox!.width);
    expect(
      Number(
        await option.evaluate(
          (element) =>
            getComputedStyle(element.closest('[data-slot="content"]')!).zIndex
        )
      )
    ).toBeGreaterThanOrEqual(60);

    await page.keyboard.press("Escape");
    await expect(option).not.toBeVisible();
    await expect(room).toBeVisible();
    await trigger.click();
    await option.click();
    await expect(room.getByText(/Score unchanged/)).toBeAttached();
    await expect(trigger).toBeFocused();

    const placementWaypoint = room.getByTestId(
      "guided-waypoint-follow-up-placement"
    );
    await room.getByTestId("guided-room-preview").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(placementWaypoint).toHaveAttribute("aria-current", "step");

    await placementWaypoint.focus();
    await page.keyboard.press("ArrowLeft");
    const resourcesWaypoint = room.getByTestId("guided-waypoint-resources");
    await expectCurrentSection(room, "resources", "Resources");
    await expect(resourcesWaypoint).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(room).not.toBeVisible();
    await expect(page.getByTestId("open-drafting-room")).toBeFocused();
  });

  test("Done in the room header is never blocked by validation errors", async ({
    page,
  }) => {
    // Everything autosaves and publishing has its own validation gate, so
    // the drafting room must always let the author leave — Done stays
    // enabled even while a section has a validation error.
    await page
      .locator("[data-testid='question-card']")
      .first()
      .getByRole("button", { name: /^Expand question / })
      .click();
    await page.getByTestId("open-drafting-room").click();
    const room = page.getByTestId("guided-drafting-room");
    await expect(room).toBeVisible();

    // Push the question text past its character limit to raise a
    // validation error.
    await page.getByTestId("guided-waypoint-question").click();
    const editor = room.locator('[contenteditable="true"]').first();
    await editor.fill("x".repeat(130));

    await expect(page.getByText(/validation error/i).first()).toBeVisible();
    await expect(page.getByTestId("guided-room-done")).toBeEnabled();

    await page.getByTestId("guided-room-done").click();
    await expect(room).not.toBeVisible();
  });

  test("previews the whole template without leaving the drafting room", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    const focusErrors: string[] = [];
    page.on("pageerror", (error) => {
      if (error.message.includes("focus is not a function")) {
        focusErrors.push(error.message);
      }
    });
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        message.text().includes("focus is not a function")
      ) {
        focusErrors.push(message.text());
      }
    });

    await page
      .locator("[data-testid='question-card']")
      .first()
      .getByRole("button", { name: /^Expand question / })
      .click();
    await page.getByTestId("open-drafting-room").click();
    const room = page.getByTestId("guided-drafting-room");
    await expect(room).toBeVisible();

    await room.getByTestId("guided-room-preview").click();
    const preview = page.getByRole("dialog", { name: "Template preview" });
    await expect(preview).toBeVisible();
    await expect(preview.getByText("Maturity · current draft")).toBeVisible();
    await expect(
      preview.getByText(
        "Answers are not saved. Reloading this page clears them."
      )
    ).toBeVisible();
    await expect(preview.getByRole("button", { name: "Save" })).toHaveCount(0);
    await expect(
      preview.getByRole("button", { name: "Exit preview" })
    ).toBeFocused();

    const previewNavigation = preview.getByTestId("preview-navigation");
    const previewContent = preview.getByTestId("preview-content");
    const [navigationBox, contentBox] = await Promise.all([
      previewNavigation.boundingBox(),
      previewContent.boundingBox(),
    ]);
    expect(navigationBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(navigationBox!.y + navigationBox!.height).toBeLessThanOrEqual(
      contentBox!.y + 1
    );
    expect(contentBox!.width).toBeGreaterThanOrEqual(700);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1
      )
    ).toBe(true);

    await preview.getByRole("button", { name: "How scoring works" }).click();
    await expect(
      preview.getByRole("group", { name: "Current scoring equation" })
    ).toBeVisible();
    await expect(preview.getByText("Current question mix")).toBeVisible();
    await expect(
      preview.getByText("Checklist items share question weight")
    ).toBeVisible();
    await expect(preview.getByText(/Medium × 1/)).toHaveCount(0);
    await expect(preview.getByText(/High × 2/)).toBeVisible();
    await expect(preview.getByText(/Critical × 3/)).toBeVisible();
    await expect(
      preview.getByText("Unanswered earns 0; its weight stays available")
    ).toBeVisible();
    await expect(preview.getByText("N/A · excluded, not × 0")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(preview).not.toBeVisible();
    await expect(room).toBeVisible();
    await expect(room.getByTestId("guided-room-preview")).toBeFocused();
    expect(focusErrors).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(room).not.toBeVisible();
  });

  test("previous/next chevrons navigate across questions without leaving the room", async ({
    page,
  }) => {
    // Reliability (the active pillar on load) has exactly two seeded
    // questions, so the first card is a "next only" edge and the second is
    // a "previous only" edge.
    await page
      .locator("[data-testid='question-card']")
      .first()
      .getByRole("button", { name: /^Expand question / })
      .click();
    await page.getByTestId("open-drafting-room").click();
    let room = page.getByTestId("guided-drafting-room");
    await expect(room).toBeVisible();

    await expect(page.getByTestId("guided-room-prev-question")).toBeDisabled();
    await expect(page.getByTestId("guided-room-next-question")).toBeEnabled();
    const firstQuestionLabel = await room.getAttribute("aria-label");

    await page.getByTestId("guided-room-next-question").click();
    room = page.getByTestId("guided-drafting-room");
    await expect(room).toHaveCount(1);
    await expect(room).toBeVisible();

    // The room now shows the next question's content, still full-screen.
    await expect
      .poll(() => room.getAttribute("aria-label"))
      .not.toBe(firstQuestionLabel);
    await expect(page.getByTestId("guided-room-next-question")).toBeDisabled();
    await expect(page.getByTestId("guided-room-prev-question")).toBeEnabled();

    await page.getByTestId("guided-room-prev-question").click();
    room = page.getByTestId("guided-drafting-room");
    await expect(room).toHaveCount(1);
    await expect
      .poll(() => room.getAttribute("aria-label"))
      .toBe(firstQuestionLabel);

    await page.getByTestId("guided-room-done").click();
  });
});
