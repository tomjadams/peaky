/**
 * Unit tests for the useAuth composable.
 *
 * Regression coverage for issue #89: when OIDC is not configured
 * (`oidcEnabled=false`, e.g. local `make watch` without `NUXT_OIDC_*` env
 * vars), `/api/_auth/session` always 401s. Fetching it unconditionally on
 * every page load caused `useCurrentActor`'s watch to wipe the locally
 * persisted dev actor (see useCurrentActor.test.ts). The fix is to skip the
 * fetch entirely while OIDC is disabled.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAuth } from "~/composables/useAuth";

describe("useAuth", () => {
  let originalOidcEnabled: boolean;

  beforeEach(() => {
    originalOidcEnabled = useRuntimeConfig().public.oidcEnabled;
    // `useFetch(..., { immediate: true })` below would otherwise attempt a
    // real network call to `/api/_auth/session` — no server is running in
    // the unit test environment. Stub `$fetch` so the "oidcEnabled=true"
    // case never touches the network (per testing.md "No I/O in unit
    // tests"); we only assert on the synchronous pre-fetch `status`.
    vi.stubGlobal("$fetch", vi.fn().mockReturnValue(new Promise(() => {})));
  });

  afterEach(() => {
    useRuntimeConfig().public.oidcEnabled = originalOidcEnabled;
    vi.unstubAllGlobals();
  });

  it("does not fetch /api/_auth/session when oidcEnabled is false", () => {
    useRuntimeConfig().public.oidcEnabled = false;

    const { status, isLoggedIn, user } = useAuth();

    // `useFetch` with `immediate: false` never leaves "idle" on its own —
    // if it had fired, `status` would have already flipped to "pending".
    expect(status.value).toBe("idle");
    expect(isLoggedIn.value).toBe(false);
    expect(user.value).toBeNull();
  });

  it("fetches /api/_auth/session when oidcEnabled is true", () => {
    useRuntimeConfig().public.oidcEnabled = true;

    const { status } = useAuth();

    // `useFetch` with `lazy: true, immediate: true` synchronously flips to
    // "pending" before the network round-trip settles.
    expect(status.value).toBe("pending");
  });
});
