import { decodeJwt, type JWTPayload } from "jose";
import { getAuthSession } from "../../utils/auth/session";
import { debugEnabled } from "../../utils/auth/debug-gate";

/**
 * Dev-only diagnostic endpoint. Returns the full sealed-cookie session
 * payload + decoded id_token claims + the raw id_token string for paste
 * into jwt.io during live verification of the OIDC contract with PE.
 *
 * Gated behind `NUXT_OIDC_AUTH_DEBUG=1` (operator opt-in). The route must
 * be deleted once the contract is settled with PE; the env var alone is
 * not enough defence — handing an id_token to a browser is a session
 * primitive exposure vector.
 *
 * Returns 401-equivalent (`authenticated: false`) when there's no session
 * cookie (the user is logged out).
 */
export default defineEventHandler(async (event) => {
  if (!debugEnabled()) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }

  const session = await getAuthSession(event);

  if (!session) {
    return {
      authenticated: false,
      hint: "No sealed session cookie. Authenticate via /auth/okta/login first, then revisit this endpoint.",
    };
  }

  let idTokenClaims: JWTPayload | { __error: string } | null = null;
  if (session.id_token) {
    try {
      // `decodeJwt` is signature-agnostic (verification is the IDP's job
      // and happens in `validateIdToken` from `okta.ts`). What's returned
      // here is the unverified payload so a human can compare against the
      // signed-claims view on jwt.io.
      idTokenClaims = decodeJwt(session.id_token);
    } catch {
      idTokenClaims = {
        __error: "decodeJwt threw — id_token may be malformed",
      };
    }
  }

  return {
    authenticated: true,
    cookie: {
      name: "peaky_auth",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
    sealed_session: {
      sub: session.sub,
      email: session.email,
      name: session.name,
      exp: session.exp,
      given_name: session.given_name,
      family_name: session.family_name,
      email_verified: session.email_verified,
      preferred_username: session.preferred_username,
      ldap_uid: session.ldap_uid,
      picture: session.picture,
      groups: session.groups,
    },
    id_token_claims: idTokenClaims,
    raw_id_token: session.id_token ?? null,
  };
});
