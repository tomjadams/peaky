import { describe, it, expect } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils";

// Skipped: requires Okta OIDC env vars (.env) which are not yet provisioned.
// Un-skip once OKTA_CLIENT_ID / OKTA_ISSUER / OKTA_CLIENT_SECRET are configured.
describe.skip("GET /auth/okta/login", async () => {
  await setup();

  it("returns 503 when OIDC is not configured", async () => {
    // Without env vars set, the route returns 503
    await expect(
      $fetch("/auth/okta/login", { redirect: "manual" })
    ).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
