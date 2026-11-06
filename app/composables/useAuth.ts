interface AuthUser {
  sub: string;
  email: string;
  name: string;
  // Standard OIDC claims — present when delivered by the IdP. Surface as
  // optional so a missing field does not block the auth flow.
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
  preferred_username?: string;
  ldap_uid?: string;
  picture?: string;
  groups?: string[];
}

function logout() {
  return navigateTo("/auth/okta/logout", { external: true });
}

/**
 * Client-only auth composable. Fetches the OIDC user from `/api/_auth/session`
 * lazily (non-blocking, after hydration) so the app shell renders immediately.
 * Required fields are `sub`, `email`, `name`; standard OIDC claims
 * (`given_name`, `family_name`, `email_verified`, `preferred_username`,
 * `picture`, `groups`) are surfaced when the IdP delivers them. Raw tokens
 * never reach the client — only the sealed-cookie session is used.
 *
 * When OIDC is not configured (`oidcEnabled=false`, e.g. local `make watch`
 * without `NUXT_OIDC_*` env vars), the session fetch is skipped entirely —
 * `/api/_auth/session` always 401s in that case, and calling it on every
 * page load previously caused `useCurrentActor` to wipe the locally
 * persisted dev actor (see issue #89). `status` stays `"idle"` and
 * `isLoggedIn` stays `false` until `oidcEnabled` flips true.
 *
 * Dev-only diagnostics live server-side: the `[AUTH-DEBUG]` logs in
 * `server/api/_auth/session.get.ts`, `server/routes/auth/okta/callback.get.ts`,
 * and the gated `debug` endpoint.
 */
export function useAuth() {
  const route = useRoute();
  const { oidcEnabled } = useRuntimeConfig().public;

  const { data, status, refresh } = useFetch<AuthUser>("/api/_auth/session", {
    lazy: true,
    server: false,
    immediate: oidcEnabled,
  });

  const isLoggedIn = computed(
    () => status.value === "success" && data.value !== null
  );
  const user = computed<AuthUser | null>(() => data.value ?? null);

  function login(redirectTo?: string) {
    const destination = redirectTo ?? route.fullPath;
    const params = new URLSearchParams({ redirect: destination });
    return navigateTo(`/auth/okta/login?${params.toString()}`, {
      external: true,
    });
  }

  return {
    isLoggedIn,
    user,
    status,
    refresh,
    login,
    logout,
  };
}
