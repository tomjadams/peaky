/**
 * Dev-only safety net: unregister any service worker left over from another app
 * running on the same localhost origin/port (e.g. a different worktree's PWA).
 *
 * Without this, a stale SW from `tom-todo-app` at http://localhost:3000/ can
 * intercept Peaky's Vite assets on first load, leaving the page blank until a
 * hard refresh. Peaky disables its own SW in dev (`pwa.devOptions.enabled: false`),
 * so a registered SW here can only belong to a previous project.
 */
export default defineNuxtPlugin({
  name: "unregister-stale-sw",
  setup() {
    if (!import.meta.dev) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        let unregistered = false;
        for (const registration of registrations) {
          const scriptUrl = registration.active?.scriptURL ?? "";
          const isPeakySw =
            scriptUrl.includes("dev-sw.js") || scriptUrl.endsWith("/sw.js");
          if (isPeakySw) continue;

          console.warn(
            `[unregister-stale-sw] unregistering foreign service worker: ${scriptUrl}`
          );
          await registration.unregister();
          unregistered = true;
        }

        if (unregistered) {
          // Reload once so assets are served from the network, not the stale SW.
          window.location.reload();
        }
      });
  },
});
