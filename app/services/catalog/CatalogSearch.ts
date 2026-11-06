import Fuse from "fuse.js";
import {
  fetchDirectoryUserById,
  fetchDirectoryUsers,
  fetchDirectoryGroups,
  fetchCatalogComponents,
  fetchCatalogComponentById,
  fetchCatalogComponentsByOwnerGroup,
} from "~/catalog-directory-mirror/local";
import { dedupeDirectoryGroups } from "~/catalog-directory-mirror/groups";
import type {
  DirectoryUser,
  DirectoryGroup,
  CatalogComponent as MirrorCatalogComponent,
} from "#shared/catalog-directory-mirror";

export interface CatalogUser extends DirectoryUser {
  id: string;
  displayName: string;
  description?: string;
}

export interface CatalogGroup extends DirectoryGroup {
  id: string;
  displayName: string;
  description?: string;
}

export interface CatalogComponent extends MirrorCatalogComponent {
  id: string;
  displayName: string;
  description?: string;
}

const FUSE_OPTIONS = {
  keys: ["displayName", "id"],
  threshold: 0.4,
  ignoreLocation: true,
};

function fuzzySearch<T>(items: T[], query: string): T[] {
  const trimmed = query.trim();
  if (!trimmed) return items;

  const fuse = new Fuse(items, FUSE_OPTIONS);
  return fuse.search(trimmed).map((r) => r.item);
}

export class CatalogSearch {
  async searchUsers(query: string): Promise<CatalogUser[]> {
    const users = await fetchDirectoryUsers();
    return fuzzySearch(users as CatalogUser[], query);
  }

  async searchGroups(query: string): Promise<CatalogGroup[]> {
    const groups = await fetchDirectoryGroups();
    const deduped = dedupeDirectoryGroups(groups);
    return fuzzySearch(deduped as CatalogGroup[], query);
  }

  async searchComponents(query: string): Promise<CatalogComponent[]> {
    const components = await fetchCatalogComponents();
    return fuzzySearch(components as CatalogComponent[], query);
  }

  async resolveUser(id: string): Promise<CatalogUser | null> {
    if (!id.trim()) return null;
    const user = await fetchDirectoryUserById(id);
    return (user as CatalogUser | undefined) ?? null;
  }

  async resolveComponent(id: string): Promise<CatalogComponent | null> {
    if (!id.trim()) return null;
    const component = await fetchCatalogComponentById(id);
    return (component as CatalogComponent | undefined) ?? null;
  }

  async fetchComponentsForGroup(groupId: string): Promise<CatalogComponent[]> {
    return fetchCatalogComponentsByOwnerGroup(groupId) as Promise<
      CatalogComponent[]
    >;
  }
}

export const catalogSearch = new CatalogSearch();
