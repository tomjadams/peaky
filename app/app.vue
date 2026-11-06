<script setup>
useHead({
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
  link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  htmlAttrs: {
    lang: "en",
  },
});

const title = "Peaky - Readiness Assessment";
const description = "Complete the readiness checks before deployment.";

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
});

// ── Database bootstrap error recovery ──────────────────────────────────────
const dbError = useState("local-db-error");

function copyErrorDetails() {
  const text = JSON.stringify(
    { error: dbError.value, userAgent: navigator.userAgent },
    null,
    2
  );
  navigator.clipboard.writeText(text).catch(() => {
    // Clipboard not available — do nothing; the user can copy from the text block
  });
}

function clearLocalData() {
  localStorage.setItem("peaky-clear-db-on-reload", "1");
  window.location.reload();
}

// ── Deployment version staleness detection ─────────────────────────────────
const { hasNewVersion } = useDeploymentVersion();
const versionBannerDismissed = ref(false);

// ── Stale COOP header detection ────────────────────────────────────────────
// When a service worker serves a cached response without the required
// Cross-Origin-Opener-Policy header, `crossOriginIsolated` is false and
// OPFS / SharedArrayBuffer will fail.  Detect this automatically so
// non-power users get a one-click fix instead of a cryptic error.
const staleCoop = ref(false);
if (import.meta.client) {
  staleCoop.value = !self.crossOriginIsolated;
}

async function fixStaleCoop() {
  const { clearAndHardReload } = await import("~/utils/browserCache");
  await clearAndHardReload();
}

async function reloadForNewVersion() {
  const { clearAndHardReload } = await import("~/utils/browserCache");
  await clearAndHardReload();
}
</script>

<template>
  <UApp>
    <!-- Stale cross-origin isolation banner (blocks OPFS / local-first) -->
    <div
      v-if="staleCoop"
      class="fixed inset-0 z-[150] flex items-center justify-center bg-[#0F172A]/70 p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="stale-coop-title"
    >
      <div
        class="bg-default w-full max-w-md rounded-lg p-8 shadow-[0_8px_24px_rgba(15,23,42,.10)]"
      >
        <div class="flex items-start gap-4">
          <UIcon
            name="i-lucide-refresh-cw"
            class="mt-0.5 size-6 shrink-0 text-amber-500"
          />
          <div class="flex-1 space-y-3">
            <h2
              id="stale-coop-title"
              class="text-base font-semibold text-gray-900 dark:text-white"
            >
              Browser cache needs a refresh
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Your browser is loading a cached version of Peaky that is missing
              required security headers. This prevents the local database from
              working. Click below to clear the stale cache and reload.
            </p>
            <div class="pt-1">
              <UButton
                color="primary"
                label="Clear cache and reload"
                icon="i-lucide-eraser"
                @click="fixStaleCoop"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Deployment version update prompt -->
    <Transition name="slide-down">
      <div
        v-if="hasNewVersion && !versionBannerDismissed"
        class="bg-primary-600 fixed inset-x-0 top-0 z-[100] flex items-center justify-between gap-4 px-4 py-2.5 text-sm text-white shadow"
      >
        <span>A new version of Peaky is available.</span>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            color="white"
            variant="outline"
            label="Reload now"
            @click="reloadForNewVersion"
          />
          <UButton
            size="xs"
            color="white"
            variant="ghost"
            icon="i-lucide-x"
            aria-label="Dismiss"
            @click="versionBannerDismissed = true"
          />
        </div>
      </div>
    </Transition>

    <!-- Database bootstrap failure recovery overlay -->
    <div
      v-if="dbError"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-[#0F172A]/70 p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="db-error-title"
    >
      <div
        class="bg-default w-full max-w-lg rounded-lg p-8 shadow-[0_8px_24px_rgba(15,23,42,.10)]"
      >
        <div class="flex items-start gap-4">
          <UIcon
            name="i-lucide-database-zap"
            class="mt-0.5 size-6 shrink-0 text-red-500"
          />
          <div class="flex-1 space-y-3">
            <h2
              id="db-error-title"
              class="text-base font-semibold text-gray-900 dark:text-white"
            >
              Local database could not be loaded
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              An error occurred while applying a schema update to your local
              database. Your data on the server is safe. You can clear the local
              database and start fresh — everything will re-sync from the
              server.
            </p>

            <pre
              class="bg-muted text-muted overflow-x-auto rounded-lg p-3 text-[13px]"
              >{{ dbError.message }}</pre
            >

            <div class="flex flex-wrap gap-2 pt-1">
              <UButton
                color="error"
                label="Clear local data and reload"
                @click="clearLocalData"
              />
              <UButton
                variant="outline"
                label="Copy error details"
                icon="i-lucide-clipboard"
                @click="copyErrorDetails"
              />
            </div>

            <p class="text-dimmed text-[13px]">
              Error occurred at {{ dbError.at }}. Share the copied details with
              support if the problem persists.
            </p>
          </div>
        </div>
      </div>
    </div>

    <NuxtLayout class="app">
      <NuxtPwaManifest />
      <NuxtPage class="app__page" />
    </NuxtLayout>
  </UApp>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
