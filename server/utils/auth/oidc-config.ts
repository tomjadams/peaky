import type { H3Event } from "h3";

/**
 * Returns whether the OIDC/Okta authentication flow is enabled for this
 * deployment. Reads the Nuxt public runtime config flag that is computed from
 * required env vars in `nuxt.config.ts`.
 */
export function isOidcEnabled(event?: H3Event): boolean {
  const config = useRuntimeConfig(event);
  return Boolean(config.public.oidcEnabled);
}
