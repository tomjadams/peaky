import { test } from "@playwright/test";

test.describe("Products UX Review", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/products");
    await page.waitForLoadState("domcontentloaded");
  });

  test("initial state and hydration", async ({ page }) => {
    // Screenshot initial state
    await page.screenshot({
      path: ".ux-artifacts/01-initial-state.png",
      fullPage: true,
    });

    // Check current mode
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    console.log("Initial mode:", isDark ? "dark" : "light");

    // Check header text (hydration test)
    const headerText = await page.locator("h1").first().textContent();
    console.log("Header text:", headerText);

    // Check console for hydration errors
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("Hydration") || msg.text().includes("mismatch")) {
        consoleMessages.push(msg.text());
      }
    });
  });

  test("light mode tests", async ({ page }) => {
    // Set light mode
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark")
    );
    await page.waitForTimeout(500);
    await page.screenshot({
      path: ".ux-artifacts/02-light-mode.png",
      fullPage: true,
    });

    // Check backgrounds
    const bodyBg = await page.evaluate(
      () => window.getComputedStyle(document.body).backgroundColor
    );
    console.log("Body background (light):", bodyBg);

    const mainBg = await page.evaluate(
      () =>
        window.getComputedStyle(document.querySelector("main")!).backgroundColor
    );
    console.log("Main background (light):", mainBg);

    // Check stat cards
    const cards = await page.locator('[class*="stat"], [class*="card"]').all();
    console.log("Stat cards count:", cards.length);

    for (let i = 0; i < Math.min(cards.length, 3); i++) {
      const card = cards[i];
      const text = await card.textContent();
      console.log(`Card ${i}:`, text?.slice(0, 50));
    }
  });

  test("dark mode tests", async ({ page }) => {
    // Set dark mode
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: ".ux-artifacts/03-dark-mode.png",
      fullPage: true,
    });

    // Check backgrounds
    const bodyBg = await page.evaluate(
      () => window.getComputedStyle(document.body).backgroundColor
    );
    console.log("Body background (dark):", bodyBg);

    const mainBg = await page.evaluate(
      () =>
        window.getComputedStyle(document.querySelector("main")!).backgroundColor
    );
    console.log("Main background (dark):", mainBg);

    // Check buttons visibility
    const buttons = await page.locator("button").all();
    for (let i = 0; i < Math.min(buttons.length, 3); i++) {
      const btn = buttons[i];
      const text = await btn.textContent();
      const color = await btn.evaluate(
        (el) => window.getComputedStyle(el).color
      );
      console.log(`Button ${i}: "${text?.trim()}" - color: ${color}`);
    }
  });

  test("hydration over time", async ({ page }) => {
    // Initial screenshot
    await page.screenshot({ path: ".ux-artifacts/04-hydration-initial.png" });

    // Wait 3 seconds
    await page.waitForTimeout(3000);
    await page.screenshot({ path: ".ux-artifacts/05-hydration-3s.png" });

    const header3s = await page.locator("h1").first().textContent();
    console.log("Header after 3s:", header3s);

    // Wait 5 more seconds
    await page.waitForTimeout(5000);
    await page.screenshot({ path: ".ux-artifacts/06-hydration-8s.png" });

    const header8s = await page.locator("h1").first().textContent();
    console.log("Header after 8s:", header8s);
  });

  test("empty state and navigation", async ({ page }) => {
    // Check empty state
    const hasEmptyState =
      (await page.locator("text=/No products/i").count()) > 0;
    console.log("Has empty state:", hasEmptyState);

    // Check navigation links
    const navLinks = await page.locator("nav a").all();
    console.log("Navigation links count:", navLinks.length);

    for (const link of navLinks) {
      const text = await link.textContent();
      const href = await link.getAttribute("href");
      console.log(`Nav: "${text?.trim()}" -> ${href}`);
    }
  });

  test("controls visibility in both modes", async ({ page }) => {
    // Light mode controls
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark")
    );
    await page.waitForTimeout(200);
    await page.screenshot({ path: ".ux-artifacts/07-light-controls.png" });

    const lightInputs = await page.locator("input, select").all();
    for (let i = 0; i < lightInputs.length; i++) {
      const input = lightInputs[i];
      const placeholder = await input.getAttribute("placeholder");
      const border = await input.evaluate(
        (el) => window.getComputedStyle(el).borderColor
      );
      console.log(`Light input ${i}: "${placeholder}" - border: ${border}`);
    }

    // Dark mode controls
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(200);
    await page.screenshot({ path: ".ux-artifacts/08-dark-controls.png" });

    const darkInputs = await page.locator("input, select").all();
    for (let i = 0; i < darkInputs.length; i++) {
      const input = darkInputs[i];
      const placeholder = await input.getAttribute("placeholder");
      const border = await input.evaluate(
        (el) => window.getComputedStyle(el).borderColor
      );
      console.log(`Dark input ${i}: "${placeholder}" - border: ${border}`);
    }
  });
});
