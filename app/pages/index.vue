<template>
  <LandingShell :signed-in="signedIn" />
</template>

<script setup lang="ts">
// The landing shell is the product's concept page — it stays reachable for
// signed-in visitors (e.g. via the sidebar logo, which links to "/") as well
// as logged-out ones, so it doubles as a demo surface and a way to revisit
// the pitch. Fresh logins still land on Teams directly (see the OIDC
// login/callback routes); this page never redirects on its own.
definePageMeta({
  public: true,
  layout: false,
});

const { oidcEnabled } = useRuntimeConfig().public;
const { isLoggedIn } = useAuth();

// Mirrors auth.global.ts: when OIDC is not configured (local dev) the app is
// open, so visitors count as signed in. With OIDC on, visitors count as
// signed in once the lazy session check resolves to a logged-in user.
const signedIn = computed(() => !oidcEnabled || isLoggedIn.value);
</script>
