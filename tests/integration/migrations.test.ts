import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { getDatabase, getSqlite, resetDatabase } from "../../server/db";
import {
  getSQLiteMigrations,
  getSQLiteMigrationSql,
  SQLITE_MIGRATIONS_TABLE,
  shouldIncludeLegacyInlineMigration,
  splitMigrationStatements,
} from "../../shared/db/migrations";
import {
  actorType,
  eventStatus,
  eventSource,
} from "../../shared/db/schema/event";
import {
  questionType,
  riskLevel,
  templateRevisionStatus,
  templateStatus,
} from "../../shared/db/schema/template";
import {
  handoffAssociationAction,
  handoffSelectionState,
  maturityOverrideAction,
} from "../../shared/db/schema/review";
import {
  localReviewHandoffCompletionMode,
  localReviewHandoffStatus,
} from "../../shared/db/schema/local";
import { assertEnumChecks } from "./migrationCheckHelpers";

describe("shared sqlite migrations", () => {
  beforeEach(() => {
    resetDatabase();
  });

  it("exposes ordered legacy and standard migration files", () => {
    const migrations = getSQLiteMigrations({ includeLegacyInline: true });
    const ids = migrations.map((migration) => migration.id);

    // Legacy client upgrade is always first.
    expect(ids[0]).toBe("0000_legacy_inline_client_upgrade");

    // Standard migrations follow in strict ascending order (catches gaps,
    // duplicates, and out-of-order registrations without needing a hardcoded
    // snapshot that breaks on every new migration).
    const standardIds = ids.slice(1);
    expect(standardIds).toEqual([...standardIds].toSorted());

    // Every standard migration registered in index.ts must appear.
    const standardMigrations = getSQLiteMigrations({
      includeLegacyInline: false,
    });
    expect(standardIds).toEqual(standardMigrations.map((m) => m.id));
  });

  it("only enables the legacy client upgrade for the expected legacy schema shape", () => {
    expect(
      shouldIncludeLegacyInlineMigration({
        hasSchemaVersionTable: true,
        entitlementSnapshotColumns: ["id", "actor_id", "expires_at"],
        pendingReviewQueueColumns: ["id", "local_data", "remote_data"],
      })
    ).toBe(true);

    expect(
      shouldIncludeLegacyInlineMigration({
        hasSchemaVersionTable: true,
        entitlementSnapshotColumns: ["id", "actor_id", "refresh_at"],
        pendingReviewQueueColumns: ["id", "local_payload", "remote_payload"],
      })
    ).toBe(false);

    expect(
      shouldIncludeLegacyInlineMigration({
        hasSchemaVersionTable: false,
        entitlementSnapshotColumns: ["id", "actor_id", "expires_at"],
        pendingReviewQueueColumns: ["id", "local_data", "remote_data"],
      })
    ).toBe(false);
  });

  it("server runtime applies the standard shared migrations", () => {
    getDatabase();

    const sqlite = getSqlite();
    expect(sqlite).not.toBeNull();

    const tableNames = (
      sqlite!
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    expect(tableNames).toContain(SQLITE_MIGRATIONS_TABLE);
    expect(tableNames).toContain("subjects");
    expect(tableNames).toContain("team_profiles");
    expect(tableNames).toContain("pending_review_queue");
    expect(tableNames).not.toContain("template_rules");
    expect(tableNames).not.toContain("template_draft_rules");

    const appliedMigrationIds = (
      sqlite!
        .prepare(`SELECT id FROM ${SQLITE_MIGRATIONS_TABLE} ORDER BY id`)
        .all() as Array<{ id: string }>
    ).map((row) => row.id);

    // Compare against the registered migration list dynamically — no hardcoded
    // snapshot to update whenever a new migration is added.
    const expectedIds = getSQLiteMigrations({ includeLegacyInline: false }).map(
      (m) => m.id
    );
    expect(appliedMigrationIds).toEqual(expectedIds);

    const pendingReviewColumns = (
      sqlite!
        .prepare("PRAGMA table_info('pending_review_queue')")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    expect(pendingReviewColumns).toContain("local_payload");
    expect(pendingReviewColumns).toContain("remote_payload");
    expect(pendingReviewColumns).not.toContain("local_data");
    expect(pendingReviewColumns).not.toContain("remote_data");

    const directoryUserColumns = (
      sqlite!.prepare("PRAGMA table_info('directory_users')").all() as Array<{
        name: string;
      }>
    ).map((row) => row.name);

    expect(directoryUserColumns).toContain("display_name");
    expect(directoryUserColumns).toContain("source_version");
  });

  it("events CHECK constraints match the Drizzle schema enum values", () => {
    // This test is the deterministic guard against the class of bug where a
    // Drizzle schema enum is renamed without a corresponding migration.
    // E2e tests create a fresh DB and always apply every migration, so they
    // never exercise an existing client DB with stale CHECK constraints.
    // This unit test catches the mismatch at `pnpm test` time.
    //
    // When you change an enum value in shared/db/schema/event.ts, you MUST:
    //   1. Write a new SQL migration that recreates the table with updated CHECKs
    //   2. Register it in shared/db/migrations/index.ts
    //   3. Regenerate shared/db/migrations/sqlite-content.ts (pnpm migrations:generate-content)
    getDatabase();
    const sqlite = getSqlite()!;

    const row = sqlite
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'events'"
      )
      .get() as { sql: string };

    const ddl = row.sql;

    for (const value of actorType) {
      expect(ddl, `actor_type CHECK must include '${value}'`).toContain(
        `'${value}'`
      );
    }

    for (const value of eventStatus) {
      expect(ddl, `status CHECK must include '${value}'`).toContain(
        `'${value}'`
      );
    }

    for (const value of eventSource) {
      expect(ddl, `source CHECK must include '${value}'`).toContain(
        `'${value}'`
      );
    }

    // Explicit regression guard: old source values must not appear.
    expect(ddl, "old source value 'local-first' must not appear").not.toContain(
      "'local-first'"
    );
    expect(ddl, "old source value 'remote' must not appear").not.toContain(
      "'remote'"
    );
  });

  it("renames domain_events to events with the new index prefix", () => {
    // Regression guard for migration 0009_rename_domain_events_to_events.
    // After all migrations apply: the table is named `events`, the four
    // indexes use the `events_*` prefix, and the legacy `domain_events_*`
    // indexes are gone. ALTER TABLE RENAME TO preserves rows, so a
    // table-shape check is sufficient — no data-survival fixture needed.
    getDatabase();
    const sqlite = getSqlite()!;

    const tableNames = (
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    expect(tableNames).toContain("events");
    expect(tableNames).not.toContain("domain_events");

    const indexNames = (
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'events'"
        )
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    expect(indexNames).toContain("events_review_idx");
    expect(indexNames).toContain("events_time_idx");
    expect(indexNames).toContain("events_status_idx");
    expect(indexNames).toContain("events_entity_time_idx");

    // Legacy indexes were dropped — they MUST NOT exist on any table.
    const allIndexNames = (
      sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    expect(allIndexNames).not.toContain("domain_events_review_idx");
    expect(allIndexNames).not.toContain("domain_events_time_idx");
    expect(allIndexNames).not.toContain("domain_events_status_idx");
    expect(allIndexNames).not.toContain("domain_events_entity_time_idx");
  });

  it("adds CloudEvents envelope columns and 'local' status (migration 0010)", () => {
    // Regression guard for migration 0010: events table gains specversion,
    // dataschema, client_id columns and the status enum CHECK constraint
    // grows to include 'local' (so events flagged `local: true` in the
    // catalog can persist with status='local').
    getDatabase();
    const sqlite = getSqlite()!;

    const columns = sqlite
      .prepare("PRAGMA table_info('events')")
      .all() as Array<{
      name: string;
      type: string;
      dflt_value: string | null;
      notnull: number;
    }>;
    const columnNames = columns.map((column) => column.name);

    expect(columnNames).toContain("specversion");
    expect(columnNames).toContain("dataschema");
    expect(columnNames).toContain("client_id");

    // specversion is NOT NULL with DEFAULT '1.0' so existing rows survive
    // and new rows without an explicit specversion still satisfy the schema.
    const specversionColumn = columns.find(
      (column) => column.name === "specversion"
    );
    expect(specversionColumn?.notnull).toBe(1);
    expect(specversionColumn?.dflt_value).toBe("'1.0'");

    // dataschema and client_id remain nullable — legacy rows have NULL.
    expect(
      columns.find((column) => column.name === "dataschema")?.notnull
    ).toBe(0);
    expect(columns.find((column) => column.name === "client_id")?.notnull).toBe(
      0
    );

    // CHECK-constraint coverage for 'local' lives in the schema-contract test
    // above — that test iterates `eventStatus` and asserts every value is in
    // the CHECK. Re-asserting the literal here would duplicate that guard.
  });

  it("Template Revision CHECK constraints match the Drizzle schema enum values", () => {
    getDatabase();
    const sqlite = getSqlite()!;
    assertEnumChecks(sqlite, [
      { table: "templates", field: "status", values: templateStatus },
      {
        table: "template_revisions",
        field: "status",
        values: templateRevisionStatus,
      },
      { table: "template_questions", field: "type", values: questionType },
      { table: "template_questions", field: "risk_level", values: riskLevel },
    ]);

    const questionDdl = sqlite
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'template_questions'"
      )
      .get() as { sql: string };
    expect(
      questionDdl.sql,
      "old risk_level value 'low' must not appear"
    ).not.toContain("'low'");
  });

  it("review-child CHECK constraints match the Drizzle schema enum values", () => {
    // Apply the Template Revision enum guard to every constrained maturity and
    // handoff enum, including local lifecycle state.
    getDatabase();
    assertEnumChecks(getSqlite()!, [
      {
        table: "review_maturity_overrides",
        field: "action",
        values: maturityOverrideAction,
      },
      {
        table: "review_handoff_practices",
        field: "selection_state",
        values: handoffSelectionState,
      },
      {
        table: "review_handoff_associations",
        field: "action",
        values: handoffAssociationAction,
      },
      {
        table: "local_review_handoffs",
        field: "status",
        values: localReviewHandoffStatus,
      },
      {
        table: "local_review_handoffs",
        field: "completion_mode",
        values: localReviewHandoffCompletionMode,
      },
    ]);
  });

  it("adds local handoff history and immutable practice ownership columns", () => {
    getDatabase();
    const sqlite = getSqlite()!;
    const lifecycleTable = sqlite
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'local_review_handoffs'"
      )
      .get() as { sql: string } | undefined;
    const practiceColumns = sqlite
      .prepare("PRAGMA table_info(review_handoff_practices)")
      .all() as { name: string }[];
    const lifecycleIndexes = sqlite
      .prepare("PRAGMA index_list(local_review_handoffs)")
      .all() as { name: string }[];

    expect(lifecycleTable?.sql).toContain("selected_practice_ids");
    expect(practiceColumns.map((column) => column.name)).toContain(
      "local_handoff_id"
    );
    expect(lifecycleIndexes.map((index) => index.name)).toContain(
      "local_review_handoffs_active_review_unique"
    );
  });

  it("promotes existing low-severity template rows to medium during migration 0011", () => {
    const sqlite = new Database(":memory:");

    try {
      sqlite.pragma("foreign_keys = ON");
      const migrations = getSQLiteMigrations();
      const seedMigrations = migrations.filter(
        (migration) => migration.id < "0011_remove_low_severity"
      );
      const migration0011 = migrations.find(
        (migration) => migration.id === "0011_remove_low_severity"
      );

      expect(migration0011).toBeDefined();

      for (const migration of seedMigrations) {
        for (const statement of splitMigrationStatements(
          getSQLiteMigrationSql(migration)
        )) {
          sqlite.exec(statement);
        }
      }

      const now = "2026-05-16T00:00:00.000Z";

      sqlite
        .prepare(
          `
          INSERT INTO template_drafts (
            id, name, version, status, description, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run("draft-low", "Low severity draft", "v1", "draft", "", now, now);

      sqlite
        .prepare(
          `
          INSERT INTO template_draft_pillars (
            id, draft_id, name, slug, description, order_key, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          "draft-pillar-low",
          "draft-low",
          "Reliability",
          "reliability",
          "",
          "001",
          now,
          now
        );

      sqlite
        .prepare(
          `
          INSERT INTO template_draft_questions (
            id, draft_id, pillar_id, order_key, type, text, risk_level,
            importance, checklist_items, leading_practices, helpful_links,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          "draft-question-low",
          "draft-low",
          "draft-pillar-low",
          "001",
          "yes-no",
          "Legacy low draft question",
          "low",
          "",
          "[]",
          "[]",
          "[]",
          now,
          now
        );

      sqlite
        .prepare(
          `
          INSERT INTO templates (
            id, name, description, status, created_at, updated_at, published_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          "template-low",
          "Low severity template",
          "",
          "active",
          now,
          now,
          now
        );

      sqlite
        .prepare(
          `
          INSERT INTO template_versions (
            id, template_id, version_label, status, created_at, published_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `
        )
        .run("template-version-low", "template-low", "v1", "active", now, now);

      sqlite
        .prepare(
          `
          INSERT INTO template_pillars (
            id, template_version_id, slug, name, description, order_key,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          "template-pillar-low",
          "template-version-low",
          "reliability",
          "Reliability",
          "",
          "001",
          now,
          now
        );

      sqlite
        .prepare(
          `
          INSERT INTO template_questions (
            id, pillar_id, order_key, text, type, risk_level, importance,
            checklist_items, leading_practices, helpful_links, created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          "template-question-low",
          "template-pillar-low",
          "001",
          "Legacy low published question",
          "yes-no",
          "low",
          "",
          "[]",
          "[]",
          "[]",
          now,
          now
        );

      for (const statement of splitMigrationStatements(
        getSQLiteMigrationSql(migration0011!)
      )) {
        sqlite.exec(statement);
      }

      expect(
        sqlite
          .prepare("SELECT risk_level FROM template_questions WHERE id = ?")
          .get("template-question-low")
      ).toEqual({ risk_level: "medium" });
      expect(
        sqlite
          .prepare(
            "SELECT risk_level FROM template_draft_questions WHERE id = ?"
          )
          .get("draft-question-low")
      ).toEqual({ risk_level: "medium" });
    } finally {
      sqlite.close();
    }
  });
});
