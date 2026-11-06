import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  vi,
  afterEach,
} from "vitest";
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
  createLocalJWKSet,
  type JSONWebKeySet,
  type JWK,
  errors as joseErrors,
} from "jose";

// vi.mock is hoisted to the top of the file; the spy reference must also be
// hoisted so the factory closure can find it. Use vi.hoisted() to share a
// stable mutable ref between the factory and the per-test body.
const { createRemoteJWKSetSpy } = vi.hoisted(() => ({
  createRemoteJWKSetSpy: vi.fn(),
}));

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createRemoteJWKSet: createRemoteJWKSetSpy,
  };
});

const { validateIdToken } =
  await import("../../../../../server/utils/auth/okta");

const CLIENT_ID = "test-client-id";
const OTHER_CLIENT_ID = "different-client-id";
const ISSUER = "https://test-issuer.adyen.com";
const OTHER_ISSUER = "https://attacker.adyen.com";
const JWKS_URL = "https://test-issuer.adyen.com/oauth2/v1/keys";

let privateKey: CryptoKey;
let publicKey: CryptoKey;
let publicJwk: JWK;
let publicJwks: JSONWebKeySet;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;
  publicJwk = await exportJWK(publicKey);
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  // The JWKS shape Jose expects
  publicJwks = { keys: [publicJwk] };
});

async function signIdToken(overrides: {
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  extra?: Record<string, unknown>;
}): Promise<string> {
  const builder = new SignJWT({
    email: "heitor.lessa@adyen.com",
    name: "Heitor Lessa",
    given_name: "Heitor",
    family_name: "Lessa",
    email_verified: true,
    preferred_username: "heitorl",
    picture: "https://photo.example/heitor.png",
    groups: ["peaky-admins"],
    ...overrides.extra,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject("00u-test-sub")
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? "1h");

  if (overrides.issuer) {
    builder.setIssuer(overrides.issuer);
  } else {
    builder.setIssuer(ISSUER);
  }
  if (overrides.audience) {
    builder.setAudience(overrides.audience);
  } else {
    builder.setAudience(CLIENT_ID);
  }
  return builder.sign(privateKey);
}

afterEach(() => {
  createRemoteJWKSetSpy.mockReset();
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.setSystemTime(1_000_000_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

describe("validateIdToken (B-3 fixture coverage)", () => {
  it("returns the canonical and extended claims of a valid ID token", async () => {
    const idToken = await signIdToken({});
    createRemoteJWKSetSpy.mockReturnValue(createLocalJWKSet(publicJwks));

    const claims = await validateIdToken(idToken, JWKS_URL, CLIENT_ID);

    expect(claims.sub).toBe("00u-test-sub");
    expect(claims.email).toBe("heitor.lessa@adyen.com");
    expect(claims.name).toBe("Heitor Lessa");
    expect(claims.given_name).toBe("Heitor");
    expect(claims.family_name).toBe("Lessa");
    expect(claims.email_verified).toBe(true);
    expect(claims.preferred_username).toBe("heitorl");
    expect(claims.picture).toBe("https://photo.example/heitor.png");
    expect(claims.groups).toEqual(["peaky-admins"]);
    expect(typeof claims.exp).toBe("number");
  });

  it("uses the JWKS endpoint the caller supplies to fetch the signing key", async () => {
    const idToken = await signIdToken({});
    createRemoteJWKSetSpy.mockImplementation((url: URL | string) => {
      // Capture the URL so we can assert the wiring surfaces the
      // configured endpoint verbatim — not a hardcoded fallback.
      const u = url instanceof URL ? url : new URL(url);
      expect(u.toString()).toBe(JWKS_URL);
      return createLocalJWKSet(publicJwks);
    });

    await validateIdToken(idToken, JWKS_URL, CLIENT_ID);

    expect(createRemoteJWKSetSpy).toHaveBeenCalledTimes(1);
    const firstCall = createRemoteJWKSetSpy.mock.calls[0] as unknown as [
      URL | string,
    ];
    expect(firstCall[0]).toBeInstanceOf(URL);
    expect((firstCall[0] as URL).toString()).toBe(JWKS_URL);
  });

  it("enforces issuer validation when expectedIssuer is supplied", async () => {
    const idToken = await signIdToken({ issuer: OTHER_ISSUER });
    createRemoteJWKSetSpy.mockReturnValue(createLocalJWKSet(publicJwks));

    await expect(
      validateIdToken(idToken, JWKS_URL, CLIENT_ID, ISSUER)
    ).rejects.toThrow();
  });

  it("passes issuer validation when expectedIssuer is omitted (defensive: caller-driven)", async () => {
    const idToken = await signIdToken({ issuer: OTHER_ISSUER });
    createRemoteJWKSetSpy.mockReturnValue(createLocalJWKSet(publicJwks));

    // No expectedIssuer → verifier does not enforce ISS, so an unexpected
    // issuer still validates. This proves the caller controls issuer policy.
    const claims = await validateIdToken(idToken, JWKS_URL, CLIENT_ID);
    expect(claims.sub).toBe("00u-test-sub");
  });

  it("rejects when the audience does not match the configured clientId", async () => {
    const idToken = await signIdToken({ audience: OTHER_CLIENT_ID });
    createRemoteJWKSetSpy.mockReturnValue(createLocalJWKSet(publicJwks));

    await expect(
      validateIdToken(idToken, JWKS_URL, CLIENT_ID)
    ).rejects.toBeInstanceOf(joseErrors.JWTClaimValidationFailed);
  });

  it("rejects an expired ID token", async () => {
    // Set expiration in the past by using a negative offset from "now"
    // Sign with a clock using setIssuedAt + a negative iat is complex —
    // we instead pre-set the issuer's clock via the JWT's exp claim
    // directly.
    const expired = await new SignJWT({
      email: "heitor.lessa@adyen.com",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("00u-test-sub")
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt(nowSeconds() - 7200)
      .setExpirationTime(nowSeconds() - 3600)
      .sign(privateKey);

    createRemoteJWKSetSpy.mockReturnValue(createLocalJWKSet(publicJwks));

    await expect(
      validateIdToken(expired, JWKS_URL, CLIENT_ID, ISSUER)
    ).rejects.toBeInstanceOf(joseErrors.JWTExpired);
  });

  it("rejects a token signed with the wrong key", async () => {
    // Build a second unrelated keypair — token signed with this one
    // must be rejected by the verifier (publicJwks above does not include it).
    const { privateKey: strangerPrivate } = await generateKeyPair("RS256", {
      extractable: true,
    });
    const strangerSigned = await new SignJWT({
      email: "attacker@adyen.com",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("00u-attacker")
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(strangerPrivate);

    createRemoteJWKSetSpy.mockReturnValue(createLocalJWKSet(publicJwks));

    await expect(
      validateIdToken(strangerSigned, JWKS_URL, CLIENT_ID, ISSUER)
    ).rejects.toBeInstanceOf(joseErrors.JWSSignatureVerificationFailed);
  });

  it("still returns claims when the ID token omits optional fields (defensive)", async () => {
    const minimal = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("00u-minimal")
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    createRemoteJWKSetSpy.mockReturnValue(createLocalJWKSet(publicJwks));

    const claims = await validateIdToken(minimal, JWKS_URL, CLIENT_ID, ISSUER);

    expect(claims.sub).toBe("00u-minimal");
    expect(claims.email).toBe("");
    expect(claims.name).toBe("");
    expect(claims.given_name).toBeUndefined();
    expect(claims.family_name).toBeUndefined();
    expect(claims.email_verified).toBeUndefined();
    expect(claims.preferred_username).toBeUndefined();
    expect(claims.picture).toBeUndefined();
    expect(claims.groups).toBeUndefined();
  });

  it("filters non-string `groups` entries — only string roles survive", async () => {
    // The Okta contract emits `groups[]` as a string[]. An IdP that ever
    // // emits non-strings must not let a poisoned entry reach our actor
    // projection (otherwise `peaky-admins` could be smuggled through a
    // malicious numeric claim).
    const poisoned = await new SignJWT({
      groups: ["peaky-admins", 42, null, "viewer", true],
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("00u-poison-groups")
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    createRemoteJWKSetSpy.mockReturnValue(createLocalJWKSet(publicJwks));

    const claims = await validateIdToken(poisoned, JWKS_URL, CLIENT_ID, ISSUER);

    expect(claims.groups).toEqual(["peaky-admins", "viewer"]);
  });
});
