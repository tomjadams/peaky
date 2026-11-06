import type { TemplateCatalogEntry } from "../../../app/models";
import { templateStatsById, templates } from "../../data/templates";

const TEMPLATE_STATUSES = new Set(["active", "archived"]);

export default defineEventHandler((event) => {
  const status = getQuery(event).status;
  if (
    status !== undefined &&
    (typeof status !== "string" || !TEMPLATE_STATUSES.has(status))
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Template lifecycle status",
    });
  }

  const response: TemplateCatalogEntry[] = [];
  for (const entry of templates) {
    if (status && entry.template.status !== status) continue;
    response.push({
      ...entry,
      reviewsCount: templateStatsById[entry.template.id]?.reviewsCount ?? 0,
    });
  }
  return { templates: response };
});
