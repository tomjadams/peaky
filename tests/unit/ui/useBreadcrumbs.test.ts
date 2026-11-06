import { describe, it, expect, beforeEach } from "vitest";
import { useBreadcrumbs } from "~/composables/nav/useBreadcrumbs";

describe("useBreadcrumbs", () => {
  beforeEach(() => {
    const { resetBreadcrumbs } = useBreadcrumbs();
    resetBreadcrumbs();
  });

  describe("initial state", () => {
    it("should default to the Home root crumb", () => {
      const { breadcrumbs } = useBreadcrumbs();

      expect(breadcrumbs.value).toHaveLength(1);
      expect(breadcrumbs.value[0]?.label).toBe("Home");
      expect(breadcrumbs.value[0]?.to).toBe("/");
    });
  });

  describe("setBreadcrumbs", () => {
    it("should set custom breadcrumbs", () => {
      const { setBreadcrumbs, breadcrumbs } = useBreadcrumbs();

      setBreadcrumbs([
        { label: "Dashboard", to: "/" },
        { label: "Applications", to: "/applications" },
        { label: "App Details" },
      ]);

      expect(breadcrumbs.value).toHaveLength(3);
      expect(breadcrumbs.value[1]?.label).toBe("Applications");
      expect(breadcrumbs.value[2]?.label).toBe("App Details");
    });

    it("should reset to default when called with empty array", () => {
      const { setBreadcrumbs, breadcrumbs } = useBreadcrumbs();

      setBreadcrumbs([
        { label: "Dashboard", to: "/" },
        { label: "Custom Page" },
      ]);
      setBreadcrumbs([]);

      expect(breadcrumbs.value).toHaveLength(1);
      expect(breadcrumbs.value[0]?.label).toBe("Home");
    });

    it("should reset to default when called with undefined", () => {
      const { setBreadcrumbs, breadcrumbs } = useBreadcrumbs();

      setBreadcrumbs([
        { label: "Dashboard", to: "/" },
        { label: "Custom Page" },
      ]);
      setBreadcrumbs(undefined);

      expect(breadcrumbs.value).toHaveLength(1);
      expect(breadcrumbs.value[0]?.label).toBe("Home");
    });

    it("should handle breadcrumbs without 'to' property", () => {
      const { setBreadcrumbs, breadcrumbs } = useBreadcrumbs();

      setBreadcrumbs([
        { label: "Dashboard", to: "/" },
        { label: "Current Page" }, // No link - it's the current page
      ]);

      expect(breadcrumbs.value[1]?.to).toBeUndefined();
    });
  });

  describe("resetBreadcrumbs", () => {
    it("should reset to default breadcrumbs", () => {
      const { setBreadcrumbs, resetBreadcrumbs, breadcrumbs } =
        useBreadcrumbs();

      setBreadcrumbs([
        { label: "Dashboard", to: "/" },
        { label: "Templates", to: "/templates" },
        { label: "Edit Template" },
      ]);

      resetBreadcrumbs();

      expect(breadcrumbs.value).toHaveLength(1);
      expect(breadcrumbs.value[0]?.label).toBe("Home");
    });
  });

  describe("shared state", () => {
    it("should share state across multiple composable calls", () => {
      const first = useBreadcrumbs();
      const second = useBreadcrumbs();

      first.setBreadcrumbs([
        { label: "Dashboard", to: "/" },
        { label: "Shared Page" },
      ]);

      expect(second.breadcrumbs.value).toHaveLength(2);
      expect(second.breadcrumbs.value[1]?.label).toBe("Shared Page");
    });
  });
});
