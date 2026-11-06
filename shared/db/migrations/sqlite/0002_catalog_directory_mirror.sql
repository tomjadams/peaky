CREATE TABLE IF NOT EXISTS directory_users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  source_version TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS directory_users_display_name_idx ON directory_users(display_name);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS directory_groups (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  org_id TEXT,
  org_name TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  source_version TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS directory_groups_display_name_idx ON directory_groups(display_name);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS directory_groups_org_id_idx ON directory_groups(org_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS catalog_components (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  type TEXT,
  owner_group_id TEXT,
  owner_group_name TEXT,
  lifecycle TEXT,
  system TEXT,
  updated_at TEXT NOT NULL,
  source_version TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS catalog_components_display_name_idx ON catalog_components(display_name);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS catalog_components_owner_group_id_idx ON catalog_components(owner_group_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS reference_snapshot_meta (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  synced_at TEXT NOT NULL
);
