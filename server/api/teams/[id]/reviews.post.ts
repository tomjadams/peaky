import { z } from "zod";
import type { Pillar, Review, ReviewTemplate } from "../../../../app/models";
import { EVENT_TYPES, addEvent } from "../../../data/review-events";
import { reviews } from "../../../data/reviews";
import { findSelectablePublishedRevisionDetail } from "../../../data/templates";
import { getTeamById } from "../../../data/teams";
import { getLifecycleActor } from "../../../utils/lifecycleActor";
import { getUniqueName } from "../../../utils/naming";

const createReviewSchema = z.object({
  name: z.string().trim().min(1).max(120),
  templateRevisionIds: z.array(z.string().trim().min(1)).min(1).max(3),
  applicationIds: z.array(z.string().trim().min(1)).optional(),
});

const toReviewPillars = (templateRevisionId: string): Pillar[] => {
  const detail = findSelectablePublishedRevisionDetail(templateRevisionId);

  if (!detail) return [];

  return detail.pillars.map((pillar) => ({
    slug: pillar.slug,
    name: pillar.name,
    progress: 0,
    totalQuestions: pillar.questions.length,
    answeredQuestions: 0,
  }));
};

const toReviewTemplate = (templateRevisionId: string): ReviewTemplate => {
  const detail = findSelectablePublishedRevisionDetail(templateRevisionId)!;

  return {
    templateId: detail.templateId,
    templateRevisionId: detail.id,
    templateName: detail.name,
    revisionNumber: detail.revisionNumber,
    revisionSummary: detail.revisionSummary,
    progress: 0,
    pillars: toReviewPillars(templateRevisionId),
  };
};

function buildNewReview(options: {
  uniqueName: string;
  teamId: string;
  team: NonNullable<ReturnType<typeof getTeamById>>;
  templates: ReviewTemplate[];
  templateRevisionIds: string[];
  applicationIds?: string[];
  previousTeamReview?: Review;
}): Review {
  const {
    uniqueName,
    teamId,
    team,
    templates,
    templateRevisionIds,
    applicationIds,
    previousTeamReview,
  } = options;
  const now = new Date().toISOString();
  return {
    id: `review-${Math.floor(Math.random() * 1000000)}`,
    name: uniqueName,
    teamId,
    orgId: team.orgId,
    applicationId: applicationIds?.[0],
    templateId: templates[0]?.templateId ?? "",
    templateRevisionId: templates[0]?.templateRevisionId,
    templateName: templates[0]?.templateName ?? "",
    pillars: templates[0]?.pillars ?? [],
    templateIds: templates.map((template) => template.templateId),
    templateRevisionIds,
    templateNames: templates.map((template) => template.templateName),
    templates,
    applicationIds,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    assessors: [...(previousTeamReview?.assessors ?? [])],
    advisors: [
      ...(previousTeamReview?.advisors ?? previousTeamReview?.reviewers ?? []),
    ],
    reviewers: [
      ...(previousTeamReview?.advisors ?? previousTeamReview?.reviewers ?? []),
    ],
  };
}

export default defineEventHandler(async (event) => {
  const teamId = getRouterParam(event, "id");

  if (!teamId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Team ID is required",
    });
  }

  const team = getTeamById(teamId);

  if (!team) {
    throw createError({
      statusCode: 404,
      statusMessage: "Team not found",
    });
  }

  const body = await readBody(event);
  const parsed = createReviewSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage:
        parsed.error.issues[0]?.message ?? "Invalid review payload",
    });
  }

  const { name, templateRevisionIds, applicationIds } = parsed.data;
  const existingNames = reviews
    .filter((review) => review.teamId === teamId)
    .map((review) => review.name);
  const uniqueName = getUniqueName(existingNames, name);

  if (new Set(templateRevisionIds).size !== templateRevisionIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Template Revision IDs must be distinct",
    });
  }
  const revisionDetails = templateRevisionIds.map(
    findSelectablePublishedRevisionDetail
  );
  const ineligibleRevisionIds = templateRevisionIds.filter(
    (_revisionId, index) => !revisionDetails[index]
  );
  if (ineligibleRevisionIds.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown or ineligible Template Revision IDs: ${ineligibleRevisionIds.join(", ")}`,
    });
  }
  const parentTemplateIds = revisionDetails.map((detail) => detail!.templateId);
  if (new Set(parentTemplateIds).size !== parentTemplateIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Selected Revisions must belong to distinct Templates",
    });
  }

  const templates = templateRevisionIds.map(toReviewTemplate);
  const previousTeamReview = reviews
    .filter((review) => review.teamId === teamId)
    .toSorted(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  const createdReview = buildNewReview({
    uniqueName,
    teamId,
    team,
    templates,
    templateRevisionIds,
    applicationIds,
    previousTeamReview,
  });

  reviews.push(createdReview);

  const actor = await getLifecycleActor(event);

  addEvent({
    reviewId: createdReview.id,
    eventType: EVENT_TYPES.REVIEW_CREATED,
    actorType: "user",
    actorId: actor.id,
    actorName: actor.name,
    data: {
      reviewName: uniqueName,
      teamId,
      teamName: team.name,
      templateCount: templateRevisionIds.length,
      templateNames: templates.map((t) => t.templateName),
      applicationCount: applicationIds?.length ?? 0,
    },
  });

  setResponseStatus(event, 201);
  return createdReview;
});
