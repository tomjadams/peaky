import { test } from "@playwright/test";

test.describe("Products UX Detailed Review", () => {
  test("detailed mode tests with element analysis", async ({ page }) => {
    await page.goto("/products");
    await page.waitForLoadState("domcontentloaded");

    // 1. Capture console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // 2. Check stat cards
    const statCards = await page.locator(".bg-elevated").all();
    console.log("Stat cards (bg-elevated) count:", statCards.length);

    for (let i = 0; i < statCards.length; i++) {
      const card = statCards[i];
      const bg = await card.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );
      const text = await card.textContent();
      console.log(
        `Stat card ${i}: bg=${bg}, text="${text?.trim().slice(0, 50)}"`
      );
    }

    // 3. Light mode analysis
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark")
    );
    await page.waitForTimeout(300);
    await page.screenshot({
      path: ".ux-artifacts/10-light-detailed.png",
      fullPage: true,
    });

    // Check body background in light mode
    const lightBodyBg = await page.evaluate(() => {
      const body = document.body;
      const computed = window.getComputedStyle(body);
      return {
        backgroundColor: computed.backgroundColor,
        className: body.className,
      };
    });
    console.log("Light mode body:", lightBodyBg);

    // Check input visibility
    const lightInputs = await page.locator("input").all();
    for (let i = 0; i < Math.min(lightInputs.length, 3); i++) {
      const input = lightInputs[i];
      const styles = await input.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          borderColor: computed.borderColor,
          placeholder: el.getAttribute("placeholder"),
        };
      });
      console.log(`Light input ${i}:`, styles);
    }

    // 4. Dark mode analysis
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(300);
    await page.screenshot({
      path: ".ux-artifacts/11-dark-detailed.png",
      fullPage: true,
    });

    // Check body background in dark mode
    const darkBodyBg = await page.evaluate(() => {
      const body = document.body;
      const computed = window.getComputedStyle(body);
      return {
        backgroundColor: computed.backgroundColor,
        className: body.className,
      };
    });
    console.log("Dark mode body:", darkBodyBg);

    // Check input visibility
    const darkInputs = await page.locator("input").all();
    for (let i = 0; i < Math.min(darkInputs.length, 3); i++) {
      const input = darkInputs[i];
      const styles = await input.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          borderColor: computed.borderColor,
          placeholder: el.getAttribute("placeholder"),
        };
      });
      console.log(`Dark input ${i}:`, styles);
    }

    // 5. Check sidebar in both modes
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark")
    );
    await page.waitForTimeout(200);
    const lightSidebar = await page.locator(".nav-sidebar").first();
    if ((await lightSidebar.count()) > 0) {
      const sidebarStyles = await lightSidebar.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderColor,
          color: computed.color,
        };
      });
      console.log("Light sidebar:", sidebarStyles);
    }

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(200);
    const darkSidebar = await page.locator(".nav-sidebar").first();
    if ((await darkSidebar.count()) > 0) {
      const sidebarStyles = await darkSidebar.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderColor,
          color: computed.color,
        };
      });
      console.log("Dark sidebar:", sidebarStyles);
    }

    // 6. Check buttons
    const buttons = await page.locator("button").all();
    for (let i = 0; i < Math.min(buttons.length, 5); i++) {
      const btn = buttons[i];
      const styles = await btn.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          text: el.textContent?.trim().slice(0, 30),
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          borderColor: computed.borderColor,
          disabled: el.hasAttribute("disabled"),
        };
      });
      console.log(`Button ${i}:`, styles);
    }

    // 7. Print console errors
    console.log("\n=== Console Errors ===");
    consoleErrors.forEach((err) => console.log(err));

    // 8. Check for hydration mismatch
    const hydrationIssues = consoleErrors.filter(
      (e) => e.includes("Hydration") || e.includes("mismatch")
    );
    if (hydrationIssues.length > 0) {
      console.log("\n=== HYDRATION ISSUES FOUND ===");
      hydrationIssues.forEach((i) => console.log(i));
    }
  });
});
