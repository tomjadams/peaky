CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('team', 'product', 'organization')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS subjects_type_idx ON subjects(type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS subjects_status_idx ON subjects(status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS subject_component_links (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  component_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'contains',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS subject_component_links_subject_component_idx ON subject_component_links(subject_id, component_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS subject_component_links_subject_component_unique_idx ON subject_component_links(subject_id, component_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS templates_status_idx ON templates(status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_versions_template_idx ON template_versions(template_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS template_pillars (
  id TEXT PRIMARY KEY,
  template_version_id TEXT NOT NULL REFERENCES template_versions(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  order_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_pillars_template_version_idx ON template_pillars(template_version_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_pillars_order_idx ON template_pillars(order_key);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS template_questions (
  id TEXT PRIMARY KEY,
  pillar_id TEXT NOT NULL REFERENCES template_pillars(id) ON DELETE CASCADE,
  order_key TEXT NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'yes-no' CHECK(type IN ('yes-no', 'checklist')),
  risk_level TEXT CHECK(risk_level IN ('critical', 'high', 'medium', 'low')),
  importance TEXT,
  checklist_items TEXT,
  leading_practices TEXT,
  helpful_links TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_questions_pillar_idx ON template_questions(pillar_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_questions_order_idx ON template_questions(order_key);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS template_rules (
  id TEXT PRIMARY KEY,
  pillar_id TEXT NOT NULL REFERENCES template_pillars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  conditions TEXT NOT NULL,
  condition_groups TEXT,
  action TEXT NOT NULL,
  position TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_rules_pillar_idx ON template_rules(pillar_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'in-progress', 'completed', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS reviews_subject_idx ON reviews(subject_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS reviews_status_idx ON reviews(status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS review_template_selections (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  template_version_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS review_template_selections_review_idx ON review_template_selections(review_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS review_answer_state (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  answer TEXT,
  na_reason TEXT,
  item_na_reasons TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS review_answer_state_review_question_idx ON review_answer_state(review_id, question_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS review_answer_state_review_question_unique_idx ON review_answer_state(review_id, question_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS review_note_state (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('review', 'pillar', 'question')),
  scope_id TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS review_note_state_review_scope_idx ON review_note_state(review_id, scope_type, scope_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS review_attachments (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('review', 'pillar', 'question')),
  scope_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS review_attachments_review_idx ON review_attachments(review_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS review_score_state (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  score_type TEXT NOT NULL CHECK(score_type IN ('readiness', 'maturity')),
  numeric_score INTEGER,
  band TEXT,
  score_breakdown TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS review_score_state_review_idx ON review_score_state(review_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS review_participants (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('assessor', 'reviewer')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS review_participants_review_idx ON review_participants(review_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS review_participants_actor_idx ON review_participants(actor_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS review_events (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('user', 'integration', 'system')),
  actor_id TEXT NOT NULL,
  data TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'failed')),
  synced_at TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS review_events_review_idx ON review_events(review_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS review_events_occurred_at_idx ON review_events(occurred_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS review_events_status_idx ON review_events(status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS draft_answer_imports (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  run_id TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor_id TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS draft_answer_imports_review_idx ON draft_answer_imports(review_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS draft_answer_imports_source_idx ON draft_answer_imports(source);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS draft_answer_evidence (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL REFERENCES draft_answer_imports(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  answer TEXT,
  confidence TEXT,
  evidence TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS draft_answer_evidence_import_idx ON draft_answer_evidence(import_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS draft_answer_evidence_question_idx ON draft_answer_evidence(question_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS local_outbox (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'syncing', 'synced', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_error TEXT,
  synced_at TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS local_outbox_actor_status_idx ON local_outbox(actor_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS local_outbox_entity_idx ON local_outbox(entity_type, entity_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS entitlement_snapshots (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL UNIQUE,
  entitlements TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  refresh_at TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS entitlement_snapshots_actor_idx ON entitlement_snapshots(actor_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sync_cursors (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL UNIQUE,
  local_cursor TEXT,
  remote_cursor TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sync_cursors_actor_idx ON sync_cursors(actor_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS pending_review_queue (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN ('access_revoked', 'conflict', 'rejected')),
  local_payload TEXT,
  remote_payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolution TEXT CHECK(resolution IN ('keep_local', 'keep_remote', 'merged')),
  resolved_at TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pending_review_queue_actor_idx ON pending_review_queue(actor_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pending_review_queue_entity_idx ON pending_review_queue(entity_type, entity_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS product_profiles (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK(origin IN ('bespoke', 'open-source', 'vendor')),
  is_external INTEGER NOT NULL DEFAULT 0,
  product_manager_id TEXT NOT NULL,
  engineering_lead_id TEXT,
  team_ids TEXT NOT NULL DEFAULT '[]',
  component_ids TEXT NOT NULL DEFAULT '[]',
  roadmap_url TEXT,
  documentation_url TEXT,
  support_channel TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS product_profiles_subject_idx ON product_profiles(subject_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS team_profiles (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  org_name TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_profiles_subject_idx ON team_profiles(subject_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_profiles_org_idx ON team_profiles(org_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS template_drafts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'archived')),
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  remote_id TEXT,
  remote_synced_at TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_drafts_status_idx ON template_drafts(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_drafts_remote_idx ON template_drafts(remote_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS template_draft_pillars (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES template_drafts(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  order_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_pillars_draft_idx ON template_draft_pillars(draft_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_pillars_draft_slug_idx ON template_draft_pillars(draft_id, slug);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS template_draft_pillars_draft_slug_unique_idx ON template_draft_pillars(draft_id, slug);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_pillars_order_idx ON template_draft_pillars(draft_id, order_key);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS template_draft_questions (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES template_drafts(id) ON DELETE CASCADE,
  pillar_id TEXT NOT NULL REFERENCES template_draft_pillars(id) ON DELETE CASCADE,
  order_key TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'yes-no' CHECK(type IN ('yes-no', 'checklist')),
  text TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK(risk_level IN ('critical', 'high', 'medium', 'low')),
  importance TEXT DEFAULT '',
  checklist_items TEXT DEFAULT '[]',
  leading_practices TEXT DEFAULT '[]',
  helpful_links TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_questions_draft_idx ON template_draft_questions(draft_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_questions_pillar_idx ON template_draft_questions(pillar_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_questions_order_idx ON template_draft_questions(pillar_id, order_key);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS template_draft_rules (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES template_drafts(id) ON DELETE CASCADE,
  rule_set_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('workflow', 'maturity')),
  config TEXT NOT NULL,
  order_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_rules_draft_idx ON template_draft_rules(draft_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_rules_draft_ruleset_idx ON template_draft_rules(draft_id, rule_set_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS template_draft_rules_unique_idx ON template_draft_rules(draft_id, rule_set_id, rule_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS template_draft_imports (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES template_drafts(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK(source_type IN ('markdown', 'json')),
  source_file TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  conflicts TEXT DEFAULT '[]',
  resolved TEXT DEFAULT '[]'
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_imports_draft_idx ON template_draft_imports(draft_id);
