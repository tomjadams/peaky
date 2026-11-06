import { getCatalogDirectoryMirrorSnapshot } from "../../data/catalog-directory-mirror";

// Legacy Workday prefixes that should never be exposed to clients.
const isLegacyWorkdayGroup = (id: string): boolean =>
  id.startsWith("T_") || id.startsWith("TS_");

export default defineEventHandler((event) => {
  setHeader(
    event,
    "cache-control",
    "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
  );

  const groups = getCatalogDirectoryMirrorSnapshot().groups;
  return groups.filter((group) => !isLegacyWorkdayGroup(group.id));
});
