import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { getSQLiteMigrations } from "../../shared/db/migrations";
import { templateFixtureDrafts } from "../../server/data/templates";
import { writeTemplateFixtureDrafts } from "../../app/services/template/TemplateFixtureDraftInstaller";
import { seedLegacyState } from "./helpers/template-revisions-legacy-fixture";
import {
  TARGET_MIGRATION_ID,
  applyMigration,
  applyMigrationsBefore,
  rowCount,
} from "./helpers/template-revisions-migration";

function applyAllMigrations(sqlite: Database.Database): void {
  for (const migration of getSQLiteMigrations()) {
    applyMigration(sqlite, migration);
  }
}

async function installTwice(sqlite: Database.Database): Promise<void> {
  const db = drizzle(sqlite);
  await writeTemplateFixtureDrafts(db as never);
  await writeTemplateFixtureDrafts(db as never);
}

function assertInstalledDrafts(sqlite: Database.Database): void {
  const pillarCount = templateFixtureDrafts.reduce(
    (count, draft) => count + draft.pillars.length,
    0
  );
  const questionCount = templateFixtureDrafts.reduce(
    (count, draft) =>
      count +
      draft.pillars.reduce(
        (countForPillars, pillar) => countForPillars + pillar.questions.length,
        0
      ),
    0
  );

  expect(rowCount(sqlite, "templates")).toBe(templateFixtureDrafts.length);
  expect(rowCount(sqlite, "template_revisions")).toBe(
    templateFixtureDrafts.length
  );
  expect(rowCount(sqlite, "template_pillars")).toBe(pillarCount);
  expect(rowCount(sqlite, "template_questions")).toBe(questionCount);
  expect(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM template_revisions WHERE status != 'draft' OR revision_number IS NOT NULL OR published_at IS NOT NULL OR published_by_actor_id IS NOT NULL"
      )
      .get()
  ).toEqual({ count: 0 });
  expect(sqlite.pragma("foreign_key_check")).toEqual([]);
}

describe("deterministic Template fixture draft bootstrap", () => {
  it("installs idempotently after fresh migrations without transport rows", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyAllMigrations(sqlite);
      const eventsBefore = rowCount(sqlite, "events");
      const outboxBefore = rowCount(sqlite, "local_outbox");

      await installTwice(sqlite);

      assertInstalledDrafts(sqlite);
      expect(rowCount(sqlite, "events")).toBe(eventsBefore);
      expect(rowCount(sqlite, "local_outbox")).toBe(outboxBefore);
    } finally {
      sqlite.close();
    }
  });

  it("installs idempotently after the populated 0015 to 0016 cutover", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      applyMigrationsBefore(sqlite, TARGET_MIGRATION_ID);
      seedLegacyState(sqlite);
      const migration = getSQLiteMigrations().find(
        ({ id }) => id === TARGET_MIGRATION_ID
      );
      expect(migration).toBeDefined();
      if (!migration) return;
      applyMigration(sqlite, migration);
      // The runtime always applies every pending migration before installing
      // fixtures, so the cutover scenario ends on the full migration chain.
      for (const later of getSQLiteMigrations().filter(
        ({ id }) => id > TARGET_MIGRATION_ID
      )) {
        applyMigration(sqlite, later);
      }
      const eventsBefore = rowCount(sqlite, "events");
      const outboxBefore = rowCount(sqlite, "local_outbox");

      await installTwice(sqlite);

      assertInstalledDrafts(sqlite);
      expect(rowCount(sqlite, "events")).toBe(eventsBefore);
      expect(rowCount(sqlite, "local_outbox")).toBe(outboxBefore);
    } finally {
      sqlite.close();
    }
  });
});
