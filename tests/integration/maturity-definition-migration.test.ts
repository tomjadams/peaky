/**
 * SQLite migration 0017: the schema-versioned maturity definition column on
 * template_revisions (maturity-score/REQ-009; AC-040, AC-060).
 *
 * The column is plain JSON text, not an enum, so no table recreation and no
 * CHECK assertion applies — document shape is enforced by the domain codec
 * (`app/services/maturity/persistence.ts`), not by DDL.
 */
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { getSQLiteMigrations } from "../../shared/db/migrations";
import { templateRevisions, templates } from "../../shared/db/schema";
import { validateMaturityDefinition } from "../../app/services/maturity/definition";
import {
  buildDefaultMaturityDefinition,
  scorableQuestionsFromRevision,
} from "../../app/services/maturity/defaults";
import {
  decodeMaturityDefinition,
  serializeMaturityDefinition,
} from "../../app/services/maturity/persistence";
import { preparePublicationMaturity } from "../../app/services/maturity/publication";
import {
  applyAllMigrations,
  applyMigration,
  applyMigrationsBefore,
  readColumns,
  readTableDdl,
} from "./helpers/template-revisions-migration";

const MATURITY_MIGRATION_ID = "0017_maturity_definition";
const NOW = "2026-09-01T00:00:00.000Z";

const revisionContent = {
  pillars: [
    {
      id: "pillar-maturity",
      questions: [
        {
          id: "q-maturity-yn",
          type: "yes-no" as const,
          riskLevel: "high" as const,
        },
        {
          id: "q-maturity-cl",
          type: "checklist" as const,
          riskLevel: "medium" as const,
          checklistItems: [{ id: "cli-1" }, { id: "cli-2" }],
        },
      ],
    },
  ],
};

function insertTemplate(sqlite: Database.Database): void {
  sqlite
    .prepare(
      `INSERT INTO templates (
        id, name, description, status, owner_team_id, created_by_actor_id,
        updated_by_actor_id, created_at, updated_at
      ) VALUES (?, ?, '', 'active', 'team-platform', 'actor-system',
        'actor-system', ?, ?)`
    )
    .run("template-maturity", "Maturity Template", NOW, NOW);
}

describe("maturity definition column (migration 0017)", () => {
  it("installs the nullable JSON column on a fresh database (REQ-009)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);

      expect(readColumns(sqlite, "template_revisions")).toContain(
        "maturity_definition"
      );
      const ddl = readTableDdl(sqlite, "template_revisions");
      expect(ddl).toContain("maturity_definition");
      const info = sqlite
        .prepare(
          "SELECT `notnull`, dflt_value FROM pragma_table_info('template_revisions') WHERE name = 'maturity_definition'"
        )
        .get() as { notnull: number; dflt_value: string | null };
      expect(info.notnull).toBe(0);
      expect(info.dflt_value).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("upgrades an existing database incrementally and keeps rows pinned to NULL (AC-060)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyMigrationsBefore(sqlite, MATURITY_MIGRATION_ID);
      insertTemplate(sqlite);
      sqlite
        .prepare(
          `INSERT INTO template_revisions (
            id, template_id, name, description, status, revision_number,
            created_by_actor_id, updated_by_actor_id, published_by_actor_id,
            created_at, updated_at, published_at
          ) VALUES (?, ?, ?, '', 'published', 1, 'actor-system',
            'actor-system', 'actor-system', ?, ?, ?)`
        )
        .run("revision-pinned", "template-maturity", "Pinned", NOW, NOW, NOW);

      const migration = getSQLiteMigrations().find(
        ({ id }) => id === MATURITY_MIGRATION_ID
      );
      expect(
        migration,
        `${MATURITY_MIGRATION_ID} must be registered before this contract can pass`
      ).toBeDefined();
      if (!migration) return;
      applyMigration(sqlite, migration);

      // Pre-existing rows survive untouched: NULL is the explicit
      // no-definition state, never an invented default (AC-060).
      const row = sqlite
        .prepare(
          "SELECT id, status, revision_number, maturity_definition FROM template_revisions WHERE id = ?"
        )
        .get("revision-pinned") as {
        id: string;
        status: string;
        revision_number: number;
        maturity_definition: string | null;
      };
      expect(row.status).toBe("published");
      expect(row.maturity_definition).toBeNull();
      expect(decodeMaturityDefinition(row.maturity_definition)).toBeNull();

      // A backfilled document round-trips through the domain codec.
      const questions = scorableQuestionsFromRevision(revisionContent);
      const stored = serializeMaturityDefinition(
        buildDefaultMaturityDefinition(questions)
      );
      sqlite
        .prepare(
          "UPDATE template_revisions SET maturity_definition = ? WHERE id = ?"
        )
        .run(stored, "revision-pinned");
      const updated = sqlite
        .prepare(
          "SELECT maturity_definition FROM template_revisions WHERE id = ?"
        )
        .get("revision-pinned") as { maturity_definition: string };
      expect(updated.maturity_definition).toBe(stored);
      const decoded = decodeMaturityDefinition(updated.maturity_definition);
      expect(decoded).not.toBeNull();
      expect(validateMaturityDefinition(decoded!, questions)).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it("freezes Revision content and maturity definition in one transaction (AC-040)", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      const db = drizzle(sqlite);

      const questions = scorableQuestionsFromRevision(revisionContent);

      // Invalid configuration: publication yields issues and no write runs.
      const invalid = preparePublicationMaturity({
        definition: {
          ...buildDefaultMaturityDefinition(questions),
          thresholds: [35, 40, 60, 80],
        },
        questions,
      });
      expect(invalid.ok).toBe(false);
      if (!invalid.ok) {
        expect(invalid.issues.length).toBeGreaterThan(0);
      }
      expect(
        sqlite.prepare("SELECT count(*) AS c FROM template_revisions").get()
      ).toEqual({ c: 0 });

      // Valid configuration: the Revision row and its definition persist
      // atomically through the Drizzle mapping (repository round trip).
      const prepared = preparePublicationMaturity({ questions });
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) return;

      db.transaction((tx) => {
        tx.insert(templates)
          .values({
            id: "template-maturity",
            name: "Maturity Template",
            description: "",
            status: "active",
            ownerTeamId: "team-platform",
            createdByActorId: "actor-system",
            updatedByActorId: "actor-system",
            createdAt: NOW,
            updatedAt: NOW,
          })
          .run();
        tx.insert(templateRevisions)
          .values({
            id: "revision-published",
            templateId: "template-maturity",
            name: "Published",
            description: "",
            status: "published",
            revisionNumber: 1,
            createdByActorId: "actor-system",
            updatedByActorId: "actor-system",
            publishedByActorId: "actor-system",
            createdAt: NOW,
            updatedAt: NOW,
            publishedAt: NOW,
            maturityDefinition: prepared.maturityDefinition,
          })
          .run();
      });

      const rows = db
        .select()
        .from(templateRevisions)
        .where(eq(templateRevisions.id, "revision-published"))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.maturityDefinition).toBe(prepared.maturityDefinition);
      const decoded = decodeMaturityDefinition(rows[0]!.maturityDefinition);
      expect(decoded).not.toBeNull();
      expect(validateMaturityDefinition(decoded!, questions)).toEqual([]);
    } finally {
      sqlite.close();
    }
  });
});
