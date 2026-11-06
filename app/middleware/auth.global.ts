// Global auth guard — all routes are protected by default.
// Opt out by adding `definePageMeta({ public: true })` to a page.
// No-op when OIDC is not configured (`oidcEnabled=false`), runs client-only.
export default defineNuxtRouteMiddleware(async (to) => {
  const { oidcEnabled } = useRuntimeConfig().public;

  if (!oidcEnabled || to.meta.public) {
    return;
  }

  if (!import.meta.client) {
    return;
  }

  const { isLoggedIn, refresh } = useAuth();

  await refresh();

  if (!isLoggedIn.value) {
    const params = new URLSearchParams({ redirect: to.fullPath });
    return navigateTo(`/auth/login?${params.toString()}`);
  }
});
