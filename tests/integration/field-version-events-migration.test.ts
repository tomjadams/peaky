import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  getSQLiteMigrations,
  getSQLiteMigrationSql,
  splitMigrationStatements,
} from "../../shared/db/migrations";

describe("field version events migration", () => {
  it("preserves field history while restoring current-state uniqueness", () => {
    const sqlite = new Database(":memory:");

    try {
      sqlite.pragma("foreign_keys = ON");
      const migrations = getSQLiteMigrations();
      const seedMigrations = migrations.filter(
        (migration) => migration.id < "0013_field_version_events"
      );
      const migration0013 = migrations.find(
        (migration) => migration.id === "0013_field_version_events"
      );

      expect(migration0013).toBeDefined();

      for (const migration of seedMigrations) {
        for (const statement of splitMigrationStatements(
          getSQLiteMigrationSql(migration)
        )) {
          sqlite.exec(statement);
        }
      }

      insertOldFieldVersion(sqlite, {
        id: "fv-1",
        eventId: "evt-1",
        value: '{"checked":["a","b"],"na":[]}',
        previousValue: null,
        hlc: "1000:0001:actor_alice",
        updatedAt: "2026-06-01T10:00:00.000Z",
      });
      insertOldFieldVersion(sqlite, {
        id: "fv-2",
        eventId: "evt-2",
        value: '{"checked":[],"na":[]}',
        previousValue: '{"checked":["a","b"],"na":[]}',
        hlc: "2000:0001:actor_alice",
        updatedAt: "2026-06-01T10:00:10.000Z",
      });

      for (const statement of splitMigrationStatements(
        getSQLiteMigrationSql(migration0013!)
      )) {
        sqlite.exec(statement);
      }

      const currentRows = sqlite
        .prepare("SELECT value FROM field_versions")
        .all() as Array<{ value: string }>;
      expect(currentRows).toEqual([{ value: '{"checked":[],"na":[]}' }]);
      expect(tableDdl(sqlite, "field_versions")).not.toContain("event_id");
      expect(tableDdl(sqlite, "field_versions")).not.toContain(
        "previous_value"
      );
      expect(indexNames(sqlite, "field_versions")).toContain(
        "field_versions_entity_field_unique"
      );

      const historyRows = sqlite
        .prepare(
          "SELECT event_id, value, previous_value FROM field_version_events ORDER BY updated_at"
        )
        .all() as Array<{
        event_id: string;
        value: string;
        previous_value: string | null;
      }>;
      expect(historyRows).toEqual([
        {
          event_id: "evt-1",
          value: '{"checked":["a","b"],"na":[]}',
          previous_value: null,
        },
        {
          event_id: "evt-2",
          value: '{"checked":[],"na":[]}',
          previous_value: '{"checked":["a","b"],"na":[]}',
        },
      ]);
      expect(tableDdl(sqlite, "field_version_events")).toContain(
        "previous_value"
      );
      expect(indexNames(sqlite, "field_version_events")).toContain(
        "field_version_events_event_field_unique"
      );

      expect(() => insertDuplicateCurrentFieldVersion(sqlite)).toThrow();
    } finally {
      sqlite.close();
    }
  });
});

function insertOldFieldVersion(
  sqlite: Database.Database,
  row: {
    id: string;
    eventId: string;
    value: string;
    previousValue: string | null;
    hlc: string;
    updatedAt: string;
  }
): void {
  sqlite
    .prepare(
      `INSERT INTO field_versions (
        id, event_id, entity_type, entity_id, field_name, value,
        previous_value, hlc, actor_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.id,
      row.eventId,
      "review_answer",
      "rev-1:q-1",
      "answer",
      row.value,
      row.previousValue,
      row.hlc,
      "actor_alice",
      row.updatedAt
    );
}

function tableDdl(sqlite: Database.Database, tableName: string): string {
  const row = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { sql: string };
  return row.sql;
}

function indexNames(sqlite: Database.Database, tableName: string): string[] {
  return (
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ?"
      )
      .all(tableName) as Array<{ name: string }>
  ).map((row) => row.name);
}

function insertDuplicateCurrentFieldVersion(sqlite: Database.Database): void {
  sqlite
    .prepare(
      `INSERT INTO field_versions (
        id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      "fv-duplicate",
      "review_answer",
      "rev-1:q-1",
      "answer",
      '"yes"',
      "3000:0001:actor_alice",
      "actor_alice",
      "2026-06-01T10:00:20.000Z"
    );
}
