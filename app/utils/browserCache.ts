/**
 * Browser cache + service-worker reset helpers.
 *
 * Used by the /system page "Clear cache" action and the stale-COOP
 * recovery in `app/app.vue`. The action is meant to mimic Chrome's
 * "Clear site data" without nuking the user's identity or local
 * database.
 *
 * What this CLEARS:
 * - All service worker registrations scoped to the origin
 * - All Cache Storage API entries (Workbox precache, runtime caches)
 * - sessionStorage (it's ephemeral by design)
 * - localStorage keys matching known PWA/Workbox/SW patterns
 *
 * What this DOES NOT clear (by design):
 * - IndexedDB / OPFS — that's the user's local database. The Recreate
 *   Local DB action owns that path.
 * - localStorage keys we own (`peaky:*` UI prefs and identity).
 *   Wiping them would log the user out, which is a worse outcome than
 *   the cache staleness this action exists to fix.
 */

export interface BrowserCacheResetResult {
  /** Number of Cache Storage entries deleted. */
  cacheCount: number;
  /** Number of service-worker registrations unregistered. */
  serviceWorkerCount: number;
  /** Number of localStorage keys cleared (PWA-related only). */
  localStorageKeysCleared: number;
  /** Whether sessionStorage was cleared. */
  sessionStorageCleared: boolean;
  /** Bytes freed across all storage, per `navigator.storage.estimate()`. */
  freedBytes: number | null;
}

// localStorage key patterns that belong to PWA / Workbox / SW machinery.
// Anything matching gets cleared; everything else is preserved (notably
// `peaky:current-actor` and all `peaky:*` UI prefs).
const CHUNK_RECOVERY_KEY = "peaky:chunk-recovery-attempted-at";
const CHUNK_RECOVERY_COOLDOWN_MS = 60_000;
const MAX_CHUNK_RECOVERY_ATTEMPTS = 2;

const PWA_KEY_PATTERNS = [
  /^workbox-/i,
  /^vite-pwa-/i,
  /service[-_]?worker/i,
  /^sw-/i,
  /^pwa-/i,
  // Peaky's bootstrap-error key persists across reloads to surface the
  // recovery UI; clearing it is part of "give me a clean slate".
  /^peaky-db-bootstrap-error$/,
];

function isPwaLocalStorageKey(key: string): boolean {
  return PWA_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

async function safeStorageEstimate(): Promise<number | null> {
  if (
    typeof navigator === "undefined" ||
    !("storage" in navigator) ||
    typeof navigator.storage?.estimate !== "function"
  ) {
    return null;
  }
  try {
    const { usage } = await navigator.storage.estimate();
    return typeof usage === "number" ? usage : null;
  } catch {
    return null;
  }
}

/**
 * Clear browser caches + service workers. See module header for what
 * is and isn't touched.
 *
 * Idempotent — calling twice is a no-op.
 */
export async function clearBrowserCachesAndStaleWorkers(): Promise<BrowserCacheResetResult> {
  if (import.meta.server) {
    return {
      cacheCount: 0,
      serviceWorkerCount: 0,
      localStorageKeysCleared: 0,
      sessionStorageCleared: false,
      freedBytes: null,
    };
  }

  const usageBefore = await safeStorageEstimate();

  // 1. Unregister service workers. The active SW keeps controlling
  //    existing clients until they unload, so unregister BEFORE the
  //    final reload — otherwise the reload could be served by the same
  //    stale worker.
  const registrations =
    "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistrations()
      : [];
  await Promise.all(
    registrations.map((registration) => registration.unregister())
  );

  // 2. Delete every Cache Storage entry (Workbox precache, runtime).
  const cacheKeys = "caches" in window ? await caches.keys() : [];
  await Promise.all(cacheKeys.map((key) => caches.delete(key)));

  // 3. Selective localStorage clear — PWA/Workbox keys only. We do NOT
  //    clear `peaky:*` keys (identity + UI prefs); wiping them would log
  //    the user out, which is a worse outcome than stale cache.
  let localStorageKeysCleared = 0;
  if (typeof window !== "undefined" && "localStorage" in window) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isPwaLocalStorageKey(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    localStorageKeysCleared = keysToRemove.length;
  }

  // 4. sessionStorage is ephemeral anyway; safe to wipe.
  let sessionStorageCleared = false;
  if (typeof window !== "undefined" && "sessionStorage" in window) {
    try {
      sessionStorage.clear();
      sessionStorageCleared = true;
    } catch {
      // Some browsers throw when storage is disabled. Treat as no-op.
    }
  }

  const usageAfter = await safeStorageEstimate();
  const freedBytes =
    usageBefore !== null && usageAfter !== null
      ? Math.max(0, usageBefore - usageAfter)
      : null;

  return {
    cacheCount: cacheKeys.length,
    serviceWorkerCount: registrations.length,
    localStorageKeysCleared,
    sessionStorageCleared,
    freedBytes,
  };
}

export function shouldRecoverFromChunkError(now = Date.now()): boolean {
  if (import.meta.server || typeof localStorage === "undefined") return false;

  try {
    const storedState = localStorage.getItem(CHUNK_RECOVERY_KEY);
    const previousState = parseChunkRecoveryState(storedState);
    const isRecoveryWindowActive =
      previousState !== null &&
      now - previousState.startedAt < CHUNK_RECOVERY_COOLDOWN_MS;
    const attempts = isRecoveryWindowActive ? previousState.attempts + 1 : 1;

    if (attempts > MAX_CHUNK_RECOVERY_ATTEMPTS) {
      return false;
    }

    localStorage.setItem(
      CHUNK_RECOVERY_KEY,
      JSON.stringify({
        attempts,
        startedAt: isRecoveryWindowActive
          ? (previousState?.startedAt ?? now)
          : now,
      })
    );
    return true;
  } catch {
    return false;
  }
}

function parseChunkRecoveryState(storedState: string | null): {
  attempts: number;
  startedAt: number;
} | null {
  if (storedState === null) return null;

  const legacyTimestamp = Number(storedState);
  if (Number.isFinite(legacyTimestamp)) {
    return { attempts: 1, startedAt: legacyTimestamp };
  }

  try {
    const parsed = JSON.parse(storedState) as {
      attempts?: unknown;
      startedAt?: unknown;
    };
    if (
      typeof parsed.attempts === "number" &&
      Number.isFinite(parsed.attempts) &&
      typeof parsed.startedAt === "number" &&
      Number.isFinite(parsed.startedAt)
    ) {
      return { attempts: parsed.attempts, startedAt: parsed.startedAt };
    }
  } catch {
    // A malformed state is treated as if no recovery has been attempted.
  }

  return null;
}

/**
 * Clear all browser caches/workers and force a fresh load from the server.
 *
 * A plain `location.reload()` can still hit the browser's HTTP disk cache
 * (separate from Cache Storage / SW), serving a stale response without the
 * required COOP/COEP headers.  Navigating with a cache-busting query param
 * guarantees Chrome treats it as a new request.
 */
export async function clearAndHardReload(): Promise<void> {
  try {
    await clearBrowserCachesAndStaleWorkers();
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set("_cb", Date.now().toString());
    window.location.replace(url.toString());
  }
}
