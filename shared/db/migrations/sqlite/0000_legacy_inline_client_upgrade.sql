ALTER TABLE entitlement_snapshots RENAME TO entitlement_snapshots__legacy;
--> statement-breakpoint
CREATE TABLE entitlement_snapshots (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL UNIQUE,
  entitlements TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  refresh_at TEXT
);
--> statement-breakpoint
INSERT INTO entitlement_snapshots (
  id,
  actor_id,
  entitlements,
  snapshot_version,
  valid_until,
  created_at,
  refresh_at
)
SELECT
  id,
  actor_id,
  entitlements,
  snapshot_version,
  expires_at,
  created_at,
  NULL
FROM entitlement_snapshots__legacy;
--> statement-breakpoint
DROP TABLE entitlement_snapshots__legacy;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS entitlement_snapshots_actor_idx ON entitlement_snapshots(actor_id);
--> statement-breakpoint
ALTER TABLE pending_review_queue RENAME TO pending_review_queue__legacy;
--> statement-breakpoint
CREATE TABLE pending_review_queue (
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
INSERT INTO pending_review_queue (
  id,
  actor_id,
  entity_type,
  entity_id,
  reason,
  local_payload,
  remote_payload,
  created_at,
  resolution,
  resolved_at
)
SELECT
  id,
  actor_id,
  entity_type,
  entity_id,
  reason,
  local_data,
  remote_data,
  created_at,
  resolution,
  resolved_at
FROM pending_review_queue__legacy;
--> statement-breakpoint
DROP TABLE pending_review_queue__legacy;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pending_review_queue_actor_idx ON pending_review_queue(actor_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pending_review_queue_entity_idx ON pending_review_queue(entity_type, entity_id);
