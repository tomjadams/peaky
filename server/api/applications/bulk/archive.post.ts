import { applications } from "../../../data/applications";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const ids: unknown = body.ids;

  if (!ids || !Array.isArray(ids)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request: ids array required",
    });
  }

  const idsToArchive = new Set(ids as string[]);
  let archived = 0;

  for (const app of applications) {
    if (idsToArchive.has(app.id)) {
      app.archived = true;
      archived++;
    }
  }

  return {
    success: true,
    message: `Archived ${archived} application(s)`,
    ids,
  };
});
