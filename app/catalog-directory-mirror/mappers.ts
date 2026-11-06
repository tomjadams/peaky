import type {
  CatalogComponent,
  CatalogDirectoryMirrorSnapshot,
  DirectoryGroup,
  DirectoryUser,
} from "#shared/catalog-directory-mirror";
import type * as DbSchema from "#shared/db/schema";

type SchemaModule = typeof DbSchema;
type DirectoryUserRow = SchemaModule["directoryUsers"]["$inferSelect"];
type DirectoryGroupRow = SchemaModule["directoryGroups"]["$inferSelect"];
type CatalogComponentRow = SchemaModule["catalogComponents"]["$inferSelect"];

export function buildDirectoryUserRows(
  snapshot: CatalogDirectoryMirrorSnapshot
): DirectoryUserRow[] {
  return snapshot.users.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    updatedAt: snapshot.generatedAt,
    sourceVersion: snapshot.version,
  }));
}

export function buildDirectoryGroupRows(
  snapshot: CatalogDirectoryMirrorSnapshot
): DirectoryGroupRow[] {
  return snapshot.groups.map((group) => ({
    id: group.id,
    displayName: group.displayName,
    description: group.description ?? null,
    orgId: group.orgId ?? null,
    orgName: group.orgName ?? null,
    memberCount: group.memberCount ?? 0,
    updatedAt: snapshot.generatedAt,
    sourceVersion: snapshot.version,
  }));
}

export function buildCatalogComponentRows(
  snapshot: CatalogDirectoryMirrorSnapshot
): CatalogComponentRow[] {
  return snapshot.components.map((component) => ({
    id: component.id,
    displayName: component.displayName,
    description: component.description ?? null,
    type: component.type ?? null,
    ownerGroupId: component.ownerGroupId ?? null,
    ownerGroupName: component.ownerGroupName ?? null,
    lifecycle: component.lifecycle ?? null,
    system: component.system ?? null,
    updatedAt: snapshot.generatedAt,
    sourceVersion: snapshot.version,
  }));
}

export function toDirectoryUser(row: DirectoryUserRow): DirectoryUser {
  return {
    id: row.id,
    displayName: row.displayName,
  };
}

export function toDirectoryGroup(row: DirectoryGroupRow): DirectoryGroup {
  return {
    id: row.id,
    displayName: row.displayName,
    description: row.description ?? undefined,
    orgId: row.orgId ?? undefined,
    orgName: row.orgName ?? undefined,
    memberCount: row.memberCount,
  };
}

export function toCatalogComponent(row: CatalogComponentRow): CatalogComponent {
  return {
    id: row.id,
    displayName: row.displayName,
    description: row.description ?? undefined,
    type: row.type ?? undefined,
    ownerGroupId: row.ownerGroupId ?? undefined,
    ownerGroupName: row.ownerGroupName ?? undefined,
    lifecycle: row.lifecycle ?? undefined,
    system: row.system ?? undefined,
  };
}
