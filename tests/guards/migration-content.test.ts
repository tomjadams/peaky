import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getSQLiteMigrationSql,
  getSQLiteMigrations,
} from "../../shared/db/migrations";

describe("generated sqlite migration content module", () => {
  it("matches the checked-in SQL migration files exactly", () => {
    for (const migration of getSQLiteMigrations({
      includeLegacyInline: true,
    })) {
      const fileSql = readFileSync(
        join(process.cwd(), "shared/db/migrations/sqlite", migration.fileName),
        "utf8"
      );

      expect(getSQLiteMigrationSql(migration)).toBe(fileSql);
    }
  });

  it("marks the embedded migration module as generated", () => {
    const content = readFileSync(
      join(process.cwd(), "shared/db/migrations/sqlite-content.ts"),
      "utf8"
    );

    expect(content).toContain("// GENERATED FILE - DO NOT EDIT.");
    expect(content).toContain("scripts/generate-sqlite-migration-content.mjs");
  });
});
