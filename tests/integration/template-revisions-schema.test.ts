import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { assertTargetConstraints } from "./helpers/template-revisions-schema-assertions";
import {
  REMOVED_LEGACY_TABLES,
  RESET_DOMAIN_TABLES,
  applyAllMigrations,
  readColumns,
  readForeignKeys,
  readIndexes,
  readTableDdl,
  readTableInfo,
  readTableNames,
} from "./helpers/template-revisions-migration";

describe("Template Revision SQLite schema", () => {
  it("installs the constrained schema on a fresh database", () => {
    const sqlite = new Database(":memory:");

    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      const tableNames = readTableNames(sqlite);

      for (const table of RESET_DOMAIN_TABLES) {
        expect.soft(tableNames, `${table} must exist`).toContain(table);
      }
      for (const table of REMOVED_LEGACY_TABLES) {
        expect.soft(tableNames, `${table} must be gone`).not.toContain(table);
      }

      if (!tableNames.includes("template_revisions")) return;

      expect(readColumns(sqlite, "templates")).toEqual(
        expect.arrayContaining([
          "id",
          "name",
          "description",
          "status",
          "owner_team_id",
          "created_by_actor_id",
          "updated_by_actor_id",
          "created_at",
          "updated_at",
        ])
      );
      expect(readColumns(sqlite, "template_revisions")).toEqual(
        expect.arrayContaining([
          "id",
          "template_id",
          "name",
          "description",
          "status",
          "revision_number",
          "revision_summary",
          "created_by_actor_id",
          "updated_by_actor_id",
          "published_by_actor_id",
          "created_at",
          "updated_at",
          "published_at",
        ])
      );
      expect(readColumns(sqlite, "template_revision_imports")).toEqual([
        "id",
        "template_revision_id",
        "source_type",
        "source_file",
        "imported_at",
        "conflicts",
        "resolved",
      ]);

      const revisionDdl = readTableDdl(sqlite, "template_revisions");
      expect(revisionDdl).toContain("'draft'");
      expect(revisionDdl).toContain("'published'");
      expect(revisionDdl).toContain("'retired'");
      expect(revisionDdl).toContain("revision_number > 0");
      expect(revisionDdl).toContain("length(trim(revision_summary)) <= 120");
      expect(revisionDdl).toContain("published_by_actor_id");

      const revisionIndexes = readIndexes(sqlite, "template_revisions");
      expect(revisionIndexes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            unique: 1,
            sql: expect.stringContaining("WHERE status = 'draft'"),
          }),
          expect.objectContaining({
            unique: 1,
            sql: expect.stringContaining("WHERE status = 'published'"),
          }),
          expect.objectContaining({
            unique: 1,
            sql: expect.stringContaining("revision_number"),
          }),
        ])
      );

      const selectionColumns = readTableInfo(
        sqlite,
        "review_template_selections"
      );
      expect(
        selectionColumns
          .filter(({ pk }) => pk > 0)
          .toSorted((a, b) => a.pk - b.pk)
          .map(({ name }) => name)
      ).toEqual(["review_id", "template_revision_id"]);
      expect(selectionColumns.map(({ name }) => name)).not.toContain("id");
      const questionForeignKeys = readForeignKeys(sqlite, "template_questions");
      expect(questionForeignKeys).toContainEqual(
        expect.objectContaining({
          from: "pillar_id",
          table: "template_pillars",
        })
      );
      expect(questionForeignKeys.map(({ from }) => from)).not.toContain(
        "template_revision_id"
      );
      expect(readForeignKeys(sqlite, "template_pillars")).toContainEqual(
        expect.objectContaining({
          from: "template_revision_id",
          table: "template_revisions",
        })
      );
      expect(
        readForeignKeys(sqlite, "template_revision_imports")
      ).toContainEqual(
        expect.objectContaining({
          from: "template_revision_id",
          table: "template_revisions",
        })
      );
      expect(
        readForeignKeys(sqlite, "review_template_selections")
      ).toContainEqual(
        expect.objectContaining({
          from: "template_revision_id",
          table: "template_revisions",
          on_delete: "RESTRICT",
        })
      );

      assertTargetConstraints(sqlite);
    } finally {
      sqlite.close();
    }
  });
});
