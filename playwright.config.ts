import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const bypassToken =
  process.env.VERCEL_BYPASS_TOKEN || "UreV2RbflPQLR36LntkDz7TEnIkVs3rd"; // default token for dev env only

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ...(bypassToken && {
      extraHTTPHeaders: { "x-vercel-protection-bypass": bypassToken },
    }),
    // Add stability options
    launchOptions: {
      args: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
      timeout: 60000,
    },
    // Increase default timeouts
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  // Desktop only - this app doesn't support mobile/tablet
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/a11y/**"],
    },
    {
      name: "a11y",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/a11y/**",
    },
    // One-shot docs screenshot scripts — opt-in via `--project=docs`.
    // Lives outside the default `chromium` project so it doesn't run on
    // `pnpm test:e2e`. Override `testDir` so the runner finds files at
    // `scripts/docs/`.
    {
      name: "docs",
      testDir: "./scripts/docs",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});
