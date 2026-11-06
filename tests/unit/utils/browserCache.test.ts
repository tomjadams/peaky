/**
 * Unit tests for the /system Clear-cache action helper.
 *
 * The previous attempt at this action shipped without coverage and was
 * surfaced by the user as "didn't quite work" — these tests pin the
 * contract that prevents the same regression:
 *
 *   1. Service workers are unregistered.
 *   2. Cache Storage entries are deleted.
 *   3. localStorage clear is SELECTIVE — PWA/Workbox keys go, identity
 *      and UI prefs stay (otherwise the user is logged out).
 *   4. sessionStorage is wiped.
 *   5. The result carries enough numeric feedback (counts + freed
 *      bytes) for the UI to avoid the "nothing happened" UX.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  clearAndHardReload,
  clearBrowserCachesAndStaleWorkers,
} from "~/utils/browserCache";

/** Storage shim with realistic key iteration — module-scoped to avoid recreating on every test. */
function storageImpl(store: Map<string, string>) {
  return {
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

interface FakeRegistration {
  unregistered: boolean;
  unregister: () => Promise<true>;
}

function makeRegistration(): FakeRegistration {
  const reg: FakeRegistration = {
    unregistered: false,
    unregister: vi.fn().mockImplementation(async () => {
      reg.unregistered = true;
      return true;
    }),
  };
  return reg;
}

beforeEach(() => {
  // Fresh fakes per test.
  const registrations: FakeRegistration[] = [];
  const cacheNames: string[] = [];
  const deletedCaches: string[] = [];

  // navigator.serviceWorker
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      serviceWorker: {
        getRegistrations: vi.fn().mockResolvedValue(registrations),
      },
      storage: {
        estimate: vi
          .fn()
          .mockResolvedValueOnce({ usage: 1_000_000, quota: 50_000_000 })
          .mockResolvedValueOnce({ usage: 250_000, quota: 50_000_000 }),
      },
    },
  });

  // window.caches
  const fakeLocation = {
    href: "https://peaky.example/teams",
    replace: vi.fn(),
  };
  const fakeCaches = {
    keys: vi.fn().mockResolvedValue(cacheNames),
    delete: vi.fn().mockImplementation(async (name: string) => {
      deletedCaches.push(name);
      return true;
    }),
  };

  // localStorage / sessionStorage shims with realistic key iteration.
  const localStore = new Map<string, string>();
  const sessionStore = new Map<string, string>();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      caches: fakeCaches,
      location: fakeLocation,
      localStorage: storageImpl(localStore),
      sessionStorage: storageImpl(sessionStore),
    },
  });
  // Mirror to global so the helper's `localStorage` reference works
  // (`localStorage` and `sessionStorage` are top-level globals in the
  // browser, distinct from `window.localStorage`).
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storageImpl(localStore),
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: storageImpl(sessionStore),
  });
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: fakeCaches,
  });

  // Expose the test handles back via globalThis so each test can mutate.
  (globalThis as unknown as Record<string, unknown>).__testRegistrations =
    registrations;
  (globalThis as unknown as Record<string, unknown>).__testCacheNames =
    cacheNames;
  (globalThis as unknown as Record<string, unknown>).__testDeletedCaches =
    deletedCaches;
  (globalThis as unknown as Record<string, unknown>).__testLocalStore =
    localStore;
  (globalThis as unknown as Record<string, unknown>).testLocation =
    fakeLocation;
  (globalThis as unknown as Record<string, unknown>).__testSessionStore =
    sessionStore;
});

describe("clearBrowserCachesAndStaleWorkers", () => {
  it("unregisters every service worker the browser reports", async () => {
    const regs = (
      globalThis as unknown as { __testRegistrations: FakeRegistration[] }
    ).__testRegistrations;
    const a = makeRegistration();
    const b = makeRegistration();
    regs.push(a, b);

    const result = await clearBrowserCachesAndStaleWorkers();

    expect(a.unregistered).toBe(true);
    expect(b.unregistered).toBe(true);
    expect(result.serviceWorkerCount).toBe(2);
  });

  it("deletes every Cache Storage entry the browser reports", async () => {
    const names = (globalThis as unknown as { __testCacheNames: string[] })
      .__testCacheNames;
    const deleted = (globalThis as unknown as { __testDeletedCaches: string[] })
      .__testDeletedCaches;
    names.push("workbox-precache-v2", "runtime-images");

    const result = await clearBrowserCachesAndStaleWorkers();

    expect(deleted).toContain("workbox-precache-v2");
    expect(deleted).toContain("runtime-images");
    expect(result.cacheCount).toBe(2);
  });

  it("clears PWA-related localStorage keys but PRESERVES identity and prefs", async () => {
    const store = (
      globalThis as unknown as { __testLocalStore: Map<string, string> }
    ).__testLocalStore;
    // Mix PWA keys with keys that must survive the clear:
    store.set("workbox-precache-v2-https://...", "{}");
    store.set("vite-pwa-version", "1.2.3");
    store.set("sw-registration-state", "active");
    store.set("peaky-db-bootstrap-error", '{"message":"foo"}');
    store.set("peaky:current-actor", '{"id":"u1","name":"Test"}'); // KEEP
    store.set("peaky:template-selector-collapsed", "true"); // KEEP

    const result = await clearBrowserCachesAndStaleWorkers();

    // PWA-related → gone
    expect(store.has("workbox-precache-v2-https://...")).toBe(false);
    expect(store.has("vite-pwa-version")).toBe(false);
    expect(store.has("sw-registration-state")).toBe(false);
    expect(store.has("peaky-db-bootstrap-error")).toBe(false);
    // Identity + UI prefs → preserved (logging the user out would be a
    // worse outcome than the cache staleness this action exists to fix)
    expect(store.get("peaky:current-actor")).toBe('{"id":"u1","name":"Test"}');
    expect(store.get("peaky:template-selector-collapsed")).toBe("true");

    expect(result.localStorageKeysCleared).toBe(4);
  });

  it("wipes sessionStorage entirely (it's ephemeral by design)", async () => {
    const store = (
      globalThis as unknown as { __testSessionStore: Map<string, string> }
    ).__testSessionStore;
    store.set("anything", "value");
    store.set("workflow-state", "step-3");

    const result = await clearBrowserCachesAndStaleWorkers();

    expect(store.size).toBe(0);
    expect(result.sessionStorageCleared).toBe(true);
  });

  it("computes freedBytes from before/after storage estimate", async () => {
    // beforeEach mocks: usageBefore=1_000_000, usageAfter=250_000
    const result = await clearBrowserCachesAndStaleWorkers();
    expect(result.freedBytes).toBe(750_000);
  });

  it("navigates to a cache-busting URL when cleanup fails", async () => {
    const navigatorWithServiceWorker = navigator as Navigator & {
      serviceWorker: { getRegistrations: ReturnType<typeof vi.fn> };
    };
    navigatorWithServiceWorker.serviceWorker.getRegistrations.mockRejectedValueOnce(
      new Error("worker unavailable")
    );

    await expect(clearAndHardReload()).rejects.toThrow("worker unavailable");

    const location = (
      globalThis as unknown as {
        testLocation: { replace: ReturnType<typeof vi.fn> };
      }
    ).testLocation;
    expect(location.replace).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/peaky\.example\/teams\?_cb=\d+$/)
    );
  });

  it("returns zero counts when the browser has nothing to clear (idempotent second click)", async () => {
    const result = await clearBrowserCachesAndStaleWorkers();
    expect(result.serviceWorkerCount).toBe(0);
    expect(result.cacheCount).toBe(0);
    expect(result.localStorageKeysCleared).toBe(0);
  });
});
