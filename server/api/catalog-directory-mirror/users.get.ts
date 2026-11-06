import { getCatalogDirectoryMirrorSnapshot } from "../../data/catalog-directory-mirror";

export default defineEventHandler((event) => {
  setHeader(
    event,
    "cache-control",
    "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
  );

  return getCatalogDirectoryMirrorSnapshot().users;
});
