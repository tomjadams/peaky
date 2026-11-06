import type Database from "better-sqlite3";
import { expect } from "vitest";
import { NOW } from "./template-revisions-migration";

type TemplateRow = {
  id: string;
  status?: string;
  owner?: string | null;
  creator?: string | null;
  updater?: string | null;
};

type RevisionRow = {
  id: string;
  templateId: string;
  status: string;
  number?: number | null;
  summary?: string | null;
  creator?: string | null;
  updater?: string | null;
  publisher?: string | null;
  publishedAt?: string | null;
};

export function assertTargetConstraints(sqlite: Database.Database): void {
  insertTemplate(sqlite, { id: "template-a" });
  insertTemplate(sqlite, { id: "template-b" });
  insertTemplate(sqlite, { id: "template-c" });
  insertTemplate(sqlite, { id: "template-d" });
  insertTemplate(sqlite, { id: "template-archived", status: "archived" });

  for (const status of ["draft", "deleted"]) {
    expectRejected(`Template status ${status}`, () =>
      insertTemplate(sqlite, { id: `template-status-${status}`, status })
    );
  }
  expectRejected("Template owner", () =>
    insertTemplate(sqlite, { id: "template-null-owner", owner: null })
  );
  expectRejected("Template creator", () =>
    insertTemplate(sqlite, { id: "template-null-creator", creator: null })
  );
  expectRejected("Template updater", () =>
    insertTemplate(sqlite, { id: "template-null-updater", updater: null })
  );

  insertRevision(sqlite, {
    id: "revision-draft-a",
    templateId: "template-a",
    status: "draft",
  });
  insertRevision(sqlite, {
    id: "revision-published-a",
    templateId: "template-a",
    status: "published",
    number: 1,
    publisher: "actor-system",
    publishedAt: NOW,
  });
  insertRevision(sqlite, {
    id: "revision-retired-a",
    templateId: "template-a",
    status: "retired",
    number: 2,
    publisher: "actor-system",
    publishedAt: NOW,
  });
  insertRevision(sqlite, {
    id: "revision-published-b",
    templateId: "template-b",
    status: "published",
    number: 1,
    publisher: "actor-system",
    publishedAt: NOW,
  });
  insertRevision(sqlite, {
    id: "revision-published-c",
    templateId: "template-c",
    status: "published",
    number: 1,
    publisher: "actor-system",
    publishedAt: NOW,
  });

  assertRevisionStatusAndProvenance(sqlite);
  assertPublicationTuple(sqlite);
  assertRevisionMetadataAndCardinality(sqlite);
  assertAuthoredHierarchy(sqlite);
  assertReviewSelection(sqlite);
}

function assertRevisionStatusAndProvenance(sqlite: Database.Database): void {
  for (const status of ["active", "deleted"]) {
    expectRejected(`Revision status ${status}`, () =>
      insertRevision(sqlite, {
        id: `revision-status-${status}`,
        templateId: "template-d",
        status,
      })
    );
  }
  expectRejected("Revision Template FK", () =>
    insertRevision(sqlite, {
      id: "revision-missing-template",
      templateId: "missing-template",
      status: "draft",
    })
  );
  expectRejected("Revision creator", () =>
    insertRevision(sqlite, {
      id: "revision-null-creator",
      templateId: "template-b",
      status: "draft",
      creator: null,
    })
  );
  expectRejected("Revision updater", () =>
    insertRevision(sqlite, {
      id: "revision-null-updater",
      templateId: "template-b",
      status: "draft",
      updater: null,
    })
  );
}

function assertPublicationTuple(sqlite: Database.Database): void {
  for (const row of [
    { id: "draft-with-number", number: 3 },
    { id: "draft-with-timestamp", publishedAt: NOW },
    { id: "draft-with-publisher", publisher: "actor-system" },
  ]) {
    expectRejected(row.id, () =>
      insertRevision(sqlite, {
        ...row,
        templateId: "template-d",
        status: "draft",
      })
    );
  }

  for (const status of ["published", "retired"]) {
    expectRejected(`${status} without number`, () =>
      insertRevision(sqlite, {
        id: `${status}-without-number`,
        templateId: "template-d",
        status,
        publisher: "actor-system",
        publishedAt: NOW,
      })
    );
    expectRejected(`${status} without timestamp`, () =>
      insertRevision(sqlite, {
        id: `${status}-without-timestamp`,
        templateId: "template-d",
        status,
        number: 8,
        publisher: "actor-system",
      })
    );
    expectRejected(`${status} without publisher`, () =>
      insertRevision(sqlite, {
        id: `${status}-without-publisher`,
        templateId: "template-d",
        status,
        number: 8,
        publishedAt: NOW,
      })
    );
  }
}

function assertRevisionMetadataAndCardinality(sqlite: Database.Database): void {
  for (const number of [0, -1, 1.5]) {
    expectRejected(`Revision number ${number}`, () =>
      insertRevision(sqlite, {
        id: `revision-number-${String(number).replace(".", "-")}`,
        templateId: "template-b",
        status: "retired",
        number,
        publisher: "actor-system",
        publishedAt: NOW,
      })
    );
  }
  expectRejected("duplicate Revision number", () =>
    insertRevision(sqlite, {
      id: "revision-duplicate-number",
      templateId: "template-a",
      status: "retired",
      number: 1,
      publisher: "actor-system",
      publishedAt: NOW,
    })
  );
  expectRejected("second draft", () =>
    insertRevision(sqlite, {
      id: "revision-second-draft",
      templateId: "template-a",
      status: "draft",
    })
  );
  expectRejected("second published Revision", () =>
    insertRevision(sqlite, {
      id: "revision-second-published",
      templateId: "template-a",
      status: "published",
      number: 4,
      publisher: "actor-system",
      publishedAt: NOW,
    })
  );
  expectRejected("blank Revision summary", () =>
    insertRevision(sqlite, {
      id: "revision-blank-summary",
      templateId: "template-b",
      status: "retired",
      number: 3,
      summary: "   ",
      publisher: "actor-system",
      publishedAt: NOW,
    })
  );
  expectRejected("long Revision summary", () =>
    insertRevision(sqlite, {
      id: "revision-long-summary",
      templateId: "template-b",
      status: "retired",
      number: 3,
      summary: "x".repeat(121),
      publisher: "actor-system",
      publishedAt: NOW,
    })
  );
  insertRevision(sqlite, {
    id: "revision-retired-a-two",
    templateId: "template-a",
    status: "retired",
    number: 3,
    summary: "x".repeat(120),
    publisher: "actor-system",
    publishedAt: NOW,
  });
}

function assertAuthoredHierarchy(sqlite: Database.Database): void {
  expectRejected("Pillar Revision FK", () =>
    insertPillar(sqlite, "pillar-missing-revision", "missing-revision")
  );
  insertPillar(sqlite, "pillar-a", "revision-published-a");
  expectRejected("Pillar slug uniqueness", () =>
    insertPillar(sqlite, "pillar-a-duplicate", "revision-published-a")
  );
  insertPillar(sqlite, "pillar-b", "revision-published-b");
  expectRejected("Question Pillar FK", () =>
    sqlite
      .prepare(`
        INSERT INTO template_questions (
          id, pillar_id, order_key, text, type, risk_level, created_at, updated_at
        ) VALUES (?, ?, '001', 'Invalid?', 'yes-no', 'medium', ?, ?)
      `)
      .run("question-missing-pillar", "missing-pillar", NOW, NOW)
  );
  sqlite
    .prepare(`
      INSERT INTO template_revision_imports (
        id, template_revision_id, source_type, source_file, imported_at,
        conflicts, resolved
      ) VALUES (?, ?, 'markdown', 'template.md', ?, '[{"unitId":"q-1"}]', '["q-2"]')
    `)
    .run("import-draft", "revision-draft-a", NOW);
  expect(
    sqlite
      .prepare(`
        SELECT template_revision_id, source_type, source_file, imported_at,
          conflicts, resolved
        FROM template_revision_imports
        WHERE id = 'import-draft'
      `)
      .get()
  ).toEqual({
    template_revision_id: "revision-draft-a",
    source_type: "markdown",
    source_file: "template.md",
    imported_at: NOW,
    conflicts: '[{"unitId":"q-1"}]',
    resolved: '["q-2"]',
  });
  sqlite
    .prepare(`
      INSERT INTO template_revision_imports (
        id, template_revision_id, source_type, imported_at
      ) VALUES (?, ?, 'json', ?)
    `)
    .run("import-defaults", "revision-draft-a", NOW);
  expect(
    sqlite
      .prepare(`
        SELECT source_file, conflicts, resolved
        FROM template_revision_imports
        WHERE id = 'import-defaults'
      `)
      .get()
  ).toEqual({ source_file: null, conflicts: "[]", resolved: "[]" });
  expectRejected("import source type", () =>
    sqlite
      .prepare(`
        INSERT INTO template_revision_imports (
          id, template_revision_id, source_type, imported_at, conflicts, resolved
        ) VALUES (?, ?, 'yaml', ?, '[]', '[]')
      `)
      .run("import-invalid-source", "revision-draft-a", NOW)
  );
  expectRejected("import Revision FK", () =>
    sqlite
      .prepare(`
        INSERT INTO template_revision_imports (
          id, template_revision_id, source_type, source_file, imported_at,
          conflicts, resolved
        ) VALUES (?, ?, 'markdown', 'invalid.md', ?, '[]', '[]')
      `)
      .run("import-missing-revision", "missing-revision", NOW)
  );
}

function assertReviewSelection(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT INTO subjects (id, type, name, slug, status, created_at, updated_at)
    VALUES ('subject-target', 'product', 'Target', 'target', 'active', '${NOW}', '${NOW}');

    INSERT INTO reviews (id, subject_id, name, status, created_at, updated_at)
    VALUES ('review-target', 'subject-target', 'Review', 'draft', '${NOW}', '${NOW}');

    INSERT INTO review_template_selections (
      review_id, template_revision_id, position, created_at
    ) VALUES ('review-target', 'revision-published-a', 0, '${NOW}');
  `);

  expectRejected("duplicate Review Revision", () =>
    insertSelection(sqlite, "revision-published-a", 1)
  );
  expectRejected("duplicate Review position", () =>
    insertSelection(sqlite, "revision-published-b", 0)
  );
  expectRejected("out-of-range Review position", () =>
    insertSelection(sqlite, "revision-published-b", 3)
  );
  expectRejected("negative Review position", () =>
    insertSelection(sqlite, "revision-published-b", -1)
  );
  expectRejected("fractional Review position", () =>
    insertSelection(sqlite, "revision-published-b", 1.5)
  );
  expectRejected("Review Revision FK", () =>
    insertSelection(sqlite, "missing-revision", 1)
  );
  expectRejected("Review parent FK", () =>
    insertSelection(sqlite, "revision-published-c", 2, "missing-review")
  );
  insertSelection(sqlite, "revision-published-b", 1);
  insertSelection(sqlite, "revision-published-c", 2);
  expectRejected("restrictive Revision delete", () =>
    sqlite.exec(
      "DELETE FROM template_revisions WHERE id = 'revision-published-a'"
    )
  );
  expectRejected("referenced Template delete", () =>
    sqlite.exec("DELETE FROM templates WHERE id = 'template-a'")
  );

  insertTemplate(sqlite, { id: "template-delete-free" });
  insertRevision(sqlite, {
    id: "revision-delete-free",
    templateId: "template-delete-free",
    status: "draft",
  });
  insertPillar(sqlite, "pillar-delete-free", "revision-delete-free");
  sqlite
    .prepare(`
      INSERT INTO template_questions (
        id, pillar_id, order_key, text, type, risk_level, created_at, updated_at
      ) VALUES (?, ?, '001', 'Delete?', 'yes-no', 'medium', ?, ?)
    `)
    .run("question-delete-free", "pillar-delete-free", NOW, NOW);
  sqlite.exec("DELETE FROM templates WHERE id = 'template-delete-free'");

  for (const [table, id] of [
    ["templates", "template-delete-free"],
    ["template_revisions", "revision-delete-free"],
    ["template_pillars", "pillar-delete-free"],
    ["template_questions", "question-delete-free"],
  ] as const) {
    expect(
      sqlite
        .prepare(`SELECT count(*) AS count FROM ${table} WHERE id = ?`)
        .get(id)
    ).toEqual({ count: 0 });
  }
}

function insertTemplate(sqlite: Database.Database, row: TemplateRow): void {
  sqlite
    .prepare(`
      INSERT INTO templates (
        id, name, description, status, owner_team_id, created_by_actor_id,
        updated_by_actor_id, created_at, updated_at
      ) VALUES (?, ?, '', ?, ?, ?, ?, ?, ?)
    `)
    .run(
      row.id,
      row.id,
      row.status ?? "active",
      row.owner === undefined ? "group-platform" : row.owner,
      row.creator === undefined ? "actor-system" : row.creator,
      row.updater === undefined ? "actor-system" : row.updater,
      NOW,
      NOW
    );
}

function insertRevision(sqlite: Database.Database, row: RevisionRow): void {
  sqlite
    .prepare(`
      INSERT INTO template_revisions (
        id, template_id, name, description, status, revision_number,
        revision_summary, created_by_actor_id, updated_by_actor_id,
        published_by_actor_id, created_at, updated_at, published_at
      ) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      row.id,
      row.templateId,
      row.id,
      row.status,
      row.number ?? null,
      row.summary ?? null,
      row.creator === undefined ? "actor-system" : row.creator,
      row.updater === undefined ? "actor-system" : row.updater,
      row.publisher ?? null,
      NOW,
      NOW,
      row.publishedAt ?? null
    );
}

function insertPillar(
  sqlite: Database.Database,
  id: string,
  revisionId: string
): void {
  sqlite
    .prepare(`
      INSERT INTO template_pillars (
        id, template_revision_id, slug, name, description, order_key,
        created_at, updated_at
      ) VALUES (?, ?, 'reliability', 'Reliability', '', '001', ?, ?)
    `)
    .run(id, revisionId, NOW, NOW);
}

function insertSelection(
  sqlite: Database.Database,
  revisionId: string,
  position: number,
  reviewId = "review-target"
): void {
  sqlite
    .prepare(`
      INSERT INTO review_template_selections (
        review_id, template_revision_id, position, created_at
      ) VALUES (?, ?, ?, ?)
    `)
    .run(reviewId, revisionId, position, NOW);
}

function expectRejected(label: string, operation: () => void): void {
  expect(operation, label).toThrow();
}
