/**
 * SQLite migration 0020: the append-only handoff association stream
 * (improvement-plans/REQ-007, REQ-008; AC-028, AC-031, AC-032).
 *
 * The `action` column is a constrained enum, so this file carries the enum
 * CHECK assertion for it — per the SQLite enum-migration rule in AGENTS.md,
 * any future change to `handoffAssociationAction` requires a
 * table-recreation migration, and this test is the guard that catches a
 * missing one.
 */
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { asc, eq } from "drizzle-orm";
import { getSQLiteMigrations } from "../../shared/db/migrations";
import {
  handoffAssociationAction,
  reviewHandoffAssociations,
  reviews,
} from "../../shared/db/schema";
import {
  appendAssociationTransition,
  resolveCurrentAssociation,
  type AssociationTransition,
} from "../../app/services/handoff/association";
import {
  associationTransitionFromRow,
  associationTransitionToRow,
} from "../../app/services/handoff/persistence";
import {
  practiceEntityId,
  type PracticeReference,
} from "../../app/services/handoff/practice";
import {
  applyAllMigrations,
  applyMigration,
  applyMigrationsBefore,
  readColumns,
  readForeignKeys,
  readTableDdl,
} from "./helpers/template-revisions-migration";

const MIGRATION_ID = "0020_review_handoff_associations";
const NOW = "2026-09-10T00:00:00.000Z";

const PRACTICE: PracticeReference = {
  reviewId: "review-1",
  templateRevisionId: "rev-a",
  questionId: "q-1",
  practiceId: "cl-a",
};

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

function transition(
  parts: Partial<AssociationTransition> &
    Pick<AssociationTransition, "id" | "action">
): AssociationTransition {
  const isRevoke = parts.action === "revoke";
  return {
    reviewId: "review-1",
    practice: PRACTICE,
    actorId: "actor-1",
    occurredAt: NOW,
    priorTransitionId: null,
    reference: isRevoke
      ? null
      : {
          provider: "gitlab",
          externalId: "TEAM-142",
          url: "https://gitlab.example.com/issues/142",
        },
    ...parts,
  };
}

describe("review_handoff_associations table (migration 0020)", () => {
  it("installs keys, indexes, and CHECK constraints on a fresh database (REQ-008)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);

      expect(readColumns(sqlite, "review_handoff_associations")).toEqual([
        "id",
        "review_id",
        "practice_entity_id",
        "action",
        "provider",
        "external_id",
        "url",
        "prior_transition_id",
        "actor_id",
        "occurred_at",
      ]);
      const foreignKeys = readForeignKeys(
        sqlite,
        "review_handoff_associations"
      ).map(({ from, table, on_delete }) => ({ from, table, on_delete }));
      expect(foreignKeys).toContainEqual({
        from: "review_id",
        table: "reviews",
        on_delete: "CASCADE",
      });
      expect(foreignKeys).toContainEqual({
        from: "prior_transition_id",
        table: "review_handoff_associations",
        on_delete: "NO ACTION",
      });
      const ddl = readTableDdl(sqlite, "review_handoff_associations");
      expect(ddl).toContain("review_handoff_associations_action_check");
      expect(ddl).toContain("review_handoff_associations_reference_check");
    } finally {
      sqlite.close();
    }
  });

  it("matches the Drizzle schema action enum in its CHECK constraint", () => {
    // Enum-migration guard (AGENTS.md).
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      const ddl = readTableDdl(sqlite, "review_handoff_associations");
      for (const value of handoffAssociationAction) {
        expect(ddl).toContain(`'${value}'`);
      }
    } finally {
      sqlite.close();
    }
  });

  it("upgrades an existing database incrementally (0019 → 0020)", () => {
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

      expect(readColumns(sqlite, "review_handoff_associations")).toContain(
        "prior_transition_id"
      );
    } finally {
      sqlite.close();
    }
  });

  it("round-trips an append-only associate → replace → revoke stream and resolves on read (AC-032)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      insertReview(sqlite);
      const db = drizzle(sqlite);

      let history: AssociationTransition[] = [];
      history = appendAssociationTransition(
        history,
        transition({ id: "as-1", action: "associate" })
      );
      history = appendAssociationTransition(
        history,
        transition({
          id: "as-2",
          action: "replace",
          priorTransitionId: "as-1",
          reference: {
            provider: "youtrack",
            externalId: "PLAT-9",
            url: "https://youtrack.example.com/issue/PLAT-9",
          },
        })
      );
      history = appendAssociationTransition(
        history,
        transition({
          id: "as-3",
          action: "revoke",
          priorTransitionId: "as-2",
        })
      );
      for (const entry of history) {
        db.insert(reviewHandoffAssociations)
          .values(associationTransitionToRow(entry))
          .run();
      }

      const rows = db
        .select()
        .from(reviewHandoffAssociations)
        .where(eq(reviewHandoffAssociations.reviewId, "review-1"))
        .orderBy(
          asc(reviewHandoffAssociations.occurredAt),
          asc(reviewHandoffAssociations.id)
        )
        .all();
      expect(rows).toHaveLength(3);

      const replayed = rows.map(associationTransitionFromRow);
      // Revoked latest transition → no current association; history intact.
      expect(
        resolveCurrentAssociation(replayed, practiceEntityId(PRACTICE))
      ).toBeNull();
      expect(replayed[0]).toEqual(history[0]);
      expect(replayed[1]!.reference?.externalId).toBe("PLAT-9");
    } finally {
      sqlite.close();
    }
  });

  it("enforces the reference CHECK: a revoke with a reference is rejected", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      insertReview(sqlite);
      const db = drizzle(sqlite);

      expect(() =>
        db
          .insert(reviewHandoffAssociations)
          .values(
            associationTransitionToRow(
              transition({
                id: "as-bad",
                action: "revoke",
                reference: {
                  provider: "gitlab",
                  externalId: "TEAM-1",
                  url: "https://gitlab.example.com/issues/1",
                },
              })
            )
          )
          .run()
      ).toThrowError(/review_handoff_associations_reference_check/);
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
          .insert(reviewHandoffAssociations)
          .values(
            associationTransitionToRow(
              transition({ id: "as-bad-2", action: "delete" as never })
            )
          )
          .run()
      ).toThrowError(/review_handoff_associations_action_check/);
    } finally {
      sqlite.close();
    }
  });

  it("cascades association history with its owning Review", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      insertReview(sqlite);
      const db = drizzle(sqlite);
      db.insert(reviewHandoffAssociations)
        .values(
          associationTransitionToRow(
            transition({ id: "as-1", action: "associate" })
          )
        )
        .run();

      db.delete(reviews).where(eq(reviews.id, "review-1")).run();
      expect(db.select().from(reviewHandoffAssociations).all()).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });
});
