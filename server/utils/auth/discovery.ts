export interface OktaUrls {
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  jwksUrl: string;
  logoutUrl: string;
  issuerUrl: string;
}

// Per-domain memoized OIDC discovery. The discovery document is static for
// an Okta org's lifetime, so we fetch once per cold-start. Concurrent first
// callers all receive the same in-flight Promise — no endpoint stampede.
const discoveryCache = new Map<string, Promise<OktaUrls>>();

/**
 * Fetches `${domain}/.well-known/openid-configuration` and maps it to the URL
 * set our OIDC handlers need. Adapts to whichever authorization server the
 * Okta org actually exposes — the legacy one at `/oauth2/v1/...` and a Custom
 * Authorization Server named "default" at `/oauth2/default/v1/...` both work.
 *
 * Returns a Promise so callers must `await`. The first call per domain hits
 * the network; subsequent calls within the same process resolve from cache.
 *
 * @throws if the discovery endpoint is unreachable, returns a non-object
 * response, or omits any of the required fields.
 */
export async function discoverOktaUrls(domain: string): Promise<OktaUrls> {
  const cached = discoveryCache.get(domain);
  if (cached) return cached;

  const promise = (async () => {
    const base = domain.replace(/\/$/, "");
    const discoveryUrl = `${base}/.well-known/openid-configuration`;

    let doc: Record<string, unknown>;
    try {
      // Cap the discovery fetch so a slow Okta origin doesn't stall Nitro's
      // event loop until Vercel's 26 s platform timeout. 5 s covers any
      // healthy cache-miss; longer indicates a real outage and we want to
      // fail fast so the `/auth/okta/login` route returns 503 quickly.
      doc = await $fetch<Record<string, unknown>>(discoveryUrl, {
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      throw new Error(
        `OIDC discovery at ${discoveryUrl} failed: ${(error as Error).message ?? "unknown error"}`,
        { cause: error }
      );
    }

    const requiredFields = {
      issuerUrl: "issuer",
      authorizationUrl: "authorization_endpoint",
      tokenUrl: "token_endpoint",
      userInfoUrl: "userinfo_endpoint",
      jwksUrl: "jwks_uri",
      logoutUrl: "end_session_endpoint",
    } as const;

    const urls: Partial<OktaUrls> = {};
    for (const [key, field] of Object.entries(requiredFields)) {
      const value = doc[field];
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(
          `OIDC discovery at ${discoveryUrl} is missing required field "${field}"`
        );
      }
      urls[key as keyof OktaUrls] = value;
    }
    return urls as OktaUrls;
  })();

  discoveryCache.set(domain, promise);
  // Don't cache rejections — a transient failure should be retryable.
  promise.catch(() => discoveryCache.delete(domain));
  return promise;
}

/**
 * Backwards-compatible alias. Prefer `discoverOktaUrls` so the URL map
 * matches what the Okta org actually provisions rather than a hardcoded
 * shape.
 */
export async function getOktaUrls(domain: string): Promise<OktaUrls> {
  return discoverOktaUrls(domain);
}
