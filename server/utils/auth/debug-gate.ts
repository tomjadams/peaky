/**
 * Gating for the dev-only OIDC diagnostic endpoint. Returns true only when
 * the operator has opted in AND the runtime is not production. This is the
 * hard backstop: handing an id_token to a browser is a session primitive
 * exposure vector, so the route must never be reachable in a production
 * deployment regardless of env var.
 *
 *   - `NUXT_OIDC_AUTH_DEBUG === "1"`   (operator opt-in)
 *   - `process.env.NODE_ENV !== "production"`
 *
 * Caller is `server/api/_auth/debug.get.ts`. The route must be deleted once
 * the OIDC contract is settled with PE, not just gated (see the wrapping
 * PR notes).
 *
 * Extracted from the route so a unit test can import it without pulling
 * in `defineEventHandler` / `createError` (Nuxt auto-imports unavailable
 * in the bare vitest environment).
 */
export function debugEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NUXT_OIDC_AUTH_DEBUG === "1"
  );
}
