import type Database from "better-sqlite3";
import {
  NOW,
  RESET_ENTITY_TYPES,
  RESET_EVENT_TYPES,
} from "./template-revisions-migration";

export function seedLegacyState(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migration_log (
      id TEXT PRIMARY KEY,
      migration_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('applied', 'failed')),
      duration_ms INTEGER,
      error TEXT,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO subjects (id, type, name, slug, status, created_at, updated_at)
    VALUES
      ('subject-team', 'team', 'Platform', 'platform', 'active', '${NOW}', '${NOW}'),
      ('subject-product', 'product', 'Payments', 'payments', 'active', '${NOW}', '${NOW}');

    INSERT INTO team_profiles (
      id, subject_id, org_id, org_name, member_count, created_by, created_at, updated_at
    ) VALUES ('team-profile', 'subject-team', 'org-1', 'Platform Org', 5, 'actor-system', '${NOW}', '${NOW}');

    INSERT INTO product_profiles (
      id, subject_id, origin, is_external, product_manager_id, engineering_lead_id,
      team_ids, component_ids, created_by, created_at, updated_at
    ) VALUES (
      'product-profile', 'subject-product', 'bespoke', 0, 'actor-pm', 'actor-lead',
      '["subject-team"]', '["component-1"]', 'actor-system', '${NOW}', '${NOW}'
    );

    INSERT INTO subject_component_links (
      id, subject_id, component_id, relationship_type, created_at
    ) VALUES ('subject-component', 'subject-product', 'component-1', 'contains', '${NOW}');

    INSERT INTO directory_groups (
      id, display_name, description, org_id, org_name, member_count, updated_at, source_version
    ) VALUES ('group-platform', 'Platform', '', 'org-1', 'Platform Org', 5, '${NOW}', 'catalog-v1');

    INSERT INTO directory_users (id, display_name, updated_at, source_version)
    VALUES ('actor-system', 'System', '${NOW}', 'catalog-v1');

    INSERT INTO catalog_components (
      id, display_name, description, type, owner_group_id, owner_group_name,
      lifecycle, system, updated_at, source_version
    ) VALUES (
      'component-1', 'Payments API', '', 'service', 'group-platform', 'Platform',
      'production', 'payments', '${NOW}', 'catalog-v1'
    );

    INSERT INTO catalog_directory_mirror_meta (id, version, synced_at)
    VALUES ('catalog', 'catalog-v1', '${NOW}');

    INSERT INTO template_drafts (
      id, name, version, status, description, created_at, updated_at
    ) VALUES ('draft-legacy', 'Legacy Draft', 'v1', 'draft', '', '${NOW}', '${NOW}');

    INSERT INTO template_draft_pillars (
      id, draft_id, slug, name, description, order_key, created_at, updated_at
    ) VALUES (
      'draft-pillar-legacy', 'draft-legacy', 'reliability', 'Reliability', '', '001', '${NOW}', '${NOW}'
    );

    INSERT INTO template_draft_questions (
      id, draft_id, pillar_id, order_key, type, text, risk_level,
      importance, checklist_items, leading_practices, helpful_links,
      created_at, updated_at
    ) VALUES (
      'draft-question-legacy', 'draft-legacy', 'draft-pillar-legacy', '001', 'yes-no',
      'Is failover tested?', 'medium', '', '[]', '[]', '[]', '${NOW}', '${NOW}'
    );

    INSERT INTO template_draft_imports (
      id, draft_id, source_type, source_file, imported_at, conflicts, resolved
    ) VALUES (
      'draft-import-legacy', 'draft-legacy', 'markdown', 'legacy.md', '${NOW}', '[]', '[]'
    );

    INSERT INTO templates (
      id, name, description, status, created_at, updated_at, published_at
    ) VALUES (
      'template-legacy', 'Legacy Published', '', 'active', '${NOW}', '${NOW}', '${NOW}'
    );

    INSERT INTO template_versions (
      id, template_id, version_label, status, created_at, published_at
    ) VALUES (
      'version-legacy', 'template-legacy', 'v1', 'active', '${NOW}', '${NOW}'
    );

    INSERT INTO template_pillars (
      id, template_version_id, slug, name, description, order_key, created_at, updated_at
    ) VALUES (
      'pillar-legacy', 'version-legacy', 'reliability', 'Reliability', '', '001', '${NOW}', '${NOW}'
    );

    INSERT INTO template_questions (
      id, pillar_id, order_key, text, type, risk_level, importance,
      checklist_items, leading_practices, helpful_links, created_at, updated_at
    ) VALUES (
      'question-legacy', 'pillar-legacy', '001', 'Is failover tested?', 'yes-no',
      'medium', '', '[]', '[]', '[]', '${NOW}', '${NOW}'
    );

    INSERT INTO reviews (id, subject_id, name, status, created_at, updated_at)
    VALUES ('review-legacy', 'subject-product', 'Legacy Review', 'draft', '${NOW}', '${NOW}');

    INSERT INTO review_template_selections (
      id, review_id, template_version_id, position, created_at
    ) VALUES ('selection-legacy', 'review-legacy', 'version-legacy', 0, '${NOW}');

    INSERT INTO review_answer_state (
      id, review_id, question_id, answer, na_reason, item_na_reasons, updated_at
    ) VALUES (
      'answer-legacy', 'review-legacy', 'question-legacy', '"yes"', NULL, NULL, '${NOW}'
    );

    INSERT INTO review_note_state (
      id, review_id, scope_type, scope_id, content, updated_at
    ) VALUES (
      'note-legacy', 'review-legacy', 'question', 'question-legacy', 'Legacy note', '${NOW}'
    );

    INSERT INTO review_attachments (
      id, review_id, scope_type, scope_id, filename, object_key, mime_type, size,
      created_by, created_by_name, created_at
    ) VALUES (
      'attachment-legacy', 'review-legacy', 'question', 'question-legacy', 'evidence.txt',
      'reviews/legacy/evidence.txt', 'text/plain', 10, 'actor-system', 'System', '${NOW}'
    );

    INSERT INTO review_score_state (
      id, review_id, score_type, numeric_score, band, score_breakdown, computed_at
    ) VALUES (
      'score-legacy', 'review-legacy', 'readiness', 80, 'ready', '{}', '${NOW}'
    );

    INSERT INTO review_participants (
      id, review_id, actor_id, role, name, email, created_at
    ) VALUES (
      'participant-legacy', 'review-legacy', 'actor-reviewer', 'reviewer',
      'Reviewer', 'reviewer@example.com', '${NOW}'
    );

    INSERT INTO draft_answer_imports (
      id, review_id, source, run_id, imported_at, actor_id
    ) VALUES (
      'answer-import-legacy', 'review-legacy', 'llm', 'run-1', '${NOW}', 'actor-system'
    );

    INSERT INTO draft_answer_evidence (
      id, import_id, question_id, answer, confidence, evidence
    ) VALUES (
      'answer-evidence-legacy', 'answer-import-legacy', 'question-legacy', 'yes', 'high', 'Legacy evidence'
    );

    INSERT INTO entitlement_snapshots (
      id, actor_id, entitlements, snapshot_version, valid_until, created_at, refresh_at
    ) VALUES (
      'entitlements-legacy', 'actor-reviewer', '{"template:legacy":{"canView":true}}',
      1, '${NOW}', '${NOW}', '${NOW}'
    );

    INSERT INTO sync_cursors (
      id, actor_id, local_cursor, remote_cursor, updated_at
    ) VALUES ('cursor-preserved', 'actor-reviewer', 'local-1', 'remote-1', '${NOW}');

    INSERT INTO _migration_log (id, migration_id, status, applied_at)
    VALUES ('migration-log-preserved', '0015_remove_template_rules', 'applied', '${NOW}');
  `);

  seedOperationalState(sqlite);
}

export function readPreservedState(
  sqlite: Database.Database
): Record<string, unknown> {
  return {
    subjects: readRows(sqlite, "subjects"),
    productProfiles: readRows(sqlite, "product_profiles"),
    teamProfiles: readRows(sqlite, "team_profiles"),
    subjectComponentLinks: readRows(sqlite, "subject_component_links"),
    directoryGroups: readRows(sqlite, "directory_groups"),
    directoryUsers: readRows(sqlite, "directory_users"),
    catalogComponents: readRows(sqlite, "catalog_components"),
    catalogMeta: readRows(sqlite, "catalog_directory_mirror_meta"),
    syncCursors: readRows(sqlite, "sync_cursors"),
    migrationRegistry: readRowsWhere(
      sqlite,
      "__orr_sqlite_migrations",
      "id <> '0016_template_revisions'"
    ),
    migrationLog: readRows(sqlite, "_migration_log"),
    productOutbox: readRowsWhere(
      sqlite,
      "local_outbox",
      "entity_type = 'product'"
    ),
    productPending: readRowsWhere(
      sqlite,
      "pending_review_queue",
      "entity_type = 'product'"
    ),
    productFields: readRowsWhere(
      sqlite,
      "field_versions",
      "entity_type = 'product'"
    ),
    productHistory: readRowsWhere(
      sqlite,
      "field_version_events",
      "entity_type = 'product'"
    ),
    productEvents: readRowsWhere(sqlite, "events", "entity_type = 'product'"),
    nearMatchOutbox: readRowsWhere(
      sqlite,
      "local_outbox",
      "entity_type = 'template_revision'"
    ),
    nearMatchPending: readRowsWhere(
      sqlite,
      "pending_review_queue",
      "entity_type = 'template_revision'"
    ),
    nearMatchFields: readRowsWhere(
      sqlite,
      "field_versions",
      "entity_type = 'template_revision'"
    ),
    nearMatchHistory: readRowsWhere(
      sqlite,
      "field_version_events",
      "entity_type = 'template_revision'"
    ),
    nearMatchEvents: readRowsWhere(
      sqlite,
      "events",
      "entity_type = 'template_revision'"
    ),
    systemEvents: readRowsWhere(
      sqlite,
      "events",
      "event_type = 'ClientSchemaMigrated.v1'"
    ),
  };
}

function seedOperationalState(sqlite: Database.Database): void {
  const eventInsert = sqlite.prepare(`
    INSERT INTO events (
      id, specversion, review_id, event_type, actor_type, actor_id, data, time,
      status, source, entity_type, entity_id, hlc, root_type, root_id
    ) VALUES (?, '1.0', ?, ?, 'user', 'actor-system', '{}', ?, 'synced',
      'peaky.client', ?, ?, '1000:0001:actor-system', ?, ?)
  `);

  for (const [index, eventType] of RESET_EVENT_TYPES.entries()) {
    const eventId = `event-type-reset-${index}`;
    eventInsert.run(
      eventId,
      null,
      eventType,
      NOW,
      null,
      null,
      "system",
      eventId
    );
  }
  for (const [index, entityType] of RESET_ENTITY_TYPES.entries()) {
    eventInsert.run(
      `event-entity-reset-${index}`,
      null,
      "LegacyEntityTouched.v1",
      NOW,
      entityType,
      `${entityType}-legacy`,
      "system",
      `event-entity-reset-${index}`
    );
  }
  eventInsert.run(
    "event-review-id-reset",
    "review-legacy",
    "LegacyReviewTouched.v1",
    NOW,
    "unrelated",
    "unrelated-legacy",
    "review",
    "review-legacy"
  );
  eventInsert.run(
    "event-product-preserved",
    null,
    "ProductUpdated.v1",
    NOW,
    "product",
    "subject-product",
    "product",
    "subject-product"
  );
  eventInsert.run(
    "event-near-match-preserved",
    null,
    "TemplateRevisionCached.v1",
    NOW,
    "template_revision",
    "revision-cache",
    "system",
    "event-near-match-preserved"
  );
  eventInsert.run(
    "event-system-preserved",
    null,
    "ClientSchemaMigrated.v1",
    NOW,
    null,
    null,
    "system",
    "event-system-preserved"
  );

  const outboxInsert = sqlite.prepare(`
    INSERT INTO local_outbox (
      id, actor_id, entity_type, entity_id, operation, fields, created_at,
      status, retry_count, updated_at
    ) VALUES (?, 'actor-system', ?, ?, 'upsert', '[]', ?, 'pending', 0, ?)
  `);
  const pendingInsert = sqlite.prepare(`
    INSERT INTO pending_review_queue (
      id, actor_id, entity_type, entity_id, reason, local_payload, created_at
    ) VALUES (?, 'actor-system', ?, ?, 'rejected', '{}', ?)
  `);
  const currentFieldInsert = sqlite.prepare(`
    INSERT INTO field_versions (
      id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at
    ) VALUES (?, ?, ?, 'name', '"legacy"', '1000:0001:actor-system', 'actor-system', ?)
  `);
  const historyInsert = sqlite.prepare(`
    INSERT INTO field_version_events (
      id, event_id, entity_type, entity_id, field_name, value, previous_value,
      hlc, actor_id, updated_at
    ) VALUES (?, ?, ?, ?, 'name', '"legacy"', NULL,
      '1000:0001:actor-system', 'actor-system', ?)
  `);

  for (const [index, entityType] of RESET_ENTITY_TYPES.entries()) {
    const entityId = `${entityType}-legacy`;
    outboxInsert.run(`outbox-reset-${index}`, entityType, entityId, NOW, NOW);
    pendingInsert.run(`pending-reset-${index}`, entityType, entityId, NOW);
    currentFieldInsert.run(`field-reset-${index}`, entityType, entityId, NOW);
    historyInsert.run(
      `history-reset-${index}`,
      `event-entity-reset-${index}`,
      entityType,
      entityId,
      NOW
    );
  }

  outboxInsert.run(
    "outbox-product-preserved",
    "product",
    "subject-product",
    NOW,
    NOW
  );
  pendingInsert.run(
    "pending-product-preserved",
    "product",
    "subject-product",
    NOW
  );
  currentFieldInsert.run(
    "field-product-preserved",
    "product",
    "subject-product",
    NOW
  );
  historyInsert.run(
    "history-product-preserved",
    "event-product-preserved",
    "product",
    "subject-product",
    NOW
  );
  outboxInsert.run(
    "outbox-near-match-preserved",
    "template_revision",
    "revision-cache",
    NOW,
    NOW
  );
  pendingInsert.run(
    "pending-near-match-preserved",
    "template_revision",
    "revision-cache",
    NOW
  );
  currentFieldInsert.run(
    "field-near-match-preserved",
    "template_revision",
    "revision-cache",
    NOW
  );
  historyInsert.run(
    "history-near-match-preserved",
    "event-near-match-preserved",
    "template_revision",
    "revision-cache",
    NOW
  );
}

function readRows(sqlite: Database.Database, tableName: string): unknown[] {
  return sqlite.prepare(`SELECT * FROM ${tableName} ORDER BY rowid`).all();
}

function readRowsWhere(
  sqlite: Database.Database,
  tableName: string,
  where: string
): unknown[] {
  return sqlite
    .prepare(`SELECT * FROM ${tableName} WHERE ${where} ORDER BY rowid`)
    .all();
}
