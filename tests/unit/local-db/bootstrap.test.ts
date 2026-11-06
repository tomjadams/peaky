/**
 * Tests for shared SQLite migration SQL files.
 */
import { describe, it, expect } from "vitest";
import {
  getSQLiteMigrationSql,
  getSQLiteMigrations,
} from "../../../shared/db/migrations";

function readMigration(id: string): string {
  const migration = getSQLiteMigrations().find((entry) => entry.id === id);

  if (!migration) {
    throw new Error(`Expected migration ${id} to exist`);
  }

  return getSQLiteMigrationSql(migration);
}

describe("shared SQLite migration SQL", () => {
  it("initial migration defines all required core tables", async () => {
    const schemaSql = readMigration("0001_initial");

    const requiredTables = [
      "subjects",
      "subject_component_links",
      "reviews",
      "review_template_selections",
      "review_answer_state",
      "review_note_state",
      "review_attachments",
      "review_score_state",
      "review_participants",
      "review_events",
      "local_outbox",
      "entitlement_snapshots",
      "sync_cursors",
      "pending_review_queue",
    ];

    for (const table of requiredTables) {
      expect(schemaSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("initial migration defines indexes for events", () => {
    const schemaSql = readMigration("0001_initial");

    expect(schemaSql).toContain("review_events_review_idx");
    expect(schemaSql).toContain("review_events_occurred_at_idx");
    expect(schemaSql).toContain("review_events_status_idx");
  });

  it("follow-up migration defines the catalog directory mirror tables", () => {
    const schemaSql = readMigration("0002_catalog_directory_mirror");

    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS directory_users");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS directory_groups");
    expect(schemaSql).toContain(
      "CREATE TABLE IF NOT EXISTS catalog_components"
    );
  });
});
