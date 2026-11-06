import { describe, expect, it } from "vitest";
import {
  buildLifecycleActorHeaders,
  canManageProductLifecycle,
  canManageTemplateLifecycle,
  matchesLifecycleConfirmation,
  type LifecycleActor,
} from "~/lifecycle/management";

const adminActor: LifecycleActor = {
  id: "admin-1",
  name: "Admin",
  roles: ["admin"],
};

const memberActor: LifecycleActor = {
  id: "owner-1",
  name: "Owner",
  roles: ["member"],
};

describe("lifecycle management helpers", () => {
  it("allows product owners to manage product lifecycle", () => {
    expect(
      canManageProductLifecycle(memberActor, {
        productManagerId: "owner-1",
        engineeringLeadId: "lead-2",
      })
    ).toBe(true);
  });

  it("allows admins to manage product lifecycle", () => {
    expect(
      canManageProductLifecycle(adminActor, {
        productManagerId: "owner-1",
        engineeringLeadId: "lead-2",
      })
    ).toBe(true);
  });

  it.each([
    ["admin", adminActor],
    ["creator", { ...memberActor, id: "actor-creator" }],
    ["updater", { ...memberActor, id: "actor-updater" }],
    ["publisher", { ...memberActor, id: "actor-publisher" }],
    ["draft editor", { ...memberActor, id: "actor-editor" }],
    ["owner Team ID", { ...memberActor, id: "team-platform" }],
  ])(
    "does not grant Template lifecycle permission to the %s",
    (_label, actor) => {
      expect(canManageTemplateLifecycle(actor)).toBe(false);
    }
  );

  it("matches delete confirmation only when the name is exact", () => {
    expect(matchesLifecycleConfirmation("Peak Season", "Peak Season")).toBe(
      true
    );
    expect(matchesLifecycleConfirmation("Peak Season", "peak season")).toBe(
      false
    );
  });

  it("builds consistent lifecycle actor headers", () => {
    expect(buildLifecycleActorHeaders(adminActor)).toEqual({
      "x-actor-id": "admin-1",
      "x-actor-name": "Admin",
      "x-actor-roles": "admin",
    });
  });
});
