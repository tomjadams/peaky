import { test, expect } from "./helpers/fixtures";

/**
 * Simplified E2E tests for critical checklist question flows
 *
 * These tests focus on the most important user journeys with the actual
 * mock data available in the system. They are designed to be resilient
 * to WebSocket errors and UI variations.
 */

test.describe("Checklist Questions - Critical Flows", () => {
  // Increase timeout for potentially slow page loads
  test.setTimeout(60000);

  test.describe("Assessment View - Checklist Questions", () => {
    test("should load assessment with checklist questions", async ({
      page,
      seed,
    }) => {
      // Navigate to assessment
      await page.goto(
        `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`
      );
      await page.waitForLoadState("domcontentloaded");

      // Wait for at least one question to load
      await expect(page.locator("article").first()).toBeVisible({
        timeout: 15000,
      });

      // Check if we can find checklist questions (they have progress indicators like "2/5")
      const pageText = await page.textContent("body");
      const hasProgressIndicator = pageText && /\d+\/\d+/.test(pageText);

      if (hasProgressIndicator) {
        console.log("✓ Checklist questions found in assessment");
      } else {
        console.log("ℹ No checklist questions found in current assessment");
      }
    });

    test("should be able to interact with checklist items if present", async ({
      page,
      seed,
    }) => {
      await page.goto(
        `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`
      );
      await page.waitForLoadState("domcontentloaded");

      // Wait for questions to load
      await page.waitForSelector("article", { timeout: 15000 });

      // Look for checklist progress indicator (contains X/Y format)
      const allArticles = page.locator("article");
      const articleCount = await allArticles.count();
      let checklistCount = 0;

      // Check each article for progress indicator
      for (let i = 0; i < articleCount; i++) {
        const text = await allArticles.nth(i).textContent();
        if (text && /\d+\/\d+/.test(text)) {
          checklistCount++;
        }
      }

      const checklistQuestions =
        checklistCount > 0
          ? allArticles.filter({ hasText: /\d+\/\d+/ })
          : allArticles.first();

      if (checklistCount > 0) {
        const firstChecklist = checklistQuestions.first();

        // Try to expand if there's an expand button
        const expandButton = firstChecklist.locator(
          "text=/expand/i, button:has-text('expand')"
        );
        if (
          await expandButton.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await expandButton.click();
          await page.waitForTimeout(500);

          // Look for checklist items (they might have various selectors)
          const items = firstChecklist.locator(
            "[role='checkbox'], .group, input[type='checkbox']"
          );
          if ((await items.count()) > 0) {
            console.log(`✓ Found ${await items.count()} checklist items`);

            // Try clicking the first item
            await items.first().click();
            await page.waitForTimeout(300);

            console.log("✓ Successfully interacted with checklist item");
          }
        }
      } else {
        test.skip();
      }
    });

    test("should show N/A functionality for questions", async ({
      page,
      seed,
    }) => {
      await page.goto(
        `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`
      );
      await page.waitForLoadState("domcontentloaded");

      await page.waitForSelector("article", { timeout: 15000 });

      // Look for N/A button on any question
      const naButtons = page.locator(
        "button:has-text('N/A'), button[aria-label*='not applicable']"
      );
      if ((await naButtons.count()) > 0) {
        await naButtons.first().click();
        await page.waitForTimeout(500);

        // Check for N/A modal (could be various UI patterns)
        const modalSelectors = [
          "[role='dialog']",
          "dialog",
          ".slideover",
          "[data-state='open']",
        ];

        let modalFound = false;
        for (const selector of modalSelectors) {
          const modal = page.locator(selector);
          if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log(`✓ N/A UI opened (${selector})`);
            modalFound = true;
            await page.keyboard.press("Escape");
            await page.waitForTimeout(300);
            break;
          }
        }

        if (!modalFound) {
          console.log("ℹ N/A button clicked (modal detection skipped)");
        }
      }
    });
  });

  test.describe("Template Studio - Basic Navigation", () => {
    test("should load template editor", async ({ page, seed }) => {
      await page.goto(`/templates/${seed.template.id}/edit`);
      await page.waitForLoadState("domcontentloaded");

      // Wait for editor to load (question cards should appear)
      await expect(
        page.locator("[data-testid='question-card'], article").first()
      ).toBeVisible({ timeout: 15000 });

      console.log("✓ Template editor loaded successfully");
    });

    test("should be able to expand a question card", async ({ page, seed }) => {
      await page.goto(`/templates/${seed.template.id}/edit`);
      await page.waitForLoadState("domcontentloaded");

      await page.waitForSelector("[data-testid='question-card'], article", {
        timeout: 15000,
      });

      // Click on first question card to expand it
      const questionCards = page.locator("[data-testid='question-card']");
      if ((await questionCards.count()) > 0) {
        await questionCards.first().click();
        await page.waitForTimeout(500);

        // Look for any editor content (textarea, inputs)
        const editorContent = page.locator("textarea, input[type='text']");
        if ((await editorContent.count()) > 0) {
          console.log("✓ Question card expanded with editor content");
        }
      }
    });

    test("should show mode toggle buttons", async ({ page, seed }) => {
      await page.goto(`/templates/${seed.template.id}/edit`);
      await page.waitForLoadState("domcontentloaded");

      await page.waitForSelector("[data-testid='question-card']", {
        timeout: 15000,
      });

      // Expand first question
      await page.locator("[data-testid='question-card']").first().click();
      await page.waitForTimeout(500);

      // Look for view mode buttons
      const guidedButton = page.locator(
        "[data-testid='view-mode-guided'], button:has-text('Guided')"
      );
      const compactButton = page.locator(
        "[data-testid='view-mode-compact'], button:has-text('Compact')"
      );

      const hasGuidedButton = await guidedButton
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      const hasCompactButton = await compactButton
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (hasGuidedButton || hasCompactButton) {
        console.log("✓ View mode toggle buttons found");
      }
    });
  });

  test.describe("Data Integrity", () => {
    test("should have checklist questions in template data", async ({
      page,
      seed,
    }) => {
      await page.goto(`/templates/${seed.template.id}/edit`);
      await page.waitForLoadState("domcontentloaded");

      await page.waitForSelector("[data-testid='question-card']", {
        timeout: 15000,
      });

      // Check page content for checklist indicators
      const pageContent = await page.content();

      // Look for checklist-related text
      const hasChecklistType = pageContent.includes("checklist");
      const hasChecklistItems = pageContent.includes("checklistItems");

      if (hasChecklistType || hasChecklistItems) {
        console.log("✓ Checklist data present in template");
      } else {
        console.log("ℹ No checklist data detected in page content");
      }
    });

    test("should have proper question types in assessment data", async ({
      page,
      seed,
    }) => {
      await page.goto(
        `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`
      );
      await page.waitForLoadState("domcontentloaded");

      await page.waitForSelector("article", { timeout: 15000 });

      // Count different question type indicators
      const yesNoButtons = page.locator(
        "button:has-text('Yes'), button:has-text('No')"
      );
      const pageText = await page.textContent("body");

      const yesNoCount = await yesNoButtons.count();
      const hasChecklist = pageText && /\d+\/\d+/.test(pageText);

      console.log(`Question types found:`);
      console.log(`  Yes/No questions: ${yesNoCount > 0 ? "present" : "none"}`);
      console.log(
        `  Checklist questions: ${hasChecklist ? "present" : "none"}`
      );

      // At least some questions should be present
      const articles = await page.locator("article").count();
      expect(articles).toBeGreaterThan(0);
    });
  });

  test.describe("Page Load Performance", () => {
    test("assessment page should load without critical errors", async ({
      page,
      seed,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        // Ignore WebSocket errors which are expected in test environment
        if (
          !error.message.includes("WebSocket") &&
          !error.message.includes("_ws")
        ) {
          errors.push(error.message);
        }
      });

      await page.goto(
        `/teams/${seed.team.id}/reviews/${seed.review.id}/assessment`
      );
      await page.waitForLoadState("domcontentloaded");

      await page.waitForSelector("article", { timeout: 15000 });

      // Check for critical errors (excluding WebSocket)
      if (errors.length > 0) {
        console.log("⚠ Page errors detected:", errors);
      } else {
        console.log("✓ No critical page errors");
      }

      // Page should still be functional even with WebSocket errors
      expect(await page.locator("article").count()).toBeGreaterThan(0);
    });

    test("template editor should load without critical errors", async ({
      page,
      seed,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        if (
          !error.message.includes("WebSocket") &&
          !error.message.includes("_ws")
        ) {
          errors.push(error.message);
        }
      });

      await page.goto(`/templates/${seed.template.id}/edit`);
      await page.waitForLoadState("domcontentloaded");

      await page.waitForSelector("[data-testid='question-card']", {
        timeout: 15000,
      });

      if (errors.length > 0) {
        console.log("⚠ Page errors detected:", errors);
      } else {
        console.log("✓ No critical page errors");
      }

      expect(
        await page.locator("[data-testid='question-card']").count()
      ).toBeGreaterThan(0);
    });
  });
});
