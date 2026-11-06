import { asc, eq, withDatabase } from "~/local-db";
import { getDirectoryGroupAliases } from "./groups";
import {
  catalogDirectoryMirrorMeta,
  catalogComponents,
  directoryGroups,
  directoryUsers,
} from "#shared/db/schema";
import type {
  CatalogComponent,
  CatalogDirectoryMirrorSnapshot,
  DirectoryGroup,
  DirectoryUser,
} from "#shared/catalog-directory-mirror";
import {
  buildCatalogComponentRows,
  buildDirectoryGroupRows,
  buildDirectoryUserRows,
  toCatalogComponent,
  toDirectoryGroup,
  toDirectoryUser,
} from "./mappers";

const CATALOG_DIRECTORY_RESOURCE_META_ID = {
  users: "catalog-directory-users",
  groups: "catalog-directory-groups",
  components: "catalog-directory-components",
} as const;

type CatalogDirectoryResourceKind =
  keyof typeof CATALOG_DIRECTORY_RESOURCE_META_ID;

const resourceBootstrapPromises = new Map<
  CatalogDirectoryResourceKind,
  Promise<void>
>();

interface CatalogDirectoryMirrorMetaRecord {
  version: string;
  syncedAt: string;
}

interface CatalogDirectoryMirrorRemoteMetaRecord {
  version: string;
  generatedAt: string;
}

function buildSnapshotWithUsers(
  meta: CatalogDirectoryMirrorRemoteMetaRecord,
  users: DirectoryUser[]
): CatalogDirectoryMirrorSnapshot {
  return {
    version: meta.version,
    generatedAt: meta.generatedAt,
    users,
    groups: [],
    components: [],
  };
}

function buildSnapshotWithGroups(
  meta: CatalogDirectoryMirrorRemoteMetaRecord,
  groups: DirectoryGroup[]
): CatalogDirectoryMirrorSnapshot {
  return {
    version: meta.version,
    generatedAt: meta.generatedAt,
    users: [],
    groups,
    components: [],
  };
}

function buildSnapshotWithComponents(
  meta: CatalogDirectoryMirrorRemoteMetaRecord,
  components: CatalogComponent[]
): CatalogDirectoryMirrorSnapshot {
  return {
    version: meta.version,
    generatedAt: meta.generatedAt,
    users: [],
    groups: [],
    components,
  };
}

async function fetchCatalogDirectoryMirrorMeta(): Promise<CatalogDirectoryMirrorRemoteMetaRecord> {
  const response = await fetch("/api/catalog-directory-mirror/meta");

  if (!response.ok) {
    throw new Error("Failed to load catalog directory mirror metadata");
  }

  return (await response.json()) as CatalogDirectoryMirrorRemoteMetaRecord;
}

async function upsertCatalogDirectoryMirrorMeta(
  resource: CatalogDirectoryResourceKind,
  meta: CatalogDirectoryMirrorRemoteMetaRecord
): Promise<void> {
  await withDatabase(async (db) => {
    await db
      .insert(catalogDirectoryMirrorMeta)
      .values({
        id: CATALOG_DIRECTORY_RESOURCE_META_ID[resource],
        version: meta.version,
        syncedAt: meta.generatedAt,
      })
      .onConflictDoUpdate({
        target: catalogDirectoryMirrorMeta.id,
        set: {
          version: meta.version,
          syncedAt: meta.generatedAt,
        },
      });
  });
}

async function bootstrapDirectoryUsersOnce(): Promise<void> {
  const meta = await fetchCatalogDirectoryMirrorMeta();
  const currentMeta = await getCatalogDirectoryMirrorMeta("users");

  if (
    currentMeta?.version === meta.version &&
    currentMeta.syncedAt === meta.generatedAt
  ) {
    return;
  }

  const response = await fetch("/api/catalog-directory-mirror/users");

  if (!response.ok) {
    throw new Error("Failed to load directory users");
  }

  const users = (await response.json()) as DirectoryUser[];
  const snapshot = buildSnapshotWithUsers(meta, users);

  await withDatabase(async (db) => {
    await db.delete(directoryUsers);

    if (snapshot.users.length > 0) {
      await db.insert(directoryUsers).values(buildDirectoryUserRows(snapshot));
    }
  });

  await upsertCatalogDirectoryMirrorMeta("users", meta);
}

async function bootstrapDirectoryGroupsOnce(): Promise<void> {
  const meta = await fetchCatalogDirectoryMirrorMeta();
  const currentMeta = await getCatalogDirectoryMirrorMeta("groups");

  if (
    currentMeta?.version === meta.version &&
    currentMeta.syncedAt === meta.generatedAt
  ) {
    return;
  }

  const response = await fetch("/api/catalog-directory-mirror/groups");

  if (!response.ok) {
    throw new Error("Failed to load directory groups");
  }

  const groups = (await response.json()) as DirectoryGroup[];
  const snapshot = buildSnapshotWithGroups(meta, groups);

  await withDatabase(async (db) => {
    await db.delete(directoryGroups);

    if (snapshot.groups.length > 0) {
      await db
        .insert(directoryGroups)
        .values(buildDirectoryGroupRows(snapshot));
    }
  });

  await upsertCatalogDirectoryMirrorMeta("groups", meta);
}

async function bootstrapCatalogComponentsOnce(): Promise<void> {
  const meta = await fetchCatalogDirectoryMirrorMeta();
  const currentMeta = await getCatalogDirectoryMirrorMeta("components");

  if (
    currentMeta?.version === meta.version &&
    currentMeta.syncedAt === meta.generatedAt
  ) {
    return;
  }

  const response = await fetch("/api/catalog-directory-mirror/components");

  if (!response.ok) {
    throw new Error("Failed to load catalog components");
  }

  const components = (await response.json()) as CatalogComponent[];
  const snapshot = buildSnapshotWithComponents(meta, components);

  await withDatabase(async (db) => {
    await db.delete(catalogComponents);

    if (snapshot.components.length > 0) {
      await db
        .insert(catalogComponents)
        .values(buildCatalogComponentRows(snapshot));
    }
  });

  await upsertCatalogDirectoryMirrorMeta("components", meta);
}

async function bootstrapCatalogDirectoryMirrorResource(
  resource: CatalogDirectoryResourceKind
): Promise<void> {
  const existingPromise = resourceBootstrapPromises.get(resource);

  if (existingPromise) {
    return existingPromise;
  }

  const bootstrapPromise = (() => {
    switch (resource) {
      case "users":
        return bootstrapDirectoryUsersOnce();
      case "groups":
        return bootstrapDirectoryGroupsOnce();
      case "components":
        return bootstrapCatalogComponentsOnce();
    }
  })().catch((error) => {
    resourceBootstrapPromises.delete(resource);
    throw error;
  });

  resourceBootstrapPromises.set(resource, bootstrapPromise);
  await bootstrapPromise;
}

export async function bootstrapCatalogDirectoryMirror(): Promise<void> {
  await Promise.all([
    bootstrapCatalogDirectoryMirrorResource("users"),
    bootstrapCatalogDirectoryMirrorResource("groups"),
    bootstrapCatalogDirectoryMirrorResource("components"),
  ]);
}

async function ensureCatalogDirectoryMirrorReady(
  resource: CatalogDirectoryResourceKind
): Promise<void> {
  await bootstrapCatalogDirectoryMirrorResource(resource);
}

export async function getCatalogDirectoryMirrorMeta(
  resource: CatalogDirectoryResourceKind
): Promise<CatalogDirectoryMirrorMetaRecord | null> {
  return withDatabase(async (db) => {
    const [meta] = await db
      .select()
      .from(catalogDirectoryMirrorMeta)
      .where(
        eq(
          catalogDirectoryMirrorMeta.id,
          CATALOG_DIRECTORY_RESOURCE_META_ID[resource]
        )
      )
      .limit(1);

    return meta
      ? {
          version: meta.version,
          syncedAt: meta.syncedAt,
        }
      : null;
  });
}

export async function fetchDirectoryUsers(): Promise<DirectoryUser[]> {
  await ensureCatalogDirectoryMirrorReady("users");

  return withDatabase(async (db) => {
    const rows = await db
      .select()
      .from(directoryUsers)
      .orderBy(asc(directoryUsers.displayName));

    return rows.map(toDirectoryUser);
  });
}

export async function fetchDirectoryUserById(
  id: string
): Promise<DirectoryUser | null> {
  await ensureCatalogDirectoryMirrorReady("users");

  return withDatabase(async (db) => {
    const [row] = await db
      .select()
      .from(directoryUsers)
      .where(eq(directoryUsers.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    return toDirectoryUser(row);
  });
}

export async function fetchPersistedDirectoryGroups(): Promise<
  DirectoryGroup[]
> {
  return withDatabase(async (db) => {
    const rows = await db
      .select()
      .from(directoryGroups)
      .orderBy(asc(directoryGroups.displayName));

    return rows.map(toDirectoryGroup);
  });
}

export async function fetchDirectoryGroups(): Promise<DirectoryGroup[]> {
  await ensureCatalogDirectoryMirrorReady("groups");
  return fetchPersistedDirectoryGroups();
}

export async function fetchDirectoryGroupById(
  id: string
): Promise<DirectoryGroup | null> {
  await ensureCatalogDirectoryMirrorReady("groups");

  return withDatabase(async (db) => {
    const [row] = await db
      .select()
      .from(directoryGroups)
      .where(eq(directoryGroups.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    return toDirectoryGroup(row);
  });
}

export async function fetchCatalogComponents(): Promise<CatalogComponent[]> {
  await ensureCatalogDirectoryMirrorReady("components");

  return withDatabase(async (db) => {
    const rows = await db
      .select()
      .from(catalogComponents)
      .orderBy(asc(catalogComponents.displayName));

    return rows.map(toCatalogComponent);
  });
}

export async function fetchCatalogComponentById(
  id: string
): Promise<CatalogComponent | null> {
  await ensureCatalogDirectoryMirrorReady("components");

  return withDatabase(async (db) => {
    const [row] = await db
      .select()
      .from(catalogComponents)
      .where(eq(catalogComponents.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    return toCatalogComponent(row);
  });
}

export async function fetchCatalogComponentsByOwnerGroup(
  ownerGroupId: string
): Promise<CatalogComponent[]> {
  await Promise.all([
    ensureCatalogDirectoryMirrorReady("groups"),
    ensureCatalogDirectoryMirrorReady("components"),
  ]);

  return withDatabase(async (db) => {
    const groupRows = await db
      .select()
      .from(directoryGroups)
      .orderBy(asc(directoryGroups.displayName));
    const groupAliases = new Set(
      getDirectoryGroupAliases(groupRows.map(toDirectoryGroup), ownerGroupId)
    );

    const rows = await db
      .select()
      .from(catalogComponents)
      .orderBy(asc(catalogComponents.displayName));

    return rows.map(toCatalogComponent).filter((component) => {
      if (!component.ownerGroupId) {
        return false;
      }

      return groupAliases.has(component.ownerGroupId);
    });
  });
}
