/**
 * Detects when a new version of the app has been deployed while the tab is open.
 *
 * Polls `/api/health` every 5 minutes and compares the server's build ID
 * against the build ID baked into this client bundle.  When they differ,
 * `hasNewVersion` becomes true and the UI can show a non-blocking reload prompt.
 *
 * The check is skipped in non-browser environments and during development
 * (where the server always returns `buildId: "dev"`).
 *
 * Usage:
 *   const { hasNewVersion } = useDeploymentVersion()
 *   // show a toast when hasNewVersion is true
 */
export function useDeploymentVersion() {
  const hasNewVersion = ref(false);

  if (!import.meta.client) {
    return { hasNewVersion };
  }

  const nuxtApp = useNuxtApp();
  const clientBuildId = (nuxtApp.$config.app as { buildId?: string }).buildId;

  // Skip the check in development — the server always returns "dev" and we
  // don't want spurious "update available" prompts during local iteration.
  if (!clientBuildId || clientBuildId === "dev") {
    return { hasNewVersion };
  }

  const checkVersion = async () => {
    try {
      const { buildId } = await $fetch<{ buildId: string }>("/api/health", {
        // Prevent the browser from serving a cached response — we want the
        // live value from the server, not a stale CDN hit.
        headers: { "Cache-Control": "no-cache" },
      });

      if (buildId && buildId !== "dev" && buildId !== clientBuildId) {
        hasNewVersion.value = true;
      }
    } catch {
      // Version check is best-effort — network errors are silently ignored.
    }
  };

  onMounted(() => {
    // First check after a short delay so it doesn't race with page hydration.
    const initialCheck = setTimeout(checkVersion, 0);
    // Then poll every 5 minutes.
    const interval = setInterval(checkVersion, 5 * 60 * 1000);

    onUnmounted(() => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    });
  });

  return { hasNewVersion };
}
