import { describe, expect, it } from "vitest";
import { resolveActorDisplayName } from "~/utils/recentChangesRows";

const currentActor = { id: "okta-sub-1", name: "Heitor Lessa" };

describe("resolveActorDisplayName", () => {
  it("prefers a catalog display name", () => {
    expect(
      resolveActorDisplayName("heitorl", currentActor, "Heitor Lessa")
    ).toBe("Heitor Lessa");
  });

  it("uses the current actor name for an opaque session ID", () => {
    expect(resolveActorDisplayName("okta-sub-1", currentActor)).toBe(
      "Heitor Lessa"
    );
  });

  it("keeps the existing readable fallback for unknown actors", () => {
    expect(resolveActorDisplayName("actor_bob", currentActor)).toBe("Bob");
  });
});
