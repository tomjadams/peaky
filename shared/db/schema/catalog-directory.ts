import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const directoryUsers = sqliteTable(
  "directory_users",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    updatedAt: text("updated_at").notNull(),
    sourceVersion: text("source_version").notNull(),
  },
  (table) => ({
    displayNameIdx: index("directory_users_display_name_idx").on(
      table.displayName
    ),
  })
);

export const directoryGroups = sqliteTable(
  "directory_groups",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    orgId: text("org_id"),
    orgName: text("org_name"),
    memberCount: integer("member_count").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
    sourceVersion: text("source_version").notNull(),
  },
  (table) => ({
    displayNameIdx: index("directory_groups_display_name_idx").on(
      table.displayName
    ),
    orgIdx: index("directory_groups_org_id_idx").on(table.orgId),
  })
);

export const catalogComponents = sqliteTable(
  "catalog_components",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    type: text("type"),
    ownerGroupId: text("owner_group_id"),
    ownerGroupName: text("owner_group_name"),
    lifecycle: text("lifecycle"),
    system: text("system"),
    updatedAt: text("updated_at").notNull(),
    sourceVersion: text("source_version").notNull(),
  },
  (table) => ({
    displayNameIdx: index("catalog_components_display_name_idx").on(
      table.displayName
    ),
    ownerGroupIdx: index("catalog_components_owner_group_id_idx").on(
      table.ownerGroupId
    ),
  })
);

export const catalogDirectoryMirrorMeta = sqliteTable(
  "catalog_directory_mirror_meta",
  {
    id: text("id").primaryKey(),
    version: text("version").notNull(),
    syncedAt: text("synced_at").notNull(),
  }
);
