import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ACTOR_OVERRIDE_STORAGE_KEY,
  readActorOverride,
  writeActorOverride,
} from "../../../../app/composables/auth/actor-override";

/**
 * localStorage is unavailable in SSR; the helpers must early-return null on
 * the server, then return the snapshot once `window` is reachable. The SSR
 * describe block below simulates that path by temporarily hiding
 * `globalThis.window` from the helper checks.
 */

describe("actor-override", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe("SSR guard (no `window` available)", () => {
    const originalWindow = globalThis.window;

    afterEach(() => {
      // Always restore — the other describe blocks still rely on `window`.
      if (originalWindow === undefined) {
        delete (globalThis as { window?: Window }).window;
      } else {
        (globalThis as { window: Window }).window = originalWindow;
      }
    });

    it("readActorOverride returns null when globalThis.window is undefined", () => {
      delete (globalThis as { window?: Window }).window;
      expect(readActorOverride()).toBeNull();
    });

    it("writeActorOverride is a no-op (no throw) when globalThis.window is undefined", () => {
      delete (globalThis as { window?: Window }).window;
      expect(() => writeActorOverride(["admin"])).not.toThrow();
    });
  });

  describe("readActorOverride", () => {
    it("returns null when the key is unset", () => {
      expect(readActorOverride()).toBeNull();
    });

    it("returns null when the stored JSON is malformed", () => {
      window.localStorage.setItem(ACTOR_OVERRIDE_STORAGE_KEY, "not-json");
      expect(readActorOverride()).toBeNull();
    });

    it("returns null when the stored array is empty", () => {
      window.localStorage.setItem(
        ACTOR_OVERRIDE_STORAGE_KEY,
        JSON.stringify([])
      );
      expect(readActorOverride()).toBeNull();
    });

    it("returns null when the stored value is not an array", () => {
      window.localStorage.setItem(
        ACTOR_OVERRIDE_STORAGE_KEY,
        JSON.stringify({ admin: true })
      );
      expect(readActorOverride()).toBeNull();
    });

    it("returns the roles when the stored value is a non-empty array", () => {
      window.localStorage.setItem(
        ACTOR_OVERRIDE_STORAGE_KEY,
        JSON.stringify(["admin"])
      );
      expect(readActorOverride()).toEqual(["admin"]);
    });

    it("filters out invalid roles and keeps only valid lifecycle roles", () => {
      window.localStorage.setItem(
        ACTOR_OVERRIDE_STORAGE_KEY,
        JSON.stringify(["admin", "superuser", "member"])
      );
      expect(readActorOverride()).toEqual(["admin", "member"]);
    });

    it("returns null when every stored role is invalid", () => {
      window.localStorage.setItem(
        ACTOR_OVERRIDE_STORAGE_KEY,
        JSON.stringify(["superuser", "guest"])
      );
      expect(readActorOverride()).toBeNull();
    });
  });

  describe("writeActorOverride", () => {
    it("writes JSON when given an array", () => {
      writeActorOverride(["admin"]);
      expect(window.localStorage.getItem(ACTOR_OVERRIDE_STORAGE_KEY)).toBe(
        JSON.stringify(["admin"])
      );
    });

    it("removes the key when given null", () => {
      writeActorOverride(["admin"]);
      writeActorOverride(null);
      expect(
        window.localStorage.getItem(ACTOR_OVERRIDE_STORAGE_KEY)
      ).toBeNull();
    });

    it("write then read round-trips", () => {
      writeActorOverride(["admin"]);
      expect(readActorOverride()).toEqual(["admin"]);
      writeActorOverride(null);
      expect(readActorOverride()).toBeNull();
    });
  });
});
