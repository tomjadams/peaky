import { describe, it, expect } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils";

// Skipped: requires Okta OIDC env vars (.env) which are not yet provisioned.
// Un-skip once OKTA_CLIENT_ID / OKTA_ISSUER / OKTA_CLIENT_SECRET are configured.
describe.skip("GET /auth/okta/logout", async () => {
  await setup();

  it("redirects to /auth/login when no SLO URL is configured", async () => {
    // $fetch follows the redirect. Verify we land on the login page.
    const html = await $fetch<string>("/auth/okta/logout");
    expect(html).toContain("Sign in");
  });
});
