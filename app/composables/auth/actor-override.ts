import {
  VALID_LIFECYCLE_ROLES,
  type LifecycleRole,
} from "~/lifecycle/management";

/**
 * Local-storage key holding the user's self-claimed actor roles. When set,
 * these roles win over the OIDC `groups` projection. See
 * `useCurrentActor` for the wiring and `design.md` §9 for the planned
 * Cedar / Policies UI replacement.
 */
export const ACTOR_OVERRIDE_STORAGE_KEY = "peaky:actor-override-roles";

function isLifecycleRole(value: unknown): value is LifecycleRole {
  return (
    typeof value === "string" &&
    VALID_LIFECYCLE_ROLES.has(value as LifecycleRole)
  );
}

/**
 * Reads the override roles from localStorage. Returns `null` when:
 *   - the runtime has no `window.localStorage` (SSR);
 *   - the key is not set;
 *   - the stored value is malformed JSON;
 *   - the stored value contains no valid lifecycle roles.
 */
export function readActorOverride(): LifecycleRole[] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACTOR_OVERRIDE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const roles = parsed.filter(isLifecycleRole);
    return roles.length > 0 ? roles : null;
  } catch {
    return null;
  }
}

/**
 * Writes/clears the override roles. `null` removes the key entirely so
 * subsequent reads short-circuit on the absence check instead of parsing
 * an empty array.
 */
export function writeActorOverride(roles: LifecycleRole[] | null): void {
  if (typeof window === "undefined") return;
  if (roles) {
    window.localStorage.setItem(
      ACTOR_OVERRIDE_STORAGE_KEY,
      JSON.stringify(roles)
    );
  } else {
    window.localStorage.removeItem(ACTOR_OVERRIDE_STORAGE_KEY);
  }
}
