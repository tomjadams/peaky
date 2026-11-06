import { applications } from "../../data/applications";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");

  const application = applications.find((app) => app.id === id);

  if (!application) {
    throw createError({
      statusCode: 404,
      statusMessage: "Application not found",
    });
  }

  return application;
});
