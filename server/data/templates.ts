import type {
  TemplateCatalogEntry,
  TemplateRevisionDetail,
  TemplateStats,
} from "../../app/models";
import { templateDetail1 } from "./template-details-1";
import { templateDetail2 } from "./template-details-2";
import {
  createFixtureCatalogEntry,
  TEMPLATE_FIXTURE_IDENTITIES,
} from "./template-fixture-builders";

const sourceDetails: Record<string, TemplateRevisionDetail> = {
  ...templateDetail1,
  ...templateDetail2,
};

const fixtureSets = Object.values(TEMPLATE_FIXTURE_IDENTITIES).map(
  (identity) => {
    const source = sourceDetails[identity.templateId];
    if (!source)
      throw new Error(`Missing Template fixture ${identity.templateId}`);
    return createFixtureCatalogEntry(source, identity);
  }
);

export const templates: TemplateCatalogEntry[] = fixtureSets.map(
  ({ entry }) => entry
);

export const templateStatsById: Record<string, TemplateStats> = {
  "01932b3c-7d00-7000-8000-000000001001": {
    reviewsCount: 24,
    applicationsCount: 18,
    organizationsCount: 5,
  },
  "01932b3c-7d00-7000-8000-000000001002": {
    reviewsCount: 0,
    applicationsCount: 0,
    organizationsCount: 0,
  },
  "01932b3c-7d00-7000-8000-000000001003": {
    reviewsCount: 12,
    applicationsCount: 8,
    organizationsCount: 3,
  },
};

export const templateDetails: Record<string, TemplateRevisionDetail> =
  Object.fromEntries(
    fixtureSets.flatMap(({ details }) =>
      details.map((detail) => [detail.id, detail])
    )
  );

export const templateFixtureDrafts: TemplateRevisionDetail[] = Object.values(
  templateDetails
).filter((detail) => detail.status === "draft");

export function findSelectablePublishedRevisionDetail(
  revisionId: string
): TemplateRevisionDetail | undefined {
  const revision = templateDetails[revisionId];
  if (revision?.status !== "published") return undefined;
  const entry = templates.find(
    (candidate) => candidate.template.id === revision.templateId
  );
  if (
    entry?.template.status !== "active" ||
    !entry.publishedRevisions.some((candidate) => candidate.id === revisionId)
  )
    return undefined;
  return revision;
}

export function findPublishedTemplateRevisionDetail(
  templateOrRevisionId: string
): TemplateRevisionDetail | undefined {
  const direct = templateDetails[templateOrRevisionId];
  if (direct?.status === "published") return direct;
  const entry = templates.find(
    (candidate) => candidate.template.id === templateOrRevisionId
  );
  const revisionId = entry?.publishedRevisions[0]?.id;
  return revisionId ? templateDetails[revisionId] : undefined;
}
