import { computed, ref, watch } from "vue";
import type { LifecycleActor, LifecycleRole } from "~/lifecycle/management";
import { DEFAULT_LIFECYCLE_ACTOR } from "~/lifecycle/management";
import type { ReviewActor } from "~/services/review/ReviewGovernance";
import {
  readActorOverride,
  writeActorOverride,
} from "~/composables/auth/actor-override";
import {
  clearStoredActor,
  projectOidcUserToActor,
  readStoredActor,
  toReviewActor,
  writeStoredActor,
} from "~/composables/auth/persisted-actor";

export {
  ADMIN_GROUPS,
  readPersistedActor,
  readPersistedReviewActor,
} from "~/composables/auth/persisted-actor";

/**
 * Reactive current actor composable. Source of truth depends on
 * `oidcEnabled` (see `nuxt.config.ts`): when true, the OIDC session (via
 * `useAuth()`) projects onto `LifecycleActor` and mirrors to localStorage
 * for the synchronous `readPersistedActor()` helpers used outside Vue
 * setup; when false, `useAuth()` never fetches the session (see
 * `useAuth.ts`), so the actor comes from `readStoredActor()` — written by
 * the dev-only picker in `ProfileModal.vue` via `setDevActor()` (issue #89).
 *
 * Self-claim admin: `peaky:actor-override-roles` in localStorage wins over
 * the OIDC projection — the local escape hatch toggled from the Profile UI
 * before Cedar authz + Policies UI ship.
 */
export function useCurrentActor() {
  const { oidcEnabled } = useRuntimeConfig().public;
  const { user, isLoggedIn, status } = useAuth();

  // Reactive mirror of `localStorage[ACTOR_OVERRIDE_STORAGE_KEY]`, so the
  // computeds below re-evaluate when `setSelfClaimAdmin` writes through it.
  const override = ref<LifecycleRole[] | null>(readActorOverride());

  // Reactive trigger for `setDevActor()`'s direct localStorage write, which
  // is otherwise invisible to Vue — bumped to force `actor` to re-evaluate.
  const devActorVersion = ref(0);

  const oidcActor = computed<LifecycleActor | null>(() =>
    oidcEnabled && isLoggedIn.value && user.value
      ? projectOidcUserToActor({
          sub: user.value.sub,
          name: user.value.name,
          groups: user.value.groups,
        })
      : null
  );

  const isSelfClaimAdmin = computed<boolean>(
    () => override.value?.includes("admin") ?? false
  );

  function setSelfClaimAdmin(claim: boolean): void {
    const next: LifecycleRole[] | null = claim ? ["admin"] : null;
    writeActorOverride(next);
    override.value = next;
  }

  // Dev-only actor picker (`ProfileModal.vue`, `oidcEnabled` false) — writes
  // straight to localStorage, same as the pre-OIDC picker. Guarded on
  // `oidcEnabled` so a stray call can't desync it from the OIDC-mirror
  // watch below, the sole source of truth for the persisted actor then.
  function setDevActor(next: LifecycleActor): void {
    if (oidcEnabled) return;
    writeStoredActor({ id: next.id, name: next.name, roles: [...next.roles] });
    devActorVersion.value++;
  }

  const actor = computed<LifecycleActor>(() => {
    // A plain cached ref updated by `setDevActor()` would be simpler, but
    // could go stale relative to the OIDC watch's `clearStoredActor()`
    // below — re-reading `readStoredActor()` on every bump avoids that.
    void devActorVersion.value;
    // `readStoredActor()` already falls through to the default actor when
    // localStorage is empty or malformed, so `?? default` was unreachable.
    const base = oidcActor.value ?? readStoredActor();
    // Gating the OIDC-era self-claim override on `oidcEnabled` stops a
    // stale override from silently beating the dev picker's own checkbox.
    return oidcEnabled && override.value
      ? { ...base, roles: [...override.value] }
      : base;
  });

  // Mirrors the OIDC actor to localStorage (see file doc above); skipped
  // when `oidcEnabled` is false since `useAuth()` never fetches the session
  // in that mode and clearing on a 401 only makes sense when OIDC works.
  if (import.meta.client && oidcEnabled) {
    watch(
      [oidcActor, status],
      ([next, authStatus]) => {
        // Wait for the session fetch to settle before touching stored actor
        // state; otherwise the initial "pending" tick would clear the cached
        // actor before we've determined whether the user is authenticated.
        // Only "success" and "error" are terminal — any other status is a
        // loading/pending tick we should skip.
        if (authStatus !== "success" && authStatus !== "error") return;
        if (authStatus === "error" || !next) {
          // Terminal failure (e.g. 401 from `/api/_auth/session`) or
          // successful fetch with no actor (logged out). Either way,
          // scrub the cached snapshot so a stale identity never bleeds
          // past session expiry on the next render.
          clearStoredActor();
          return;
        }
        writeStoredActor(next);
      },
      { immediate: true }
    );
  }

  const reviewActor = computed<ReviewActor>(() => toReviewActor(actor.value));

  return {
    actor,
    reviewActor,
    isSelfClaimAdmin,
    setSelfClaimAdmin,
    setDevActor,
  };
}

// Re-export so existing imports keep working — the placeholder default is
// still the SSR fallback before the OIDC session resolves.
export { DEFAULT_LIFECYCLE_ACTOR };
