import type { AuthSession } from "./session";

/** Maximum input JSON size (bytes) before iron-webcrypto sealing overhead. */
export const COOKIE_BUDGET_BYTES = 3000;

/**
 * Optional fields eligible for budget-driven drop, in priority order. Drop
 * `id_token` first because we have an alternative path (local-only logout)
 * for when it's gone; drop cosmetic/profile fields only after that.
 * `ldap_uid` sits between standard profile claims and biometric-style ones
 * — useful for cross-IDP lookups, but the call sites that read it (future
 * Cedar authz) tolerate its absence, while newer profile-style claims are
 * cheaper to lose.
 */
const DROPPABLE_KEYS = [
  "id_token",
  "picture",
  "groups",
  "preferred_username",
  "ldap_uid",
  "given_name",
  "family_name",
  "email_verified",
] as const satisfies readonly (keyof AuthSession)[];

function byteLength(input: string): number {
  return new TextEncoder().encode(input).length;
}

/**
 * Trims a session payload until its JSON serialisation fits under
 * `COOKIE_BUDGET_BYTES`. Pure function — no I/O, no mutation of the input.
 *
 * Returns the trimmed session (always a fresh object) and a list of keys that
 * were dropped to meet the budget. The caller is responsible for logging the
 * drop list via the `[AUTH-DEBUG]` server-side logger.
 *
 * Why pure: deterministic drop order, trivially unit-testable without H3
 * `useSession`, and avoids any chance of mutating caller state.
 */
export function enforceCookieBudget(session: AuthSession): {
  trimmed: AuthSession;
  dropped: readonly string[];
} {
  const serialised = JSON.stringify(session);
  if (byteLength(serialised) <= COOKIE_BUDGET_BYTES) {
    return { trimmed: { ...session }, dropped: [] };
  }

  const trimmed: AuthSession = { ...session };
  const dropped: string[] = [];

  for (const key of DROPPABLE_KEYS) {
    if (trimmed[key] === undefined) continue;
    const after = JSON.stringify(trimmed);
    if (byteLength(after) <= COOKIE_BUDGET_BYTES) break;
    // Cast through `unknown` so we can reassign to `undefined` without losing
    // the field's TypeScript type. JSON.stringify omits `undefined` values
    // which gives us the same trim effect as a real delete.
    (trimmed as unknown as Record<string, unknown>)[key] = undefined;
    dropped.push(key);
  }

  const finalSerialised = JSON.stringify(trimmed);
  if (byteLength(finalSerialised) > COOKIE_BUDGET_BYTES) {
    throw new Error(
      `Session payload still exceeds cookie budget of ${COOKIE_BUDGET_BYTES} bytes after dropping all optional fields`
    );
  }

  return { trimmed, dropped };
}

/**
 * Returns the byte length of a JSON-serialised session payload. Used for
 * `[AUTH-DEBUG]` logging when the budget is exceeded.
 */
export function sessionByteLength(session: AuthSession): number {
  return byteLength(JSON.stringify(session));
}
