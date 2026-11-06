<template>
  <div
    class="login-page bg-default flex min-h-screen items-center justify-center px-6 pb-[7vh] sm:px-12"
    :class="{ 'motion-armed': motionArmed }"
  >
    <div
      class="grid w-full max-w-[1240px] items-center gap-28 lg:grid-cols-[1fr_460px]"
    >
      <!-- Content column -->
      <div class="flex flex-col items-start text-left">
        <!-- Brand row — the logo's own moment, nothing else near it -->
        <div class="tier-brand flex items-center gap-2.5">
          <PeakyLogo :size="34" />
          <span
            class="text-highlighted text-[26px] font-extrabold tracking-tight"
          >
            Peaky
          </span>
        </div>

        <!-- Survey tick -->
        <div
          class="tier-heading bg-primary-600 dark:bg-primary-400 mt-14 h-[3px] w-10 rounded-full"
          aria-hidden="true"
        />

        <h1
          class="tier-heading text-highlighted mt-4 text-[42px] leading-tight font-extrabold tracking-[-0.015em]"
        >
          Pick up where you left off.
        </h1>

        <p
          class="tier-sub text-muted mt-5 max-w-[480px] text-[18px] leading-[1.6]"
        >
          {{ subhead }}
        </p>

        <div class="tier-button mt-9">
          <UButton
            color="primary"
            size="xl"
            :loading="pending"
            @click="handleLogin"
          >
            Continue with Okta
          </UButton>
        </div>

        <p class="tier-meta text-dimmed mt-5 text-sm">
          Single sign-on &middot; work saves to this device first
        </p>
      </div>

      <!-- Compass column — lg+ only, small screens get the focused column
           without it rather than stacking it awkwardly -->
      <div class="tier-compass compass-wrap hidden lg:block">
        <LandingCompassRose />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false, public: true });

const route = useRoute();
const { isLoggedIn, login, status } = useAuth();

const pending = computed(() => status.value === "pending");

// Same redirect-detection logic the page already used for handleLogin,
// reused here to tailor the copy — no new plumbing added.
const redirect = computed(() =>
  typeof route.query.redirect === "string" ? route.query.redirect : undefined
);

const subhead = computed(() =>
  redirect.value
    ? "Sign in to continue — you'll land right back where you were headed."
    : "Sign in to continue to your reviews and templates."
);

if (import.meta.client && isLoggedIn.value) {
  await navigateTo("/");
}

function handleLogin() {
  login(redirect.value ?? "/teams");
}

// Gates every hidden entrance state — added in onMounted so SSR/no-JS output
// (and the brief pre-hydration frame) always renders fully visible content.
const motionArmed = ref(false);

onMounted(() => {
  motionArmed.value = true;
});
</script>

<style scoped>
/* LandingCompassRose renders a fixed 340x340 SVG sized via viewBox. Forcing
   the CSS box on the root <svg> (rather than transform: scale, which would
   need extra layout compensation) scales it cleanly to the 400px column —
   the component's own needle/track animations use transform-box: view-box,
   so they key off the SVG's internal coordinate space and are unaffected by
   the resize. */
.compass-wrap {
  width: 460px;
  height: 460px;
}

.compass-wrap :deep(svg) {
  width: 100%;
  height: 100%;
}

.motion-armed .tier-brand,
.motion-armed .tier-heading,
.motion-armed .tier-sub,
.motion-armed .tier-button,
.motion-armed .tier-meta,
.motion-armed .tier-compass {
  opacity: 0;
  transform: translateY(12px);
  filter: blur(5px);
}

.motion-armed .tier-brand {
  animation: login-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 0ms both;
}
.motion-armed .tier-heading {
  animation: login-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both;
}
.motion-armed .tier-sub {
  animation: login-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 240ms both;
}
.motion-armed .tier-button {
  animation: login-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 360ms both;
}
.motion-armed .tier-meta {
  animation: login-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 480ms both;
}
.motion-armed .tier-compass {
  animation: login-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both;
}

@keyframes login-reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
    filter: blur(5px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .motion-armed .tier-brand,
  .motion-armed .tier-heading,
  .motion-armed .tier-sub,
  .motion-armed .tier-button,
  .motion-armed .tier-meta,
  .motion-armed .tier-compass {
    opacity: 1;
    transform: none;
    filter: none;
    animation: none;
  }
}
</style>
