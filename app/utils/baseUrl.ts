/**
 * Canonical base URL for the application.
 *
 * Defaults to `localhost:3000` in development so that generated URLs (e.g.
 * CloudEvents `dataschema`) resolve locally without extra config.
 *
 * Override via `NUXT_PUBLIC_BASE_URL` for staging or custom deployments.
 * In production the fallback is the Vercel deployment URL.
 */
export const BASE_URL: string =
  (import.meta.env?.NUXT_PUBLIC_BASE_URL as string | undefined) ??
  (import.meta.env?.DEV
    ? "http://localhost:3000"
    : "https://orr-sample.vercel.app");
