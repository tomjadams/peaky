import { getCatalogDirectoryMirrorSnapshot } from "../../data/catalog-directory-mirror";

export default defineEventHandler((event) => {
  setHeader(
    event,
    "cache-control",
    "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
  );

  const snapshot = getCatalogDirectoryMirrorSnapshot();

  return {
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    usersCount: snapshot.users.length,
    groupsCount: snapshot.groups.length,
    componentsCount: snapshot.components.length,
  };
});
