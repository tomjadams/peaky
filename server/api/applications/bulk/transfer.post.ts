import { applications } from "../../../data/applications";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const ids: unknown = body.ids;
  const { newOwner } = body;

  if (!ids || !Array.isArray(ids)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request: ids array required",
    });
  }

  if (!newOwner) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request: newOwner required",
    });
  }

  const idsToTransfer = new Set(ids as string[]);
  let transferred = 0;

  for (const app of applications) {
    if (idsToTransfer.has(app.id)) {
      app.owner = newOwner;
      transferred++;
    }
  }

  return {
    success: true,
    message: `Transferred ${transferred} application(s) to ${newOwner}`,
    ids,
    newOwner,
  };
});
