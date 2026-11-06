import { z } from "zod";
import { clearAuthSession, getAuthSession } from "../../../utils/auth/session";

// `post_logout_redirect_uri` is where Okta lands the user AFTER the IdP
// acknowledges logout — the IdP's redirect path runs in the user's browser,
// so the URI we hand over must come from a trusted source, not from the
// request Host header. We use `NUXT_PUBLIC_BASE_URL` (already required
// per-environment for absolute client-side data URLs) rather than
// `getRequestURL(event).origin` like the auth login/callback handlers do.
const trustedRedirectOriginSchema = z
  .string()
  .url()
  .transform((raw) => {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  });

function resolveTrustedLogoutOrigin(): string | null {
  const raw = process.env.NUXT_PUBLIC_BASE_URL?.trim();
  if (!raw) return null;
  const parsed = trustedRedirectOriginSchema.safeParse(raw);
  return parsed.success ? (parsed.data ?? null) : null;
}

export default defineEventHandler(async (event) => {
  // Capture the id_token BEFORE clearing the session — Okta's
  // `end_session_endpoint` accepts it as `id_token_hint` so the IdP can
  // authenticate the logout request. Without it, Okta returns HTTP 400
  // for RP-initiated logout when `post_logout_redirect_uri` is also passed.
  // Also gate the external branch on its presence so that dev-bypass users
  // (whose session has no id_token) do not hit Okta's 400 path.
  const session = await getAuthSession(event);
  await clearAuthSession(event);

  const config = useRuntimeConfig(event);
  const logoutUrl = config.oidcOktaLogoutUrl as string;
  const trustedOrigin = resolveTrustedLogoutOrigin();

  if (logoutUrl && trustedOrigin && session?.id_token) {
    const params = new URLSearchParams({
      id_token_hint: session.id_token,
      post_logout_redirect_uri: `${trustedOrigin}/auth/login`,
    });
    return sendRedirect(event, `${logoutUrl}?${params.toString()}`, 302);
  }

  // Fall-through: local-only sign-out. The Okta SSO cookie in the user's
  // browser remains valid until Okta's own session expiry (~24h); that is
  // acceptable for Beta and avoids leaking via untrusted Host headers.
  return sendRedirect(event, "/auth/login", 302);
});
