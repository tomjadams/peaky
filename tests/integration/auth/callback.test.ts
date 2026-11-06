import { describe, it, expect } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils";

// Skipped: requires Okta OIDC env vars (.env) which are not yet provisioned.
// Un-skip once OKTA_CLIENT_ID / OKTA_ISSUER / OKTA_CLIENT_SECRET are configured.
describe.skip("GET /auth/okta/callback", async () => {
  await setup();

  it("returns 400 when code is missing", async () => {
    await expect(
      $fetch("/auth/okta/callback?state=some-state")
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("returns 400 when state is missing", async () => {
    await expect(
      $fetch("/auth/okta/callback?code=some-code")
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("returns 503 when OIDC is not configured (missing session secret)", async () => {
    // Without OIDC env vars configured, the callback returns 503 before
    // attempting to validate the flow cookie.
    await expect(
      $fetch("/auth/okta/callback?code=some-code&state=some-state")
    ).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
