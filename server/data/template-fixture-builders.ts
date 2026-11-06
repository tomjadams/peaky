import type {
  TemplateCatalogEntry,
  TemplateRevisionDetail,
} from "../../app/models";
import {
  buildDefaultMaturityDefinition,
  scorableQuestionsFromRevision,
} from "../../app/services/maturity/defaults";
import { serializeMaturityDefinition } from "../../app/services/maturity/persistence";
import { toTemplateRevisionSummary } from "../../app/services/template/TemplateRevisionContracts";

export const SYSTEM_ACTOR_ID = "actor-system";
export const FIXTURE_OWNER_TEAM_ID = "team-platform";

export interface TemplateFixtureIdentity {
  templateId: string;
  publishedRevisionId?: string;
  draftRevisionId: string;
}

export const TEMPLATE_FIXTURE_IDENTITIES = {
  orr: {
    templateId: "01932b3c-7d00-7000-8000-000000001001",
    publishedRevisionId: "01932b3c-7d00-7000-8100-000000001001",
    draftRevisionId: "01932b3c-7d00-7000-8200-000000001001",
  },
  pci: {
    templateId: "01932b3c-7d00-7000-8000-000000001002",
    draftRevisionId: "01932b3c-7d00-7000-8200-000000001002",
  },
  gdpr: {
    templateId: "01932b3c-7d00-7000-8000-000000001003",
    publishedRevisionId: "01932b3c-7d00-7000-8100-000000001003",
    draftRevisionId: "01932b3c-7d00-7000-8200-000000001003",
  },
  soc2: {
    templateId: "01932b3c-7d00-7000-8000-000000001004",
    publishedRevisionId: "01932b3c-7d00-7000-8100-000000001004",
    draftRevisionId: "01932b3c-7d00-7000-8200-000000001004",
  },
} as const satisfies Record<string, TemplateFixtureIdentity>;

function copyContentWithRevisionIdentity(
  source: TemplateRevisionDetail,
  revisionId: string
): TemplateRevisionDetail["pillars"] {
  return source.pillars.map((pillar, pillarIndex) => {
    const pillarOrdinal = String(pillarIndex + 1).padStart(2, "0");
    return {
      ...pillar,
      id: `${revisionId}:pillar:${pillarOrdinal}`,
      templateRevisionId: revisionId,
      questions: pillar.questions.map((question, questionIndex) => ({
        ...question,
        id: `${revisionId}:question:${pillarOrdinal}:${String(
          questionIndex + 1
        ).padStart(2, "0")}`,
      })),
    };
  });
}

export function createFixtureRevision(
  source: TemplateRevisionDetail,
  revisionId: string,
  status: "draft" | "published"
): TemplateRevisionDetail {
  const published = status === "published";
  const pillars = copyContentWithRevisionIdentity(source, revisionId);
  const revision: TemplateRevisionDetail = {
    ...source,
    id: revisionId,
    status,
    revisionNumber: published ? 1 : null,
    revisionSummary: published ? source.revisionSummary : null,
    createdByActorId: SYSTEM_ACTOR_ID,
    updatedByActorId: SYSTEM_ACTOR_ID,
    publishedByActorId: published ? SYSTEM_ACTOR_ID : null,
    publishedAt: published ? (source.publishedAt ?? source.updatedAt) : null,
    pillars,
  };
  // Deterministic backfill while template writes are frozen
  // (maturity-score/REQ-009; AC-010): published fixture Revisions carry the
  // configured-default definition built from their own re-scoped content;
  // drafts stay undefined (the explicit no-definition state, AC-060).
  revision.maturityDefinition = published
    ? serializeMaturityDefinition(
        buildDefaultMaturityDefinition(scorableQuestionsFromRevision(revision))
      )
    : null;
  return revision;
}

export function createFixtureCatalogEntry(
  source: TemplateRevisionDetail,
  identity: TemplateFixtureIdentity
): {
  entry: TemplateCatalogEntry;
  details: TemplateRevisionDetail[];
} {
  const draft = createFixtureRevision(
    source,
    identity.draftRevisionId,
    "draft"
  );
  const published = identity.publishedRevisionId
    ? createFixtureRevision(source, identity.publishedRevisionId, "published")
    : null;
  const details = published ? [published, draft] : [draft];
  return {
    entry: {
      template: {
        id: identity.templateId,
        name: source.name,
        description: source.description,
        status: "active",
        ownerTeamId: FIXTURE_OWNER_TEAM_ID,
        createdByActorId: SYSTEM_ACTOR_ID,
        updatedByActorId: SYSTEM_ACTOR_ID,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
      },
      draftRevision: toTemplateRevisionSummary(draft),
      publishedRevisions: published
        ? [toTemplateRevisionSummary(published)]
        : [],
      pillarSlugsByRevisionId: Object.fromEntries(
        details.map((detail) => [
          detail.id,
          detail.pillars.map((pillar) => pillar.slug),
        ])
      ),
      reviewsCount: published ? undefined : 0,
    },
    details,
  };
}
