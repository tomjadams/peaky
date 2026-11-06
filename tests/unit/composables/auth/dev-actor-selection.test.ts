/**
 * Unit tests for the dev-only actor picker's pure resolution logic
 * (issue #89 follow-up from /merge-check's ux-reviewer): confirms the
 * picker never silently overwrites a developer's real display name with a
 * raw catalog id, and that an in-progress (unconfirmed) search fragment
 * cannot be saved as the actor's identity.
 */
import { describe, it, expect } from "vitest";
import type { LifecycleActor } from "~/lifecycle/management";
import {
  isConfirmedDevSelection,
  resolveDevActor,
  type DevActorCandidate,
} from "~/composables/auth/dev-actor-selection";

// Explicitly typed as `LifecycleActor` (mutable `roles: LifecycleRole[]`) so
// the literal is assignable to `resolveDevActor()`'s `currentActor` param —
// `roles: ["admin"] as const` would produce a readonly tuple that isn't.
const CURRENT_ACTOR: LifecycleActor = {
  id: "heitorl",
  name: "Heitor Lessa",
  roles: ["admin"],
};
const CANDIDATES: DevActorCandidate[] = [
  { id: "jane.doe", displayName: "Jane Doe" },
  { id: "bob.dev", displayName: "Bob Dev" },
];

describe("isConfirmedDevSelection", () => {
  it("confirms an empty selection (falls back to the current actor)", () => {
    expect(isConfirmedDevSelection("", CURRENT_ACTOR.id, CANDIDATES)).toBe(
      true
    );
  });

  it("confirms a selection unchanged from the current actor", () => {
    expect(
      isConfirmedDevSelection(CURRENT_ACTOR.id, CURRENT_ACTOR.id, CANDIDATES)
    ).toBe(true);
  });

  it("confirms a selection matching a real catalog candidate", () => {
    expect(
      isConfirmedDevSelection("jane.doe", CURRENT_ACTOR.id, CANDIDATES)
    ).toBe(true);
  });

  it("does not confirm an in-progress search fragment with no catalog match", () => {
    expect(isConfirmedDevSelection("ja", CURRENT_ACTOR.id, CANDIDATES)).toBe(
      false
    );
  });
});

describe("resolveDevActor", () => {
  it("resolves a confirmed catalog match to its display name", () => {
    const actor = resolveDevActor({
      selectedId: "jane.doe",
      currentActor: CURRENT_ACTOR,
      candidates: CANDIDATES,
      isAdmin: false,
    });
    expect(actor).toEqual({
      id: "jane.doe",
      name: "Jane Doe",
      roles: ["member"],
    });
  });

  it("falls back to the current actor's name when the id is unchanged and unmatched", () => {
    // Regression: previously fell back to the raw id (e.g. "heitorl")
    // instead of the actor's real name whenever the catalog mirror hadn't
    // loaded yet, silently corrupting the display name on every Save.
    const actor = resolveDevActor({
      selectedId: CURRENT_ACTOR.id,
      currentActor: CURRENT_ACTOR,
      candidates: [],
      isAdmin: true,
    });
    expect(actor).toEqual({
      id: CURRENT_ACTOR.id,
      name: CURRENT_ACTOR.name,
      roles: ["admin"],
    });
  });

  it("falls back to the raw id as the name for a genuinely new, unmatched id", () => {
    const actor = resolveDevActor({
      selectedId: "new-ldap-user",
      currentActor: CURRENT_ACTOR,
      candidates: [],
      isAdmin: false,
    });
    expect(actor).toEqual({
      id: "new-ldap-user",
      name: "new-ldap-user",
      roles: ["member"],
    });
  });

  it("defaults to the current actor's id when the selection is blank", () => {
    const actor = resolveDevActor({
      selectedId: "   ",
      currentActor: CURRENT_ACTOR,
      candidates: CANDIDATES,
      isAdmin: false,
    });
    expect(actor.id).toBe(CURRENT_ACTOR.id);
    expect(actor.name).toBe(CURRENT_ACTOR.name);
  });
});
