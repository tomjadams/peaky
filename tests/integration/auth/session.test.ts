import { describe, it, expect } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils";

// Skipped: requires Okta OIDC env vars (.env) which are not yet provisioned.
// Un-skip once OKTA_CLIENT_ID / OKTA_ISSUER / OKTA_CLIENT_SECRET are configured.
describe.skip("GET /api/_auth/session", async () => {
  await setup();

  it("returns 401 when no session exists", async () => {
    await expect($fetch("/api/_auth/session")).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
