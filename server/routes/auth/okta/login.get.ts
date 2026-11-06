import { generatePkce } from "../../../utils/auth/pkce";
import { getOktaUrls } from "../../../utils/auth/discovery";
import { useFlowSession } from "../../../utils/auth/flow";
import { resolveSafeRedirect } from "../../../utils/auth/safe-redirect";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const {
    oidcOktaDomain,
    oidcOktaClientId,
    oidcOktaPrivateKey,
    oidcSessionSecret,
  } = config;

  if (
    !oidcOktaDomain ||
    !oidcOktaClientId ||
    !oidcOktaPrivateKey ||
    !oidcSessionSecret
  ) {
    throw createError({
      statusCode: 503,
      statusMessage: "OIDC not configured",
      message: "OIDC not configured",
    });
  }

  const origin = getRequestURL(event).origin;
  const query = getQuery(event);
  const redirect = resolveSafeRedirect(query.redirect, origin);

  const { codeVerifier, codeChallenge } = await generatePkce();
  const state = crypto.randomUUID();

  const flowSession = await useFlowSession(event, oidcSessionSecret as string);
  await flowSession.update({ codeVerifier, state, redirect });

  let urls: Awaited<ReturnType<typeof getOktaUrls>>;
  try {
    urls = await getOktaUrls(oidcOktaDomain as string);
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "OIDC discovery failed",
    });
  }
  const { authorizationUrl } = urls;
  // OAuth `redirect_uri` matches the URL the browser actually used to reach us,
  // so Vercel previews, prod, and local dev all work without per-env config.
  const redirectUri = `${origin}/auth/okta/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: oidcOktaClientId as string,
    redirect_uri: redirectUri,
    // `groups` enables the IdP's group claim on the ID token — required for
    // the `useCurrentActor` admin projection. PE must grant the scope on the
    // Authorization Server — without it, every actor projects to `["member"]`.
    scope: "openid email profile groups",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return sendRedirect(event, `${authorizationUrl}?${params.toString()}`, 302);
});
