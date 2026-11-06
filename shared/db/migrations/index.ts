export const SQLITE_MIGRATIONS_TABLE = "__orr_sqlite_migrations";

export type SQLiteMigrationMode = "legacy-inline" | "standard";

export interface LegacyInlineSchemaSnapshot {
  hasSchemaVersionTable: boolean;
  entitlementSnapshotColumns?: Iterable<string>;
  pendingReviewQueueColumns?: Iterable<string>;
}

export interface SQLiteMigration {
  id: string;
  mode: SQLiteMigrationMode;
  fileName: string;
}

export { getSQLiteMigrationSql } from "./sqlite-content";

const LEGACY_ENTITLEMENT_SNAPSHOT_COLUMNS = ["expires_at"] as const;
const LEGACY_PENDING_REVIEW_QUEUE_COLUMNS = [
  "local_data",
  "remote_data",
] as const;

export function splitMigrationStatements(sql: string): string[] {
  return sql
    .split(/--> statement-breakpoint\s*/g)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export const SQLITE_MIGRATIONS: SQLiteMigration[] = [
  {
    id: "0000_legacy_inline_client_upgrade",
    mode: "legacy-inline",
    fileName: "0000_legacy_inline_client_upgrade.sql",
  },
  {
    id: "0001_initial",
    mode: "standard",
    fileName: "0001_initial.sql",
  },
  {
    id: "0002_catalog_directory_mirror",
    mode: "standard",
    fileName: "0002_catalog_directory_mirror.sql",
  },
  {
    id: "0003_catalog_directory_mirror",
    mode: "standard",
    fileName: "0003_catalog_directory_mirror.sql",
  },
  {
    id: "0004_review_attachment_actor",
    mode: "standard",
    fileName: "0004_review_attachment_actor.sql",
  },
  {
    id: "0005_rename_review_events_to_domain_events",
    mode: "standard",
    fileName: "0005_rename_review_events_to_domain_events.sql",
  },
  {
    id: "0006_domain_events_decouple_fk",
    mode: "standard",
    fileName: "0006_domain_events_decouple_fk.sql",
  },
  {
    id: "0007_domain_events_rename_source_values",
    mode: "standard",
    fileName: "0007_domain_events_rename_source_values.sql",
  },
  {
    id: "0008_cloudevents_rename_time",
    mode: "standard",
    fileName: "0008_cloudevents_rename_time.sql",
  },
  {
    id: "0009_rename_domain_events_to_events",
    mode: "standard",
    fileName: "0009_rename_domain_events_to_events.sql",
  },
  {
    id: "0010_events_cloudevents_columns_and_local_status",
    mode: "standard",
    fileName: "0010_events_cloudevents_columns_and_local_status.sql",
  },
  {
    id: "0011_remove_low_severity",
    mode: "standard",
    fileName: "0011_remove_low_severity.sql",
  },
  {
    id: "0012_sync_engine_schema",
    mode: "standard",
    fileName: "0012_sync_engine_schema.sql",
  },
  {
    id: "0013_field_version_events",
    mode: "standard",
    fileName: "0013_field_version_events.sql",
  },
  {
    id: "0014_events_root_refs",
    mode: "standard",
    fileName: "0014_events_root_refs.sql",
  },
  {
    id: "0015_remove_template_rules",
    mode: "standard",
    fileName: "0015_remove_template_rules.sql",
  },
  {
    id: "0016_template_revisions",
    mode: "standard",
    fileName: "0016_template_revisions.sql",
  },
  {
    id: "0017_maturity_definition",
    mode: "standard",
    fileName: "0017_maturity_definition.sql",
  },
  {
    id: "0018_review_maturity_overrides",
    mode: "standard",
    fileName: "0018_review_maturity_overrides.sql",
  },
  {
    id: "0019_review_handoff_practices",
    mode: "standard",
    fileName: "0019_review_handoff_practices.sql",
  },
  {
    id: "0020_review_handoff_associations",
    mode: "standard",
    fileName: "0020_review_handoff_associations.sql",
  },
  {
    id: "0021_local_review_handoff_lifecycle",
    mode: "standard",
    fileName: "0021_local_review_handoff_lifecycle.sql",
  },
];

export const LATEST_SQLITE_MIGRATION_ID = SQLITE_MIGRATIONS.at(-1)?.id ?? null;

function includesAllColumns(
  columns: Iterable<string> | undefined,
  requiredColumns: readonly string[]
): boolean {
  if (!columns) {
    return false;
  }

  const availableColumns = new Set(columns);
  return requiredColumns.every((column) => availableColumns.has(column));
}

export function shouldIncludeLegacyInlineMigration(
  snapshot: LegacyInlineSchemaSnapshot
): boolean {
  if (!snapshot.hasSchemaVersionTable) {
    return false;
  }

  return (
    includesAllColumns(
      snapshot.entitlementSnapshotColumns,
      LEGACY_ENTITLEMENT_SNAPSHOT_COLUMNS
    ) &&
    includesAllColumns(
      snapshot.pendingReviewQueueColumns,
      LEGACY_PENDING_REVIEW_QUEUE_COLUMNS
    )
  );
}

export function getSQLiteMigrations(options?: {
  includeLegacyInline?: boolean;
}): SQLiteMigration[] {
  return SQLITE_MIGRATIONS.filter((migration) => {
    switch (migration.mode) {
      case "standard":
        return true;
      case "legacy-inline":
        return options?.includeLegacyInline ?? false;
    }

    const exhaustiveCheck: never = migration.mode;
    return exhaustiveCheck;
  });
}
