import { SignJWT, importJWK, jwtVerify, createRemoteJWKSet } from "jose";

export interface IdTokenClaims {
  sub: string;
  email: string;
  name: string;
  exp: number;
  // Standard OIDC claims surfaced when the IdP delivers them. All optional —
  // claims_supported lists these but the actual JWT payload only includes
  // them when the corresponding scope (`email`, `profile`, `groups`) was
  // requested AND the IdP's Authorization Server is configured to deliver
  // them.
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
  preferred_username?: string;
  ldap_uid?: string;
  picture?: string;
  groups?: string[];
}

/**
 * Builds a `private_key_jwt` client assertion for the Okta token endpoint.
 * Signs an RS256 JWT with claims `{ iss, sub: clientId, aud: tokenUrl, exp: now+5m, jti }`.
 * The matching public JWK must be registered in the Okta application.
 *
 * `privateKeyJwk` accepts the JWK JSON string as delivered by Platform
 * Engineering (paste verbatim — including the surrounding braces) OR a parsed
 * `JsonWebKey` object. The matching public half should be registered as a
 * public key in the Okta app's "Client authentication" settings; PE must
 * preserve the JWK's `kid` so Okta can pick the right signing key.
 */
export async function buildClientAssertion(
  clientId: string,
  tokenUrl: string,
  privateKeyJwk: string | JsonWebKey
): Promise<string> {
  // jose's `JsonWebKey` is a discriminated union over `kty` and the optional
  // `kid` doesn't appear in every variant's TypeScript shape, so we widen the
  // parsed JSON with `kid?: string` so the field is statically reachable.
  const parsedJwk =
    typeof privateKeyJwk === "string"
      ? JSON.parse(privateKeyJwk)
      : privateKeyJwk;
  const jwk = parsedJwk as JsonWebKey & { kid?: string };
  const privateKey = await importJWK(jwk, "RS256");

  // Forward the JWK's `kid` so the assertion can be matched to the correct
  // signing key during key rotation or multi-key setups in the Okta app.
  // jose's `typ` defaults to "JWT" when omitted — we leave it implicit.
  const protectedHeader: { alg: string; kid?: string } = { alg: "RS256" };
  if (typeof jwk.kid === "string" && jwk.kid.length > 0) {
    protectedHeader.kid = jwk.kid;
  }

  return new SignJWT({})
    .setProtectedHeader(protectedHeader)
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(tokenUrl)
    .setExpirationTime("5m")
    .setJti(crypto.randomUUID())
    .sign(privateKey);
}

/**
 * Verifies the Okta ID token signature via the JWKS endpoint and extracts user claims.
 * JWKS keys are cached in memory by `jose` for the process lifetime (Lambda cold starts re-fetch).
 * Pass `expectedIssuer` to enforce issuer validation — should match the issuerUrl
 * returned by `discoverOktaUrls(domain)` in `server/utils/auth/discovery.ts`.
 * Standard OIDC claims (`given_name`, `family_name`, `email_verified`,
 * `preferred_username`, `picture`, `groups`) are surfaced when present in the
 * payload — their absence is not an error.
 */
export async function validateIdToken(
  idToken: string,
  jwksUrl: string,
  clientId: string,
  expectedIssuer?: string
): Promise<IdTokenClaims> {
  const JWKS = createRemoteJWKSet(new URL(jwksUrl));
  const { payload } = await jwtVerify(idToken, JWKS, {
    audience: clientId,
    ...(expectedIssuer ? { issuer: expectedIssuer } : {}),
  });

  return {
    sub: payload.sub as string,
    email: (payload.email as string) ?? "",
    name: (payload.name as string) ?? "",
    exp: payload.exp as number,
    given_name: payload.given_name as string | undefined,
    family_name: payload.family_name as string | undefined,
    email_verified: payload.email_verified as boolean | undefined,
    preferred_username: payload.preferred_username as string | undefined,
    ldap_uid: payload.ldap_uid as string | undefined,
    picture: payload.picture as string | undefined,
    groups: Array.isArray(payload.groups)
      ? payload.groups.filter((g): g is string => typeof g === "string")
      : undefined,
  };
}
