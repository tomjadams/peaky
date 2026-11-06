/**
 * Pinning the human-display contract for event-type labels. The formatter
 * splits PascalCase + delimiters and capitalises words, AND preserves
 * known acronyms ("DB", "OPFS", "URL", "API", "JSON", "HTTP", "ID") in
 * full uppercase — without this, "LocalDbInitializing.v1" would render as
 * the awkward "Local Db Initializing".
 */
import { describe, it, expect } from "vitest";
import { formatAdminEventLabel } from "~/admin/events";

describe("formatAdminEventLabel", () => {
  it("strips the .v1 version suffix and splits PascalCase", () => {
    expect(formatAdminEventLabel("ReviewArchived.v1")).toBe("Review Archived");
  });

  it("preserves the DB acronym (Local Db → Local DB)", () => {
    expect(formatAdminEventLabel("LocalDbInitializing.v1")).toBe(
      "Local DB Initializing"
    );
    expect(formatAdminEventLabel("LocalDbReady.v1")).toBe("Local DB Ready");
    expect(formatAdminEventLabel("LocalDbBootstrapStarted.v1")).toBe(
      "Local DB Bootstrap Started"
    );
    expect(formatAdminEventLabel("LocalDbMigrationFailed.v1")).toBe(
      "Local DB Migration Failed"
    );
    expect(formatAdminEventLabel("LocalDbRecreated.v1")).toBe(
      "Local DB Recreated"
    );
  });

  it("preserves the OPFS acronym", () => {
    expect(formatAdminEventLabel("OpfsStorageMeasured.v1")).toBe(
      "OPFS Storage Measured"
    );
    expect(formatAdminEventLabel("OpfsQuotaWarning.v1")).toBe(
      "OPFS Quota Warning"
    );
  });

  it("handles snake_case entity types", () => {
    expect(formatAdminEventLabel("local_db")).toBe("Local DB");
    expect(formatAdminEventLabel("review_answer")).toBe("Review Answer");
  });

  it("works for unversioned strings (entity types)", () => {
    expect(formatAdminEventLabel("product")).toBe("Product");
    expect(formatAdminEventLabel("template")).toBe("Template");
  });
});
