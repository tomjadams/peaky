import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { getSQLiteMigrations } from "../../shared/db/migrations";
import {
  readPreservedState,
  seedLegacyState,
} from "./helpers/template-revisions-legacy-fixture";
import {
  REMOVED_LEGACY_TABLES,
  RESET_DOMAIN_TABLES,
  TARGET_MIGRATION_ID,
  applyMigration,
  applyMigrationsBefore,
  readEntityTypes,
  readEventTypes,
  readTableNames,
  rowCount,
} from "./helpers/template-revisions-migration";

describe("Template Revision SQLite migration", () => {
  it("resets legacy Template and Review state while preserving unrelated data", () => {
    const sqlite = new Database(":memory:");

    try {
      sqlite.pragma("foreign_keys = ON");
      applyMigrationsBefore(sqlite, TARGET_MIGRATION_ID);
      seedLegacyState(sqlite);
      const preservedBefore = readPreservedState(sqlite);

      const migration = getSQLiteMigrations().find(
        ({ id }) => id === TARGET_MIGRATION_ID
      );
      expect(
        migration,
        `${TARGET_MIGRATION_ID} must be registered before this contract can pass`
      ).toBeDefined();
      if (!migration) return;

      applyMigration(sqlite, migration);

      const tableNames = readTableNames(sqlite);
      for (const table of REMOVED_LEGACY_TABLES) {
        expect(tableNames, `${table} must be removed`).not.toContain(table);
      }
      for (const table of RESET_DOMAIN_TABLES) {
        expect(
          tableNames,
          `${table} must exist in the target schema`
        ).toContain(table);
        expect(rowCount(sqlite, table), `${table} must be reset`).toBe(0);
      }

      expect(rowCount(sqlite, "entitlement_snapshots")).toBe(0);
      const preservedEntityTypes = ["product", "template_revision"];
      expect(readEntityTypes(sqlite, "local_outbox")).toEqual(
        preservedEntityTypes
      );
      expect(readEntityTypes(sqlite, "pending_review_queue")).toEqual(
        preservedEntityTypes
      );
      expect(readEntityTypes(sqlite, "field_versions")).toEqual(
        preservedEntityTypes
      );
      expect(readEntityTypes(sqlite, "field_version_events")).toEqual(
        preservedEntityTypes
      );
      expect(readEventTypes(sqlite)).toEqual([
        "ClientSchemaMigrated.v1",
        "ProductUpdated.v1",
        "TemplateRevisionCached.v1",
      ]);
      expect(
        sqlite
          .prepare("SELECT id FROM events WHERE id = ?")
          .get("event-review-id-reset")
      ).toBeUndefined();
      expect(
        sqlite
          .prepare("SELECT id FROM events WHERE id = ?")
          .get("event-product-preserved")
      ).toEqual({ id: "event-product-preserved" });
      expect(readPreservedState(sqlite)).toEqual(preservedBefore);
      expect(
        sqlite
          .prepare("SELECT id FROM __orr_sqlite_migrations WHERE id = ?")
          .get(TARGET_MIGRATION_ID)
      ).toEqual({ id: TARGET_MIGRATION_ID });
      expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    } finally {
      sqlite.close();
    }
  });
});
