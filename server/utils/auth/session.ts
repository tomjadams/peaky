import type { H3Event } from "h3";
import { useSession } from "h3";
import {
  COOKIE_BUDGET_BYTES,
  enforceCookieBudget,
  sessionByteLength,
} from "./cookie-budget";

/** Sealed session payload stored in the `peaky_auth` HttpOnly cookie. */
export interface AuthSession {
  sub: string;
  email: string;
  name: string;
  exp: number;
  // Optional standard OIDC claims — see `IdTokenClaims` in `okta.ts`.
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
  preferred_username?: string;
  ldap_uid?: string;
  picture?: string;
  groups?: string[];
  /**
   * Raw OIDC ID token, server-side only. Used as `id_token_hint` on RP-initiated
   * logout (OIDC requires it for end_session_endpoint; without it Okta 400s).
   * NEVER exposed to the client bundle — `session.get.ts` filters it out, and
   * `getAuthSession` keeps it server-side only.
   *
   * **Cookie size budget:** the H3 sealed session cookie lives under the ~4 KB
   * browser per-cookie ceiling. iron-webcrypto seals with HMAC-SHA256 and adds
   * ~30% overhead, so the input JSON budget is `COOKIE_BUDGET_BYTES` (3000 B)
   * and the on-wire sealed cookie stays under the 4 KB ceiling. `id_token`
   * alone is ~700-1.5 KB depending on claim count.
   *
   * When an oversized payload arrives at `setAuthSession`, `enforceCookieBudget`
   * drops optional heavy fields in deterministic order — first `id_token`, then
   * `picture`, then `groups`, then `preferred_username` — until the budget is
   * met. Dropping `id_token` means the user falls back to local-only sign-out
   * (the Okta SSO cookie stays valid until its own expiry); that's preferred
   * over a 4 KB ERR_COOKIE_SIZE rejection.
   */
  id_token?: string;
}

const SESSION_NAME = "peaky_auth";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours in seconds

function getSessionConfig() {
  const config = useRuntimeConfig();
  return {
    name: SESSION_NAME,
    password: config.oidcSessionSecret as string,
    maxAge: SESSION_MAX_AGE,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    },
  };
}

/**
 * Reads the sealed session cookie. Returns `null` when:
 * - `NUXT_OIDC_SESSION_SECRET` is not set (graceful degradation in dev)
 * - No session cookie is present
 * - The session has expired (`exp` in the past)
 */
export async function getAuthSession(
  event: H3Event
): Promise<AuthSession | null> {
  const config = getSessionConfig();
  if (!config.password) {
    return null;
  }

  const session = await useSession<AuthSession>(event, config);
  const data = session.data;

  if (!data.sub) {
    return null;
  }

  if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
    await session.clear();
    return null;
  }

  return {
    sub: data.sub,
    email: data.email,
    name: data.name,
    exp: data.exp,
    given_name: data.given_name,
    family_name: data.family_name,
    email_verified: data.email_verified,
    preferred_username: data.preferred_username,
    ldap_uid: data.ldap_uid,
    picture: data.picture,
    groups: data.groups,
    // Server-only — kept out of the client payload returned by
    // `/api/_auth/session`.
    id_token: data.id_token,
  };
}

export async function setAuthSession(
  event: H3Event,
  authSession: AuthSession
): Promise<void> {
  // `enforceCookieBudget` is the single source of truth on cookie size: it
  // drops optional heavy fields in deterministic order until the payload
  // fits, and throws if even the required-four overflow. The persistence
  // boundary just records what was dropped, then seals.
  const { trimmed, dropped } = enforceCookieBudget(authSession);

  if (dropped.length > 0) {
    const debugEnabled = process.env.NUXT_OIDC_AUTH_DEBUG === "1";
    const inputBytes = sessionByteLength(authSession);
    console.warn(
      `[AUTH-DEBUG] session.ts:setAuthSession cookie budget exceeded; payload input was ${inputBytes} bytes (>${COOKIE_BUDGET_BYTES}); dropped ${dropped.join(", ")}, log-full=${debugEnabled}`
    );
  }
  const session = await useSession<AuthSession>(event, getSessionConfig());
  await session.update(trimmed);
}

export async function clearAuthSession(event: H3Event): Promise<void> {
  const config = getSessionConfig();
  if (!config.password) {
    return;
  }
  const session = await useSession<AuthSession>(event, config);
  await session.clear();
}
