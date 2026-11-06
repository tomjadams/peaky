import { z } from "zod";
import { decodeJwt } from "jose";
import { getOktaUrls } from "../../../utils/auth/discovery";
import {
  buildClientAssertion,
  validateIdToken,
} from "../../../utils/auth/okta";
import { setAuthSession } from "../../../utils/auth/session";
import { useFlowSession } from "../../../utils/auth/flow";
import { resolveSafeRedirect } from "../../../utils/auth/safe-redirect";

const callbackQuerySchema = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(128),
});

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const {
    oidcOktaDomain,
    oidcOktaClientId,
    oidcOktaPrivateKey,
    oidcSessionSecret,
  } = config;

  const queryResult = await getValidatedQuery(
    event,
    callbackQuerySchema.safeParse.bind(callbackQuerySchema)
  );
  if (!queryResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing required query parameters",
    });
  }

  const { code, state: stateParam } = queryResult.data;

  if (
    !oidcSessionSecret ||
    !oidcOktaDomain ||
    !oidcOktaClientId ||
    !oidcOktaPrivateKey
  ) {
    throw createError({
      statusCode: 503,
      statusMessage: "OIDC not configured",
    });
  }

  const flowSession = await useFlowSession(event, oidcSessionSecret as string);
  const { codeVerifier, state: storedState, redirect } = flowSession.data;

  if (!codeVerifier || !storedState) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing flow state — please restart login",
    });
  }

  if (stateParam !== storedState) {
    throw createError({
      statusCode: 400,
      statusMessage: "State mismatch — possible CSRF attempt",
    });
  }

  await flowSession.clear();

  let urls: Awaited<ReturnType<typeof getOktaUrls>>;
  try {
    urls = await getOktaUrls(oidcOktaDomain as string);
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "OIDC discovery failed",
    });
  }
  const { tokenUrl, jwksUrl, issuerUrl } = urls;
  // Must match the `redirect_uri` sent during login — derive from request origin.
  const origin = getRequestURL(event).origin;
  const redirectUri = `${origin}/auth/okta/callback`;

  const clientAssertion = await buildClientAssertion(
    oidcOktaClientId as string,
    tokenUrl,
    oidcOktaPrivateKey as string
  );

  let tokenResponse: { id_token: string };
  try {
    tokenResponse = await $fetch<{ id_token: string }>(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        client_id: oidcOktaClientId as string,
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: clientAssertion,
      }).toString(),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Token exchange failed",
    });
  }

  if (!tokenResponse.id_token) {
    throw createError({
      statusCode: 502,
      statusMessage: "No ID token in response",
    });
  }

  // [AUTH-DEBUG] Off by default. Set `NUXT_OIDC_AUTH_DEBUG=1` for a PE
  // round-trip — dumps the decoded ID token payload before `validateIdToken`
  // validates the signature. `decodeJwt` is signature-agnostic, so PII here
  // is the user's own; the ID token itself is not a secret (anyone who
  // completes the OAuth flow can decode it).
  if (process.env.NUXT_OIDC_AUTH_DEBUG === "1") {
    console.info(
      "[AUTH-DEBUG] raw id_token claims:",
      JSON.stringify(decodeJwt(tokenResponse.id_token), null, 2)
    );
  }

  let claims: Awaited<ReturnType<typeof validateIdToken>>;
  try {
    claims = await validateIdToken(
      tokenResponse.id_token,
      jwksUrl,
      oidcOktaClientId as string,
      issuerUrl
    );
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "ID token validation failed",
    });
  }

  await setAuthSession(event, {
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    exp: claims.exp,
    given_name: claims.given_name,
    family_name: claims.family_name,
    email_verified: claims.email_verified,
    preferred_username: claims.preferred_username,
    ldap_uid: claims.ldap_uid,
    picture: claims.picture,
    groups: claims.groups,
    // Server-only — referenced by /auth/okta/logout to send `id_token_hint`
    // to Okta's end_session_endpoint (RFC: RECOMMENDED; PE's app rejects
    // unsigned RP-initiated logout with HTTP 400).
    id_token: tokenResponse.id_token,
  });

  return sendRedirect(event, resolveSafeRedirect(redirect, origin), 302);
});
