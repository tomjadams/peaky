import { getAuthSession } from "../../utils/auth/session";

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);

  if (!session) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const payload = {
    sub: session.sub,
    email: session.email,
    name: session.name,
    given_name: session.given_name,
    family_name: session.family_name,
    email_verified: session.email_verified,
    preferred_username: session.preferred_username,
    ldap_uid: session.ldap_uid,
    picture: session.picture,
    groups: session.groups,
    // `id_token` is intentionally EXCLUDED — server-only cookie field used
    // by `/auth/okta/logout` for `id_token_hint`. The client never needs it.
  };

  // [AUTH-DEBUG] Off by default. Set `NUXT_OIDC_AUTH_DEBUG=1` for a PE
  // round-trip — dumps the filtered session payload so you can compare
  // against the raw id_token dump in `/auth/okta/callback.get.ts` and see
  // exactly which fields the server strips before crossing the client
  // boundary. PII is the user's own.
  if (process.env.NUXT_OIDC_AUTH_DEBUG === "1") {
    console.info(
      "[AUTH-DEBUG] session payload:",
      JSON.stringify(payload, null, 2)
    );
  }

  return payload;
});
