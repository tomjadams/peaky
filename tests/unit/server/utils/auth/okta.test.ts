import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  generateKeyPair,
  exportJWK,
  decodeJwt,
  decodeProtectedHeader,
} from "jose";
import { buildClientAssertion } from "../../../../../server/utils/auth/okta";

const CLIENT_ID = "test-client-id";
const TOKEN_URL = "https://dev-12345.okta.com/oauth2/default/v1/token";
const FIXED_NOW = new Date("2026-05-29T10:00:00Z");
const FIXED_NOW_UNIX = Math.floor(FIXED_NOW.getTime() / 1000);

// JWK JSON string verbatim — what we paste into NUXT_OIDC_OKTA_PRIVATE_KEY from
// PE's out-of-band delivery channel. Generated at runtime by generateKeyPair
// so the test stays self-contained and hermetic.
let privateKeyJwkJson: string;
let privateKeyJwkObject: Record<string, unknown>;

beforeAll(async () => {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  const exported = await exportJWK(privateKey);
  privateKeyJwkObject = { ...exported };
  privateKeyJwkJson = JSON.stringify(exported);
});

describe("buildClientAssertion", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a valid RS256 client assertion JWT from a JWK JSON string", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

    const assertion = await buildClientAssertion(
      CLIENT_ID,
      TOKEN_URL,
      privateKeyJwkJson
    );
    const payload = decodeJwt(assertion);
    const header = decodeProtectedHeader(assertion);

    expect(header.alg).toBe("RS256");
    expect(payload.iss).toBe(CLIENT_ID);
    expect(payload.sub).toBe(CLIENT_ID);
    expect(payload.aud).toBe(TOKEN_URL);
    expect(payload.exp).toBe(FIXED_NOW_UNIX + 300); // exactly 5 minutes
    expect(payload.jti).toBeTruthy();
  });

  it("builds the same valid assertion from a parsed JsonWebKey object", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

    const assertion = await buildClientAssertion(
      CLIENT_ID,
      TOKEN_URL,
      privateKeyJwkObject
    );
    const payload = decodeJwt(assertion);

    expect(payload.iss).toBe(CLIENT_ID);
    expect(payload.aud).toBe(TOKEN_URL);
    expect(payload.exp).toBe(FIXED_NOW_UNIX + 300);
  });
});

// Real .well-known doc shape from sso.adyen.com (legacy auth server).
// Discovery must adapt to the shape PE actually provisions.
const legacyDiscoveryDoc = {
  issuer: "https://sso.adyen.com",
  authorization_endpoint: "https://sso.adyen.com/oauth2/v1/authorize",
  token_endpoint: "https://sso.adyen.com/oauth2/v1/token",
  userinfo_endpoint: "https://sso.adyen.com/oauth2/v1/userinfo",
  jwks_uri: "https://sso.adyen.com/oauth2/v1/keys",
  end_session_endpoint: "https://sso.adyen.com/oauth2/v1/logout",
};

// Alternate fixture: a Custom Authorization Server named "default".
const customAuthServerDiscoveryDoc = {
  issuer: "https://dev-12345.okta.com/oauth2/default",
  authorization_endpoint:
    "https://dev-12345.okta.com/oauth2/default/v1/authorize",
  token_endpoint: "https://dev-12345.okta.com/oauth2/default/v1/token",
  userinfo_endpoint: "https://dev-12345.okta.com/oauth2/default/v1/userinfo",
  jwks_uri: "https://dev-12345.okta.com/oauth2/default/v1/keys",
  end_session_endpoint: "https://dev-12345.okta.com/oauth2/default/v1/logout",
};

// Re-import the module per test so the module-level discovery cache
// starts empty. Without this, the second test sees the first test's
// cached result.
const loadFresh = async () => {
  vi.resetModules();
  return import("../../../../../server/utils/auth/discovery");
};

describe("discoverOktaUrls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("maps the .well-known fields onto OktaUrls", async () => {
    const { discoverOktaUrls } = await loadFresh();
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValue(legacyDiscoveryDoc));

    const urls = await discoverOktaUrls("https://sso.adyen.com");

    expect(urls.authorizationUrl).toBe(
      "https://sso.adyen.com/oauth2/v1/authorize"
    );
    expect(urls.tokenUrl).toBe("https://sso.adyen.com/oauth2/v1/token");
    expect(urls.userInfoUrl).toBe("https://sso.adyen.com/oauth2/v1/userinfo");
    expect(urls.jwksUrl).toBe("https://sso.adyen.com/oauth2/v1/keys");
    expect(urls.logoutUrl).toBe("https://sso.adyen.com/oauth2/v1/logout");
    expect(urls.issuerUrl).toBe("https://sso.adyen.com");
  });

  it("adapts to a Custom Authorization Server named 'default'", async () => {
    const { discoverOktaUrls } = await loadFresh();
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValue(customAuthServerDiscoveryDoc)
    );

    const urls = await discoverOktaUrls("https://dev-12345.okta.com");

    expect(urls.authorizationUrl).toBe(
      "https://dev-12345.okta.com/oauth2/default/v1/authorize"
    );
    expect(urls.issuerUrl).toBe("https://dev-12345.okta.com/oauth2/default");
  });

  it("strips a trailing slash from the domain when fetching", async () => {
    const { discoverOktaUrls } = await loadFresh();
    const fetchSpy = vi.fn().mockResolvedValue(legacyDiscoveryDoc);
    vi.stubGlobal("$fetch", fetchSpy);

    await discoverOktaUrls("https://sso.adyen.com/");

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://sso.adyen.com/.well-known/openid-configuration"
    );
    // Carries an AbortSignal so a slow Okta origin fails fast (security WARN-1).
    const options = fetchSpy.mock.calls[0]?.[1] as { signal?: AbortSignal };
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("caches the discovery result for repeated calls within the same process", async () => {
    const { discoverOktaUrls } = await loadFresh();
    const fetchSpy = vi.fn().mockResolvedValue(legacyDiscoveryDoc);
    vi.stubGlobal("$fetch", fetchSpy);

    await discoverOktaUrls("https://sso.adyen.com");
    await discoverOktaUrls("https://sso.adyen.com");
    await discoverOktaUrls("https://sso.adyen.com");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not cache a rejected promise (a transient failure stays retryable)", async () => {
    const { discoverOktaUrls } = await loadFresh();
    let attempts = 0;
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockImplementation(async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("ECONNRESET");
        }
        return legacyDiscoveryDoc;
      })
    );

    await expect(discoverOktaUrls("https://sso.adyen.com")).rejects.toThrow(
      /ECONNRESET/
    );

    const urls = await discoverOktaUrls("https://sso.adyen.com");
    expect(urls.issuerUrl).toBe("https://sso.adyen.com");
    expect(attempts).toBe(2);
  });

  it("throws when the discovery doc omits a required field", async () => {
    const { discoverOktaUrls } = await loadFresh();
    const incompleteDoc = { ...legacyDiscoveryDoc };
    delete (incompleteDoc as Record<string, unknown>).token_endpoint;
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValue(incompleteDoc));

    await expect(discoverOktaUrls("https://sso.adyen.com")).rejects.toThrow(
      /token_endpoint/
    );
  });
});
