/**
 * SQLite migration 0018: the append-only Advisor maturity override stream
 * (maturity-score/REQ-016; AC-031, AC-043).
 *
 * The `action` column is a constrained enum, so this file carries the enum
 * CHECK assertion for it — per the SQLite enum-migration rule in AGENTS.md,
 * any future change to `maturityOverrideAction` requires a table-recreation
 * migration, and this test is the guard that catches a missing one.
 * (`tests/integration/migrations.test.ts` is at its line budget; this file
 * follows the 0017 pattern of its own focused migration test.)
 */
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { asc, eq } from "drizzle-orm";
import { getSQLiteMigrations } from "../../shared/db/migrations";
import {
  maturityOverrideAction,
  reviewMaturityOverrides,
  reviews,
} from "../../shared/db/schema";
import {
  appendOverrideTransition,
  resolveEffectiveOverride,
  type OverrideTransition,
} from "../../app/services/maturity/override";
import {
  overrideTransitionFromRow,
  overrideTransitionToRow,
} from "../../app/services/maturity/overridePersistence";
import {
  applyAllMigrations,
  applyMigration,
  applyMigrationsBefore,
  readColumns,
  readForeignKeys,
  readTableDdl,
} from "./helpers/template-revisions-migration";

const OVERRIDE_MIGRATION_ID = "0018_review_maturity_overrides";
const NOW = "2026-09-01T00:00:00.000Z";

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

function rowFromTransition(transition: OverrideTransition) {
  return overrideTransitionToRow(transition);
}

const created: OverrideTransition = {
  id: "ovr-1",
  reviewId: "review-1",
  templateRevisionId: "rev-a",
  action: "create",
  actorId: "actor-advisor-1",
  occurredAt: "2026-09-01T10:00:00.000Z",
  priorTransitionId: null,
  reviewedResult: { percent: 80, stage: 4 },
  explanation: "Reviewed on evidence call.",
  evidence: ["evidence:interview-1"],
};

const superseded: OverrideTransition = {
  id: "ovr-2",
  reviewId: "review-1",
  templateRevisionId: "rev-a",
  action: "supersede",
  actorId: "actor-advisor-2",
  occurredAt: "2026-09-02T10:00:00.000Z",
  priorTransitionId: "ovr-1",
  reviewedResult: { percent: 60, stage: 3 },
  explanation: "Re-scored after re-review.",
  evidence: ["evidence:interview-2"],
};

const revoked: OverrideTransition = {
  id: "ovr-3",
  reviewId: "review-1",
  templateRevisionId: "rev-a",
  action: "revoke",
  actorId: "actor-advisor-2",
  occurredAt: "2026-09-03T10:00:00.000Z",
  priorTransitionId: "ovr-2",
  reviewedResult: null,
  explanation: "Evidence no longer stands.",
  evidence: [],
};

describe("review_maturity_overrides table (migration 0018)", () => {
  it("installs the table with keys, indexes, and CHECK constraints on a fresh database (REQ-016)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);

      expect(readColumns(sqlite, "review_maturity_overrides")).toEqual([
        "id",
        "review_id",
        "template_revision_id",
        "action",
        "reviewed_percent",
        "reviewed_stage",
        "explanation",
        "evidence",
        "prior_transition_id",
        "actor_id",
        "occurred_at",
      ]);
      const foreignKeys = readForeignKeys(
        sqlite,
        "review_maturity_overrides"
      ).map(({ from, table, on_delete }) => ({ from, table, on_delete }));
      expect(foreignKeys).toContainEqual({
        from: "review_id",
        table: "reviews",
        on_delete: "CASCADE",
      });
      expect(foreignKeys).toContainEqual({
        from: "prior_transition_id",
        table: "review_maturity_overrides",
        on_delete: "NO ACTION",
      });
      const ddl = readTableDdl(sqlite, "review_maturity_overrides");
      expect(ddl).toContain("review_maturity_overrides_action_check");
      expect(ddl).toContain("review_maturity_overrides_value_check");
    } finally {
      sqlite.close();
    }
  });

  it("matches the Drizzle schema action enum in its CHECK constraint", () => {
    // Enum-migration guard (AGENTS.md): every exported enum value must be
    // present in the DDL after applying all migrations; a mismatch means a
    // table-recreation migration is missing.
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      const ddl = readTableDdl(sqlite, "review_maturity_overrides");
      for (const value of maturityOverrideAction) {
        expect(ddl).toContain(`'${value}'`);
      }
    } finally {
      sqlite.close();
    }
  });

  it("upgrades an existing database incrementally (0017 → 0018)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyMigrationsBefore(sqlite, OVERRIDE_MIGRATION_ID);
      insertReview(sqlite);
      expect(readColumns(sqlite, "reviews")).not.toContain("action");

      const migration = getSQLiteMigrations().find(
        ({ id }) => id === OVERRIDE_MIGRATION_ID
      );
      expect(
        migration,
        `${OVERRIDE_MIGRATION_ID} must be registered before this contract can pass`
      ).toBeDefined();
      if (!migration) return;
      applyMigration(sqlite, migration);

      // Pre-existing review data survives the upgrade untouched.
      expect(readColumns(sqlite, "review_maturity_overrides")).toContain(
        "prior_transition_id"
      );
      const review = sqlite
        .prepare("SELECT id, status FROM reviews WHERE id = 'review-1'")
        .get() as { id: string; status: string };
      expect(review.status).toBe("in-progress");
    } finally {
      sqlite.close();
    }
  });

  it("round-trips an append-only create → supersede → revoke stream and resolves on read (AC-031)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      insertReview(sqlite);
      const db = drizzle(sqlite);

      // Domain-validated transitions map to rows one-to-one; nothing is
      // updated or deleted — the stream is append-only (AC-043).
      let history: OverrideTransition[] = [];
      history = appendOverrideTransition(history, created);
      history = appendOverrideTransition(history, superseded);
      history = appendOverrideTransition(history, revoked);
      for (const transition of history) {
        db.insert(reviewMaturityOverrides)
          .values(rowFromTransition(transition))
          .run();
      }

      const rows = db
        .select()
        .from(reviewMaturityOverrides)
        .where(eq(reviewMaturityOverrides.reviewId, "review-1"))
        .orderBy(
          asc(reviewMaturityOverrides.occurredAt),
          asc(reviewMaturityOverrides.id)
        )
        .all();
      expect(rows).toHaveLength(3);

      const replayed: OverrideTransition[] = rows.map(
        overrideTransitionFromRow
      );
      // Every consumer resolves the same current value: revoked → none.
      expect(
        resolveEffectiveOverride(replayed, "review-1", "rev-a")
      ).toBeNull();
      // Prior transitions and their actors remain immutable history.
      expect(replayed[0]).toEqual(created);
      expect(replayed[1]!.actorId).toBe("actor-advisor-2");
    } finally {
      sqlite.close();
    }
  });

  it("enforces the value CHECK: a revoke with a reviewed value is rejected", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      insertReview(sqlite);
      const db = drizzle(sqlite);

      expect(() =>
        db
          .insert(reviewMaturityOverrides)
          .values(
            rowFromTransition({
              ...revoked,
              id: "ovr-bad",
              reviewedResult: { percent: 10, stage: 1 },
            })
          )
          .run()
      ).toThrowError(/review_maturity_overrides_value_check/);
      // An out-of-range reviewed stage is rejected too.
      expect(() =>
        db
          .insert(reviewMaturityOverrides)
          .values(
            rowFromTransition({
              ...created,
              id: "ovr-bad-2",
              reviewedResult: { percent: 50, stage: 6 as never },
            })
          )
          .run()
      ).toThrowError(/review_maturity_overrides_value_check/);
    } finally {
      sqlite.close();
    }
  });

  it("enforces the action CHECK: an unknown action is rejected", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      insertReview(sqlite);
      const db = drizzle(sqlite);

      expect(() =>
        db
          .insert(reviewMaturityOverrides)
          .values(rowFromTransition({ ...created, action: "delete" as never }))
          .run()
      ).toThrowError(/review_maturity_overrides_action_check/);
    } finally {
      sqlite.close();
    }
  });

  it("cascades override history with its owning Review", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      insertReview(sqlite);
      const db = drizzle(sqlite);
      db.insert(reviewMaturityOverrides)
        .values(rowFromTransition(created))
        .run();

      db.delete(reviews).where(eq(reviews.id, "review-1")).run();
      expect(db.select().from(reviewMaturityOverrides).all()).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });
});
