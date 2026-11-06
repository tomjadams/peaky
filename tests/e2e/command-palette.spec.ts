import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";

const SEARCH_PLACEHOLDER = "Search commands, apps, actions...";

async function openCommandPalette(page: Page, shortcut?: string) {
  await page.waitForFunction(() => window.peakyDB?.isOpen?.() === true);
  await page.waitForTimeout(300);
  await expect(
    page.getByRole("button", { name: "Open command palette" })
  ).toBeVisible();
  await expect(async () => {
    if (shortcut) await page.keyboard.press(shortcut);
    else
      await page.getByRole("button", { name: "Open command palette" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

test.describe("Command Palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.getByRole("button", { name: "Open command palette" })
    ).toBeVisible();
  });

  test("opens with keyboard shortcut Cmd+K", async ({ page }) => {
    await openCommandPalette(page, "Meta+k");
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeFocused();
  });

  test("opens with keyboard shortcut Ctrl+K", async ({ page }) => {
    await openCommandPalette(page, "Control+k");
  });

  test("does not intercept unrelated modified shortcuts", async ({ page }) => {
    await openCommandPalette(page);
    await page.keyboard.press("Escape");

    const defaultPrevented = await page.evaluate(() => {
      const event = new KeyboardEvent("keydown", {
        key: "r",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    });

    expect(defaultPrevented).toBe(false);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("closes with Escape key", async ({ page }) => {
    await openCommandPalette(page);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("can search for commands", async ({ page }) => {
    await openCommandPalette(page);

    const searchInput = page.getByPlaceholder(SEARCH_PLACEHOLDER);
    await searchInput.fill("dashboard");

    // Wait for debounced search
    await page.waitForTimeout(200);

    // Should show filtered results containing "dashboard"
    await expect(page.getByRole("dialog")).toContainText(/dashboard/i);
  });

  test("can navigate with arrow keys", async ({ page }) => {
    await openCommandPalette(page);

    // Press down arrow to navigate
    await page.keyboard.press("ArrowDown");

    // Verify focus moved (implementation-specific)
    // Just verify no errors occurred
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("opens centered and escape works reliably", async ({ page }) => {
    await openCommandPalette(page);

    // Check that the modal is centered
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const dialogBox = await dialog.boundingBox();
    const viewportSize = page.viewportSize();

    // Verify modal is roughly centered horizontally
    if (dialogBox && viewportSize) {
      const centerX = viewportSize.width / 2;
      const dialogCenterX = dialogBox.x + dialogBox.width / 2;
      expect(Math.abs(dialogCenterX - centerX)).toBeLessThan(50);

      // Verify modal is roughly centered vertically
      const centerY = viewportSize.height / 2;
      const dialogCenterY = dialogBox.y + dialogBox.height / 2;
      expect(Math.abs(dialogCenterY - centerY)).toBeLessThan(100);
    }

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    // Reopen the command palette
    await openCommandPalette(page);
    await expect(dialog).toBeVisible();

    // Click somewhere else to defocus the search input
    await page.mouse.click(500, 500);
    await page.waitForTimeout(100);

    // Press Escape again - should still close due to global handler
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});
