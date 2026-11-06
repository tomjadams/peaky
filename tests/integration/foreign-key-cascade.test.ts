import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  getSQLiteMigrations,
  getSQLiteMigrationSql,
  splitMigrationStatements,
} from "../../shared/db/migrations";

/**
 * Integration test for SQLite foreign-key cascade enforcement.
 *
 * The local-first schema defines ON DELETE CASCADE on review child tables
 * (review_answer_state, review_note_state, review_attachments, etc.).
 * SQLite disables FK enforcement by default — the onInit hook in
 * app/local-db/client.ts enables PRAGMA foreign_keys = ON per connection.
 *
 * This test proves the cascade constraints actually fire when FK enforcement
 * is enabled, and that they are silently ignored when it is not.
 */
function applyMigrations(db: Database.Database): void {
  for (const migration of getSQLiteMigrations()) {
    for (const statement of splitMigrationStatements(
      getSQLiteMigrationSql(migration)
    )) {
      db.exec(statement);
    }
  }
}

function seedReview(db: Database.Database): void {
  const now = "2026-08-07T00:00:00.000Z";

  db.prepare(
    `INSERT INTO subjects (id, type, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run("subj-1", "product", "Test Subject", "test-subject", now, now);

  db.prepare(
    `INSERT INTO reviews (id, subject_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run("review-1", "subj-1", "Test Review", "draft", now, now);

  db.prepare(
    `INSERT INTO review_answer_state (id, review_id, question_id, answer, updated_at) VALUES (?, ?, ?, ?, ?)`
  ).run("ans-1", "review-1", "q-001", "yes", now);

  db.prepare(
    `INSERT INTO review_note_state (id, review_id, scope_type, scope_id, content, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run("note-1", "review-1", "review", "review-1", "A note", now);

  db.prepare(
    `INSERT INTO review_attachments (id, review_id, scope_type, scope_id, filename, object_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run("att-1", "review-1", "review", "review-1", "file.pdf", "s3-key", now);
}

function countChildRows(db: Database.Database): {
  answers: number;
  notes: number;
  attachments: number;
} {
  return {
    answers: (
      db
        .prepare(
          "SELECT COUNT(*) as n FROM review_answer_state WHERE review_id = ?"
        )
        .get("review-1") as { n: number }
    ).n,
    notes: (
      db
        .prepare(
          "SELECT COUNT(*) as n FROM review_note_state WHERE review_id = ?"
        )
        .get("review-1") as { n: number }
    ).n,
    attachments: (
      db
        .prepare(
          "SELECT COUNT(*) as n FROM review_attachments WHERE review_id = ?"
        )
        .get("review-1") as { n: number }
    ).n,
  };
}

describe("SQLite foreign-key cascade enforcement", () => {
  it("cascades review deletion to child tables when FK enforcement is ON", () => {
    const db = new Database(":memory:");
    try {
      db.pragma("foreign_keys = ON");
      applyMigrations(db);
      seedReview(db);

      // Verify child rows exist before deletion
      expect(countChildRows(db)).toEqual({
        answers: 1,
        notes: 1,
        attachments: 1,
      });

      // Delete the review — cascade should remove child rows
      db.prepare("DELETE FROM reviews WHERE id = ?").run("review-1");

      expect(countChildRows(db)).toEqual({
        answers: 0,
        notes: 0,
        attachments: 0,
      });
    } finally {
      db.close();
    }
  });

  it("leaves orphaned child rows when FK enforcement is OFF", () => {
    const db = new Database(":memory:");
    try {
      // Explicitly disable FK enforcement — SQLite WASM (SQLocal) leaves it
      // off by default, which is the bug the onInit hook in client.ts fixes.
      // better-sqlite3 may enable it by default, so we turn it off explicitly.
      db.pragma("foreign_keys = OFF");
      applyMigrations(db);
      seedReview(db);

      // Delete the review — cascade is silently ignored
      db.prepare("DELETE FROM reviews WHERE id = ?").run("review-1");

      // Child rows remain — this is the bug the onInit hook fixes
      expect(countChildRows(db)).toEqual({
        answers: 1,
        notes: 1,
        attachments: 1,
      });
    } finally {
      db.close();
    }
  });
});
