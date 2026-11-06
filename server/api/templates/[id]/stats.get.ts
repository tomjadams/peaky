import { templateStatsById } from "../../../data/templates";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Template ID is required",
    });
  }

  const stats = templateStatsById[id] ?? {
    reviewsCount: 0,
    applicationsCount: 0,
    organizationsCount: 0,
  };

  return stats;
});
