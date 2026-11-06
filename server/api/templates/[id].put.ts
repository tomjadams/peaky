import { createTemplateWriteUnavailableError } from "../../utils/templateWriteUnavailable";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Template ID is required",
    });
  }

  throw createTemplateWriteUnavailableError();
});
