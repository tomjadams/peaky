import {
  getSQLiteMigrations,
  getSQLiteMigrationSql,
} from "../../../../shared/db/migrations";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Migration ID is required",
    });
  }

  const migration = getSQLiteMigrations({ includeLegacyInline: true }).find(
    (entry) => entry.id === id
  );

  if (!migration) {
    throw createError({
      statusCode: 404,
      statusMessage: "Migration not found",
    });
  }

  setHeader(event, "content-type", "text/plain; charset=utf-8");
  return getSQLiteMigrationSql(migration);
});
