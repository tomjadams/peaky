import { templateDetails, templates } from "../../data/templates";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Template ID is required",
    });
  }

  const entry = templates.find(
    (candidate) =>
      candidate.template.id === id ||
      candidate.publishedRevisions.some((revision) => revision.id === id) ||
      slugify(candidate.template.name) === id
  );
  if (!entry) {
    throw createError({
      statusCode: 404,
      statusMessage: "Template not found",
    });
  }
  const revisionSummary =
    entry.publishedRevisions.find((revision) => revision.id === id) ??
    entry.publishedRevisions[0];
  const revision = revisionSummary
    ? (templateDetails[revisionSummary.id] ?? null)
    : null;
  return { template: entry.template, revision };
});
