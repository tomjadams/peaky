import type { CatalogDirectoryMirrorSnapshot } from "#shared/catalog-directory-mirror";
import { getFallbackCatalogDirectoryMirrorSnapshot } from "./catalog-directory-mirror-fallback";
import bundledSnapshot from "./catalog-directory-mirror.snapshot.json";

let cachedSnapshot: CatalogDirectoryMirrorSnapshot | null = null;

function loadBundledSnapshot(): CatalogDirectoryMirrorSnapshot | null {
  const snapshot = bundledSnapshot as CatalogDirectoryMirrorSnapshot;

  if (
    snapshot.users.length === 0 &&
    snapshot.groups.length === 0 &&
    snapshot.components.length === 0
  ) {
    return null;
  }

  return snapshot;
}

export function getCatalogDirectoryMirrorSnapshot(): CatalogDirectoryMirrorSnapshot {
  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  cachedSnapshot =
    loadBundledSnapshot() ?? getFallbackCatalogDirectoryMirrorSnapshot();
  return cachedSnapshot;
}
