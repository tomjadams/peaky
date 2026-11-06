/**
 * Unit tests for useCurrentActor.
 *
 * Regression coverage for issue #89: when OIDC is not configured
 * (`oidcEnabled=false`), the OIDC-session watch must not run at all —
 * previously it fired on the terminal "error" status from a 401 and wiped
 * the developer's locally persisted actor on every page load. `useAuth()`
 * is mocked here so each test can drive `status`/`isLoggedIn` directly
 * without a real network round-trip.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { getDefaultLifecycleActor } from "~/lifecycle/management";
import {
  readStoredActor,
  writeStoredActor,
} from "~/composables/auth/persisted-actor";

const mockUseAuth = vi.fn();
vi.mock("~/composables/useAuth", () => ({
  useAuth: mockUseAuth,
}));

const DEV_ACTOR = {
  id: "dev-jane",
  name: "Jane Dev",
  roles: ["member"] as const,
};

describe("useCurrentActor", () => {
  let originalOidcEnabled: boolean;

  beforeEach(() => {
    originalOidcEnabled = useRuntimeConfig().public.oidcEnabled;
    window.localStorage.clear();
    mockUseAuth.mockReset();
  });

  afterEach(() => {
    useRuntimeConfig().public.oidcEnabled = originalOidcEnabled;
    window.localStorage.clear();
  });

  describe("when oidcEnabled is false", () => {
    beforeEach(() => {
      useRuntimeConfig().public.oidcEnabled = false;
    });

    it("does not clear the persisted actor on a terminal session error", async () => {
      writeStoredActor({ ...DEV_ACTOR, roles: [...DEV_ACTOR.roles] });
      mockUseAuth.mockReturnValue({
        user: ref(null),
        isLoggedIn: ref(false),
        // Simulates the 401 that always happens locally without OIDC env
        // vars — this must NOT scrub localStorage when OIDC is disabled.
        status: ref("error"),
      });

      const { useCurrentActor } =
        await import("~/composables/auth/useCurrentActor");
      const { actor } = useCurrentActor();

      expect(actor.value.id).toBe(DEV_ACTOR.id);
      expect(readStoredActor().id).toBe(DEV_ACTOR.id);
    });

    it("falls back to the default actor when localStorage is empty", async () => {
      mockUseAuth.mockReturnValue({
        user: ref(null),
        isLoggedIn: ref(false),
        status: ref("idle"),
      });

      const { useCurrentActor } =
        await import("~/composables/auth/useCurrentActor");
      const { actor } = useCurrentActor();

      expect(actor.value).toEqual(getDefaultLifecycleActor());
    });

    it("setDevActor writes the chosen identity and updates the reactive actor", async () => {
      mockUseAuth.mockReturnValue({
        user: ref(null),
        isLoggedIn: ref(false),
        status: ref("idle"),
      });

      const { useCurrentActor } =
        await import("~/composables/auth/useCurrentActor");
      const { actor, setDevActor } = useCurrentActor();

      setDevActor({ id: "dev-bob", name: "Bob Dev", roles: ["admin"] });

      expect(actor.value).toEqual({
        id: "dev-bob",
        name: "Bob Dev",
        roles: ["admin"],
      });
      expect(readStoredActor().id).toBe("dev-bob");
    });
  });

  describe("when oidcEnabled is true", () => {
    beforeEach(() => {
      useRuntimeConfig().public.oidcEnabled = true;
    });

    it("clears the persisted actor on a terminal session error", async () => {
      writeStoredActor({ ...DEV_ACTOR, roles: [...DEV_ACTOR.roles] });
      mockUseAuth.mockReturnValue({
        user: ref(null),
        isLoggedIn: ref(false),
        status: ref("error"),
      });

      const { useCurrentActor } =
        await import("~/composables/auth/useCurrentActor");
      useCurrentActor();

      expect(readStoredActor().id).toBe(getDefaultLifecycleActor().id);
    });

    it("projects the OIDC user onto the actor when logged in", async () => {
      mockUseAuth.mockReturnValue({
        user: ref({ sub: "okta-sub-1", name: "Okta User", groups: [] }),
        isLoggedIn: ref(true),
        status: ref("success"),
      });

      const { useCurrentActor } =
        await import("~/composables/auth/useCurrentActor");
      const { actor } = useCurrentActor();

      expect(actor.value).toEqual({
        id: "okta-sub-1",
        name: "Okta User",
        roles: ["member"],
      });
    });

    it("setDevActor is a no-op — it must not desync localStorage from the OIDC-mirrored actor", async () => {
      mockUseAuth.mockReturnValue({
        user: ref({ sub: "okta-sub-1", name: "Okta User", groups: [] }),
        isLoggedIn: ref(true),
        status: ref("success"),
      });

      const { useCurrentActor } =
        await import("~/composables/auth/useCurrentActor");
      const { actor, setDevActor } = useCurrentActor();

      setDevActor({ id: "dev-bob", name: "Bob Dev", roles: ["admin"] });

      expect(actor.value.id).toBe("okta-sub-1");
      expect(readStoredActor().id).toBe("okta-sub-1");
    });
  });
});
