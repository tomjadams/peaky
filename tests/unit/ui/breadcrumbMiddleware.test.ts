import { describe, it, expect, beforeEach } from "vitest";
import {
  getDefaultRootBreadcrumb,
  useBreadcrumbs,
} from "~/composables/nav/useBreadcrumbs";

describe("getDefaultRootBreadcrumb — known top-level routes", () => {
  beforeEach(() => {
    const { resetBreadcrumbs } = useBreadcrumbs();
    resetBreadcrumbs();
  });

  it.each([
    ["/products/product-001", "Products", "/products"],
    ["/products/product-001/reviews/r-1", "Products", "/products"],
    ["/products/product-001/reviews/r-1/assessment", "Products", "/products"],
    ["/applications/app-001", "Applications", "/applications"],
    ["/teams/team-001", "Teams", "/teams"],
    ["/templates/template-001", "Templates", "/templates"],
    ["/system", "System", "/system"],
    ["/events", "Events", "/events"],
  ])("%s resolves to {%s, %s}", (path: string, label: string, to: string) => {
    const root = getDefaultRootBreadcrumb(path);
    expect(root.label).toBe(label);
    expect(root.to).toBe(to);
  });

  it("/ resolves to Home", () => {
    const root = getDefaultRootBreadcrumb("/");
    expect(root.label).toBe("Home");
    expect(root.to).toBe("/");
  });
});

describe("getDefaultRootBreadcrumb — label overrides", () => {
  it("applies the Event Schemas override for /schemas (auto-derive would yield 'Schemas')", () => {
    const root = getDefaultRootBreadcrumb("/schemas/ProductCreated.v1");
    expect(root.label).toBe("Event Schemas");
    expect(root.to).toBe("/schemas");
  });
});

describe("getDefaultRootBreadcrumb — auto-derived fallback", () => {
  // The previous implementation silently fell back to "Teams" for any
  // unrecognised path, which produced "Teams > System" on /system. The
  // shipped behaviour derives the label from the first path segment so
  // the breadcrumb always matches the URL the user is on, even before a
  // newly-added top-level route is registered.

  it("derives capitalised label from the first path segment when no override exists", () => {
    const root = getDefaultRootBreadcrumb("/settings");
    expect(root.label).toBe("Settings");
    expect(root.to).toBe("/settings");
  });

  it("never falls back to a different top-level section (regression for /admin → 'Teams')", () => {
    const root = getDefaultRootBreadcrumb("/admin/anything");
    expect(root.label).not.toBe("Teams");
    expect(root.label).toBe("Admin");
    expect(root.to).toBe("/admin");
  });

  it("uses only the FIRST path segment, not the deepest", () => {
    const root = getDefaultRootBreadcrumb("/foo/bar/baz");
    expect(root.label).toBe("Foo");
    expect(root.to).toBe("/foo");
  });

  it("returns Home when the path is empty", () => {
    const root = getDefaultRootBreadcrumb("");
    expect(root.label).toBe("Home");
    expect(root.to).toBe("/");
  });
});

describe("useBreadcrumbs integration", () => {
  beforeEach(() => {
    const { resetBreadcrumbs } = useBreadcrumbs();
    resetBreadcrumbs();
  });

  it("setBreadcrumbs pins the override; root breadcrumb composes when route breadcrumbs are present", () => {
    const { setBreadcrumbs, breadcrumbs } = useBreadcrumbs();
    const root = getDefaultRootBreadcrumb("/products/product-001");
    setBreadcrumbs([
      root,
      { label: "001", to: "/products/product-001" },
      { label: "Overview" },
    ]);

    expect(breadcrumbs.value[0]?.label).toBe("Products");
    expect(breadcrumbs.value[0]?.to).toBe("/products");
    expect(breadcrumbs.value[1]?.label).toBe("001");
    expect(breadcrumbs.value[2]?.label).toBe("Overview");
  });
});
