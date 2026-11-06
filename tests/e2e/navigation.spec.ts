import { test, expect, type Page } from "@playwright/test";

async function useTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  const isDark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark")
  );
  if (isDark !== (theme === "dark")) {
    await page
      .getByRole("button", {
        name: theme === "dark" ? "Switch to dark mode" : "Switch to light mode",
      })
      .click();
  }
  await expect(page.locator("html")).toHaveClass(
    theme === "dark" ? /dark/ : /light/
  );
}

test.describe("Navigation", () => {
  test("navigates to home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });

  test("navigates to templates page", async ({ page }) => {
    await page.goto("/");

    // Click on Templates link in sidebar (identified by href)
    await page.locator('.nav-sidebar a[href="/templates"]').click();
    await expect(page).toHaveURL(/\/templates/);
  });

  test("sidebar shows active state for current page", async ({ page }) => {
    await page.goto("/templates");

    // Templates link should have active class
    const templatesLink = page.locator('.nav-sidebar a[href="/templates"]');
    await expect(templatesLink).toBeVisible();
    await expect(templatesLink).toHaveClass(/--active/);
  });

  test("keeps header actions and sidebar clear at reflow widths", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(
      "/teams/payments-scalability/reviews/01932b3c-7d00-7000-8000-000000002001/assessment"
    );
    await expect(page.getByText("Progress", { exact: true })).toBeVisible();

    const header = page.locator(".header");
    const actions = [
      header.getByTestId("assessment-save"),
      header.getByRole("button", { name: "Open command palette" }),
      header.locator(".header__sync-status"),
      header.getByRole("button", { name: "Survey mode" }),
      header.locator(".header__theme-toggle"),
    ];

    for (const theme of ["light", "dark"] as const) {
      await useTheme(page, theme);
      for (const width of [1440, 1280, 720, 640]) {
        await page.setViewportSize({ width, height: 900 });

        await expect
          .poll(async () => {
            return page
              .evaluate(() => {
                const headerBox = document
                  .querySelector(".header")
                  ?.getBoundingClientRect();
                const sidebarBox = document
                  .querySelector(".nav-sidebar")
                  ?.getBoundingClientRect();
                const logoBox = document
                  .querySelector(".nav-sidebar__logo")
                  ?.getBoundingClientRect();
                if (!headerBox || !sidebarBox || !logoBox) return false;
                return (
                  Math.abs(sidebarBox.top - headerBox.bottom) <= 1 &&
                  logoBox.top >= headerBox.bottom &&
                  logoBox.top >= sidebarBox.top &&
                  logoBox.bottom <= sidebarBox.bottom
                );
              })
              .catch(() => false);
          })
          .toBe(true);

        for (const action of actions) {
          await expect(action).toBeVisible();
          const box = await action.boundingBox();
          expect(box, `${theme} ${width}px action`).not.toBeNull();
          expect(
            box!.width,
            `${theme} ${width}px action width`
          ).toBeGreaterThanOrEqual(44);
          expect(
            box!.height,
            `${theme} ${width}px action height`
          ).toBeGreaterThanOrEqual(44);
        }

        const [headerBox, actionsBox] = await Promise.all([
          header.boundingBox(),
          header.locator(".header__actions").boundingBox(),
        ]);
        expect(headerBox).not.toBeNull();
        expect(actionsBox).not.toBeNull();
        expect(actionsBox!.x).toBeGreaterThanOrEqual(headerBox!.x);
        expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(
          headerBox!.x + headerBox!.width
        );
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth + 1
          )
        ).toBe(true);
      }
    }
  });

  test("can toggle theme", async ({ page }) => {
    await page.goto("/");

    const themeToggle = page.getByRole("button", { name: /switch to/i });
    await expect(themeToggle).toBeVisible();

    await themeToggle.click();
    await expect(themeToggle).toBeVisible();
  });
});
