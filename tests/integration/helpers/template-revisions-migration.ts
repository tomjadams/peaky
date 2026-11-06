import type Database from "better-sqlite3";
import {
  getSQLiteMigrations,
  getSQLiteMigrationSql,
  splitMigrationStatements,
} from "../../../shared/db/migrations";

export const TARGET_MIGRATION_ID = "0016_template_revisions";
export const NOW = "2026-08-18T00:00:00.000Z";

export const RESET_ENTITY_TYPES = [
  "review",
  "review_checkpoint",
  "review_answer",
  "review_note",
  "review_attachment",
  "template",
  "template_version",
  "template_pillar",
  "template_question",
  "template_draft",
  "template_draft_pillar",
  "template_draft_question",
] as const;

export const RESET_EVENT_TYPES = [
  "ReviewAnswerRecorded.v1",
  "ReviewCheckpointSaved.v1",
  "ReviewNoteRecorded.v1",
  "ReviewNoteDeleted.v1",
  "ReviewAttachmentUploaded.v1",
  "ReviewAttachmentDeleted.v1",
  "ReviewProgressUpdated.v1",
  "ReviewCreated.v1",
  "ReviewArchived.v1",
  "ReviewRestored.v1",
  "ReviewDeleted.v1",
  "TemplateDraftCreated.v1",
  "TemplateDraftUpdated.v1",
  "TemplateDraftDeleted.v1",
  "TemplatePublished.v1",
  "TemplateImported.v1",
  "TemplatePillarCreated.v1",
  "TemplatePillarUpdated.v1",
  "TemplatePillarDeleted.v1",
  "TemplateQuestionCreated.v1",
  "TemplateQuestionUpdated.v1",
  "TemplateQuestionDeleted.v1",
] as const;

export const RESET_DOMAIN_TABLES = [
  "templates",
  "template_revisions",
  "template_pillars",
  "template_questions",
  "template_revision_imports",
  "reviews",
  "review_template_selections",
  "review_answer_state",
  "review_note_state",
  "review_attachments",
  "review_score_state",
  "review_participants",
  "draft_answer_imports",
  "draft_answer_evidence",
] as const;

export const REMOVED_LEGACY_TABLES = [
  "template_versions",
  "template_drafts",
  "template_draft_pillars",
  "template_draft_questions",
  "template_draft_imports",
] as const;

export function applyMigrationsBefore(
  sqlite: Database.Database,
  migrationId: string
): void {
  for (const migration of getSQLiteMigrations().filter(
    ({ id }) => id < migrationId
  )) {
    applyMigration(sqlite, migration);
  }
}

export function applyAllMigrations(sqlite: Database.Database): void {
  ensureMigrationRegistry(sqlite);
  const migrations = getSQLiteMigrations();
  sqlite.transaction(() => {
    for (const migration of migrations) {
      for (const statement of splitMigrationStatements(
        getSQLiteMigrationSql(migration)
      )) {
        sqlite.exec(statement);
      }
      recordMigration(sqlite, migration.id);
    }
  })();
}

export function applyMigration(
  sqlite: Database.Database,
  migration: ReturnType<typeof getSQLiteMigrations>[number]
): void {
  ensureMigrationRegistry(sqlite);
  const statements = splitMigrationStatements(getSQLiteMigrationSql(migration));
  sqlite.transaction(() => {
    for (const statement of statements) {
      sqlite.exec(statement);
    }
    recordMigration(sqlite, migration.id);
  })();
}

function ensureMigrationRegistry(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __orr_sqlite_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function recordMigration(sqlite: Database.Database, migrationId: string): void {
  sqlite
    .prepare("INSERT INTO __orr_sqlite_migrations (id) VALUES (?)")
    .run(migrationId);
}

export function readTableNames(sqlite: Database.Database): string[] {
  return (
    sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>
  ).map(({ name }) => name);
}

export function readColumns(
  sqlite: Database.Database,
  tableName: string
): string[] {
  return readTableInfo(sqlite, tableName).map(({ name }) => name);
}

export function readTableInfo(
  sqlite: Database.Database,
  tableName: string
): Array<{ name: string; pk: number }> {
  return sqlite.prepare(`PRAGMA table_info('${tableName}')`).all() as Array<{
    name: string;
    pk: number;
  }>;
}

export function readForeignKeys(
  sqlite: Database.Database,
  tableName: string
): Array<{ from: string; table: string; on_delete: string }> {
  return sqlite
    .prepare(`PRAGMA foreign_key_list('${tableName}')`)
    .all() as Array<{
    from: string;
    table: string;
    on_delete: string;
  }>;
}

export function readTableDdl(
  sqlite: Database.Database,
  tableName: string
): string {
  const row = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { sql: string };
  return row.sql;
}

export function readIndexes(
  sqlite: Database.Database,
  tableName: string
): Array<{ name: string; unique: number; sql: string | null }> {
  const indexes = sqlite
    .prepare(`PRAGMA index_list('${tableName}')`)
    .all() as Array<{ name: string; unique: number }>;
  return indexes.map(({ name, unique }) => ({
    name,
    unique,
    sql: (
      sqlite
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?"
        )
        .get(name) as { sql: string | null }
    ).sql,
  }));
}

export function rowCount(sqlite: Database.Database, tableName: string): number {
  return (
    sqlite.prepare(`SELECT count(*) AS count FROM ${tableName}`).get() as {
      count: number;
    }
  ).count;
}

export function readEntityTypes(
  sqlite: Database.Database,
  tableName: string
): string[] {
  return (
    sqlite
      .prepare(
        `SELECT DISTINCT entity_type FROM ${tableName} ORDER BY entity_type`
      )
      .all() as Array<{ entity_type: string }>
  ).map(({ entity_type }) => entity_type);
}

export function readEventTypes(sqlite: Database.Database): string[] {
  return (
    sqlite
      .prepare("SELECT event_type FROM events ORDER BY event_type")
      .all() as Array<{ event_type: string }>
  ).map(({ event_type }) => event_type);
}
