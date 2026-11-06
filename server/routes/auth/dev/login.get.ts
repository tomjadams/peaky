import { setAuthSession } from "../../../utils/auth/session";
import { resolveSafeRedirect } from "../../../utils/auth/safe-redirect";

/**
 * Dev-only login bypass. Sets a fake authenticated session without going
 * through Okta. Only available when NODE_ENV !== "production".
 *
 * Usage: GET /auth/dev/login
 * Optional query param: ?redirect=/some/path (defaults to /teams)
 */
export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === "production") {
    throw createError({ statusCode: 404 });
  }

  const config = useRuntimeConfig(event);

  if (!config.oidcSessionSecret) {
    throw createError({
      statusCode: 503,
      statusMessage:
        "Set NUXT_OIDC_SESSION_SECRET in your .env to use the dev login bypass",
    });
  }

  await setAuthSession(event, {
    sub: "dev-user-001",
    email: "dev@peaky.local",
    name: "Dev User",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const query = getQuery(event);
  const redirect = resolveSafeRedirect(
    query.redirect,
    getRequestURL(event).origin
  );

  return sendRedirect(event, redirect, 302);
});
