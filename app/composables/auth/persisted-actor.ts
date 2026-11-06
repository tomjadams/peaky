import type { LifecycleActor, LifecycleRole } from "~/lifecycle/management";
import { getDefaultLifecycleActor } from "~/lifecycle/management";
import type { ReviewActor } from "~/services/review/ReviewGovernance";
import { readActorOverride } from "~/composables/auth/actor-override";

const CURRENT_ACTOR_STORAGE_KEY = "peaky:current-actor";

interface StoredActor {
  id: string;
  name: string;
  roles: LifecycleRole[];
}

// Membership of any of these OIDC group names grants the `admin` lifecycle
// role. Restricted to Peaky-specific groups — we deliberately do NOT include
// the generic tenant-wide "admin" group, since admins from sibling apps could
// otherwise inherit Peaky privileges on name collision. Currently dead
// because PE's IdP does not deliver the OIDC `groups` claim; the self-claim
// admin toggle in `NavigationSidebar.vue` provides the local placeholder
// until Cedar authz + Policies UI ship.
export const ADMIN_GROUPS: ReadonlySet<string> = new Set([
  "peaky-admins",
  "peaky-admin",
]);

function normalizeActor(value?: Partial<StoredActor> | null): LifecycleActor {
  const fallback = getDefaultLifecycleActor();
  // `??` (nullish coalescing) — not `||` — so a legitimately empty string in
  // `value.id` or `value.name` is preserved instead of falling back. The
  // project guideline at AGENTS.md → `site/docs/development/typescript.md`
  // is "use `??` not `||` for defaults". `||` would also overwrite the
  // empty case with the developer's default actor, which is misleading when
  // the stored snapshot was deliberately written with a blank claim.
  const trimmedId = value?.id?.trim();
  const trimmedName = value?.name?.trim();

  return {
    id: trimmedId ?? fallback.id,
    name: trimmedName ?? fallback.name,
    roles:
      value?.roles && value.roles.length > 0
        ? [...value.roles]
        : fallback.roles,
  };
}

export function readStoredActor(): LifecycleActor {
  if (!import.meta.client) {
    return getDefaultLifecycleActor();
  }

  const raw = window.localStorage.getItem(CURRENT_ACTOR_STORAGE_KEY);

  if (!raw) {
    return getDefaultLifecycleActor();
  }

  try {
    return normalizeActor(JSON.parse(raw) as StoredActor);
  } catch {
    return getDefaultLifecycleActor();
  }
}

export function writeStoredActor(actor: LifecycleActor): void {
  if (!import.meta.client) {
    return;
  }
  window.localStorage.setItem(
    CURRENT_ACTOR_STORAGE_KEY,
    JSON.stringify({
      id: actor.id,
      name: actor.name,
      roles: actor.roles,
    })
  );
}

export function clearStoredActor(): void {
  if (!import.meta.client) {
    return;
  }
  window.localStorage.removeItem(CURRENT_ACTOR_STORAGE_KEY);
}

export function toReviewActor(actor: LifecycleActor): ReviewActor {
  return {
    id: actor.id,
    name: actor.name,
    roles: [...actor.roles],
  };
}

/**
 * Project the OIDC session user (with optional `groups` claim) onto the
 * `LifecycleActor` shape used across the app. The `groups` claim is only
 * present when PE has granted the `groups` scope on the Okta Authorization
 * Server; until then, every actor is `["member"]`.
 */
export function projectOidcUserToActor(user: {
  sub: string;
  name: string;
  groups?: string[];
}): LifecycleActor {
  const groups = user.groups ?? [];
  const isAdmin = groups.some((g) => ADMIN_GROUPS.has(g));
  return {
    id: user.sub,
    name: user.name,
    roles: isAdmin ? ["admin"] : ["member"],
  };
}

export function readPersistedActor(): LifecycleActor {
  const base = readStoredActor();
  const override = readActorOverride();
  return override ? { ...base, roles: [...override] } : base;
}

export function readPersistedReviewActor(): ReviewActor {
  return toReviewActor(readPersistedActor());
}
