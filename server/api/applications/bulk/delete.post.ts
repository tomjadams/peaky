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

  const idsToDelete = new Set(ids as string[]);
  let removed = 0;

  for (let i = applications.length - 1; i >= 0; i--) {
    if (idsToDelete.has(applications[i]!.id)) {
      applications.splice(i, 1);
      removed++;
    }
  }

  return {
    success: true,
    message: `Deleted ${removed} application(s)`,
    ids,
  };
});
