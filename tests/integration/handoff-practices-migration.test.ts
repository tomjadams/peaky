/**
 * SQLite migration 0019: the selected handoff practice rows
 * (improvement-plans/REQ-005, REQ-006; AC-016, AC-017, AC-021, AC-023).
 *
 * The `selection_state` column is a constrained enum, so this file carries
 * the enum CHECK assertion for it — per the SQLite enum-migration rule in
 * AGENTS.md, any future change to `handoffSelectionState` requires a
 * table-recreation migration, and this test is the guard that catches a
 * missing one. Follows the 0018 focused-migration-test pattern.
 */
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { getSQLiteMigrations } from "../../shared/db/migrations";
import {
  handoffSelectionState,
  reviewHandoffPractices,
  reviews,
} from "../../shared/db/schema";
import {
  handoffPracticeFromRow,
  handoffPracticeToRow,
} from "../../app/services/handoff/persistence";
import type { HandoffPracticeRecord } from "../../app/services/handoff/draft";
import {
  applyAllMigrations,
  applyMigration,
  applyMigrationsBefore,
  readColumns,
  readForeignKeys,
  readIndexes,
  readTableDdl,
} from "./helpers/template-revisions-migration";

const MIGRATION_ID = "0019_review_handoff_practices";
const NOW = "2026-09-10T00:00:00.000Z";

function insertReview(sqlite: Database.Database): void {
  sqlite
    .prepare(
      `INSERT INTO subjects (id, type, name, slug, status, created_at, updated_at)
       VALUES ('subject-1', 'team', 'Platform', 'platform', 'active', ?, ?)`
    )
    .run(NOW, NOW);
  sqlite
    .prepare(
      `INSERT INTO reviews (id, subject_id, name, status, created_at, updated_at)
       VALUES ('review-1', 'subject-1', 'Review', 'in-progress', ?, ?)`
    )
    .run(NOW, NOW);
}

function makeRecord(
  overrides: Partial<HandoffPracticeRecord> = {}
): HandoffPracticeRecord {
  const reference = overrides.reference ?? {
    reviewId: "review-1",
    templateRevisionId: "rev-a",
    questionId: "q-1",
    practiceId: "cl-a",
  };
  const id =
    overrides.id ??
    `review_handoff_practice:${reference.reviewId}/${reference.templateRevisionId}/${reference.questionId}/${reference.practiceId}`;
  return {
    id,
    reference,
    orderKey: "0001",
    snapshot: {
      title: "Practice A",
      questionText: "Question 1",
      pillarName: "Security",
      templateName: "Security Review",
      revisionNumber: 2,
      evidenceState: "unmet",
      leadingPractices: ["Automate the control"],
      helpfulLinks: [{ title: "Guide", url: "https://example.com/guide" }],
      evidenceIdentifiers: ["evidence:interview-1"],
    },
    rationale: null,
    selectionState: "selected",
    localHandoffId: null,
    actorId: "actor-1",
    occurredAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("review_handoff_practices table (migration 0019)", () => {
  it("installs keys, indexes, and CHECK constraints on a fresh database (REQ-006)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);

      expect(readColumns(sqlite, "review_handoff_practices")).toEqual([
        "id",
        "review_id",
        "template_revision_id",
        "question_id",
        "practice_id",
        "order_key",
        "snapshot",
        "rationale",
        "selection_state",
        "local_handoff_id",
        "actor_id",
        "occurred_at",
        "updated_at",
      ]);
      const foreignKeys = readForeignKeys(
        sqlite,
        "review_handoff_practices"
      ).map(({ from, table, on_delete }) => ({ from, table, on_delete }));
      expect(foreignKeys).toContainEqual({
        from: "review_id",
        table: "reviews",
        on_delete: "CASCADE",
      });
      const ddl = readTableDdl(sqlite, "review_handoff_practices");
      expect(ddl).toContain("review_handoff_practices_selection_state_check");
      const unique = readIndexes(sqlite, "review_handoff_practices").find(
        ({ name }) => name === "review_handoff_practices_identity_unique"
      );
      expect(unique?.unique).toBe(1);
      expect(
        readIndexes(sqlite, "review_handoff_practices").map(({ name }) => name)
      ).toContain("review_handoff_practices_local_handoff_idx");
    } finally {
      sqlite.close();
    }
  });

  it("matches the Drizzle schema selection-state enum in its CHECK constraint", () => {
    // Enum-migration guard (AGENTS.md): every exported enum value must be
    // present in the DDL after applying all migrations.
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      const ddl = readTableDdl(sqlite, "review_handoff_practices");
      for (const value of handoffSelectionState) {
        expect(ddl).toContain(`'${value}'`);
      }
    } finally {
      sqlite.close();
    }
  });

  it("upgrades an existing database incrementally (0018 → 0019)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyMigrationsBefore(sqlite, MIGRATION_ID);
      insertReview(sqlite);

      const migration = getSQLiteMigrations().find(
        ({ id }) => id === MIGRATION_ID
      );
      expect(
        migration,
        `${MIGRATION_ID} must be registered before this contract can pass`
      ).toBeDefined();
      if (!migration) return;
      applyMigration(sqlite, migration);

      expect(readColumns(sqlite, "review_handoff_practices")).toContain(
        "selection_state"
      );
      const review = sqlite
        .prepare("SELECT status FROM reviews WHERE id = 'review-1'")
        .get() as { status: string };
      expect(review.status).toBe("in-progress");
    } finally {
      sqlite.close();
    }
  });

  it("round-trips a practice row through the codec, preserving the snapshot (AC-021)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      insertReview(sqlite);
      const db = drizzle(sqlite);

      const record = makeRecord();
      db.insert(reviewHandoffPractices)
        .values(handoffPracticeToRow(record))
        .run();
      const [row] = db
        .select()
        .from(reviewHandoffPractices)
        .where(eq(reviewHandoffPractices.id, record.id))
        .all();
      expect(handoffPracticeFromRow(row!)).toEqual(record);
    } finally {
      sqlite.close();
    }
  });

  it("enforces deterministic practice identity uniqueness (AC-017)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      insertReview(sqlite);
      const db = drizzle(sqlite);

      db.insert(reviewHandoffPractices)
        .values(handoffPracticeToRow(makeRecord()))
        .run();
      // A second row for the same tuple under a different ID is rejected.
      expect(() =>
        db
          .insert(reviewHandoffPractices)
          .values(
            handoffPracticeToRow(
              makeRecord({ id: "review_handoff_practice:other" })
            )
          )
          .run()
      ).toThrowError(/UNIQUE constraint failed: review_handoff_practices\./);
    } finally {
      sqlite.close();
    }
  });

  it("enforces the selection-state CHECK", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      insertReview(sqlite);
      const db = drizzle(sqlite);

      expect(() =>
        db
          .insert(reviewHandoffPractices)
          .values(
            handoffPracticeToRow(
              makeRecord({ selectionState: "pending" as never })
            )
          )
          .run()
      ).toThrowError(/review_handoff_practices_selection_state_check/);
    } finally {
      sqlite.close();
    }
  });

  it("cascades practice rows with their owning Review", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      insertReview(sqlite);
      const db = drizzle(sqlite);
      db.insert(reviewHandoffPractices)
        .values(handoffPracticeToRow(makeRecord()))
        .run();

      db.delete(reviews).where(eq(reviews.id, "review-1")).run();
      expect(db.select().from(reviewHandoffPractices).all()).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });
});
