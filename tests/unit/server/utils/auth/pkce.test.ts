import { describe, it, expect } from "vitest";
import { generatePkce } from "../../../../../server/utils/auth/pkce";

async function sha256Base64url(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  // base64url encode: replace +/ with -_ and strip = padding
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

describe("generatePkce", () => {
  it("returns a codeVerifier that is URL-safe and 43–128 chars", async () => {
    const { codeVerifier } = await generatePkce();

    expect(codeVerifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeVerifier.length).toBeLessThanOrEqual(128);
  });

  it("returns a codeChallenge that is base64url-safe and 43 chars", async () => {
    const { codeChallenge } = await generatePkce();

    // SHA-256 digest = 32 bytes → base64url-encoded = 43 chars (no padding)
    expect(codeChallenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(codeChallenge.length).toBe(43);
  });

  it("derives codeChallenge from SHA-256 of codeVerifier", async () => {
    const { codeVerifier, codeChallenge } = await generatePkce();
    const computed = await sha256Base64url(codeVerifier);
    expect(codeChallenge).toBe(computed);
  });

  it("generates different verifiers on each call", async () => {
    const a = await generatePkce();
    const b = await generatePkce();

    expect(a.codeVerifier).not.toBe(b.codeVerifier);
    expect(a.codeChallenge).not.toBe(b.codeChallenge);
  });
});
