import { eq } from "drizzle-orm";
import type { ReviewWorkspace, WorkspaceSubject } from "~/models/workspace";
import {
  reviewAnswerState,
  reviewParticipants,
  reviews,
  reviewTemplateSelections,
  subjects,
} from "~/local-db";
import type {
  MaterializedAnswerRow,
  MaterializedParticipantRow,
  ReviewWorkspaceMaterializerTransaction,
  WorkspaceRevision,
} from "./ReviewWorkspaceMaterializer";

export async function persistReviewRoots(
  transaction: ReviewWorkspaceMaterializerTransaction,
  workspace: ReviewWorkspace,
  subject: WorkspaceSubject & {
    type: "team" | "product" | "organization";
  }
): Promise<void> {
  await transaction
    .insert(subjects)
    .values({
      id: subject.id,
      type: subject.type,
      name: subject.name,
      slug: subject.slug,
      status: "active",
      createdAt: workspace.review.createdAt,
      updatedAt: workspace.review.updatedAt,
    })
    .onConflictDoNothing();
  const persistedSubjects = await transaction
    .select({ id: subjects.id, type: subjects.type })
    .from(subjects)
    .where(eq(subjects.id, subject.id))
    .limit(1);
  if (persistedSubjects[0]?.type !== subject.type) {
    throw new Error(
      "The local Review owner identity does not match the server workspace."
    );
  }

  await transaction
    .insert(reviews)
    .values({
      id: workspace.review.id,
      subjectId: subject.id,
      name: workspace.review.name,
      status: workspace.review.status,
      createdAt: workspace.review.createdAt,
      updatedAt: workspace.review.updatedAt,
    })
    .onConflictDoNothing();
  const persistedReviews = await transaction
    .select({ id: reviews.id, subjectId: reviews.subjectId })
    .from(reviews)
    .where(eq(reviews.id, workspace.review.id))
    .limit(1);
  if (persistedReviews[0]?.subjectId !== subject.id) {
    throw new Error(
      "The local Review belongs to a different subject. Wait for sync before changing the handoff."
    );
  }
}

export async function persistReviewSelections(
  transaction: ReviewWorkspaceMaterializerTransaction,
  workspace: ReviewWorkspace,
  revisions: readonly WorkspaceRevision[]
): Promise<void> {
  const expectedByRevision = new Map(
    revisions.map((revision) => [revision.id, revision.position])
  );
  const existing = await transaction
    .select({
      templateRevisionId: reviewTemplateSelections.templateRevisionId,
      position: reviewTemplateSelections.position,
    })
    .from(reviewTemplateSelections)
    .where(eq(reviewTemplateSelections.reviewId, workspace.review.id));
  if (
    existing.some(
      (selection) =>
        expectedByRevision.get(selection.templateRevisionId) !==
        selection.position
    )
  ) {
    throw new Error(
      "The local Review has conflicting template revision selections."
    );
  }

  const existingRevisionIds = new Set(
    existing.map((selection) => selection.templateRevisionId)
  );
  for (const revision of revisions) {
    if (existingRevisionIds.has(revision.id)) continue;
    await transaction
      .insert(reviewTemplateSelections)
      .values({
        reviewId: workspace.review.id,
        templateRevisionId: revision.id,
        position: revision.position,
        createdAt: workspace.review.createdAt,
      })
      .onConflictDoNothing();
  }

  const finalSelections = await transaction
    .select({
      templateRevisionId: reviewTemplateSelections.templateRevisionId,
      position: reviewTemplateSelections.position,
    })
    .from(reviewTemplateSelections)
    .where(eq(reviewTemplateSelections.reviewId, workspace.review.id));
  if (
    finalSelections.length !== revisions.length ||
    finalSelections.some(
      (selection) =>
        expectedByRevision.get(selection.templateRevisionId) !==
        selection.position
    )
  ) {
    throw new Error(
      "The local Review template revision selections are incomplete."
    );
  }
}

export async function persistReviewAnswers(
  transaction: ReviewWorkspaceMaterializerTransaction,
  reviewId: string,
  knownQuestionIds: ReadonlySet<string>,
  expected: readonly MaterializedAnswerRow[]
): Promise<void> {
  const existing = await transaction
    .select({
      id: reviewAnswerState.id,
      questionId: reviewAnswerState.questionId,
    })
    .from(reviewAnswerState)
    .where(eq(reviewAnswerState.reviewId, reviewId));
  if (existing.some((answer) => !knownQuestionIds.has(answer.questionId))) {
    throw new Error(
      "The local Review has answers outside its pinned snapshot."
    );
  }

  const existingQuestionIds = new Set(
    existing.map((answer) => answer.questionId)
  );
  for (const answer of expected) {
    if (existingQuestionIds.has(answer.questionId)) continue;
    await transaction
      .insert(reviewAnswerState)
      .values(answer)
      .onConflictDoNothing();
  }

  const finalAnswers = await transaction
    .select({ questionId: reviewAnswerState.questionId })
    .from(reviewAnswerState)
    .where(eq(reviewAnswerState.reviewId, reviewId));
  const finalQuestionIds = new Set(
    finalAnswers.map((answer) => answer.questionId)
  );
  if (expected.some((answer) => !finalQuestionIds.has(answer.questionId))) {
    throw new Error("The local Review answer graph is incomplete.");
  }
}

export async function persistReviewParticipants(
  transaction: ReviewWorkspaceMaterializerTransaction,
  reviewId: string,
  expected: ReadonlyMap<string, MaterializedParticipantRow>
): Promise<void> {
  const existing = await transaction
    .select({
      actorId: reviewParticipants.actorId,
      role: reviewParticipants.role,
    })
    .from(reviewParticipants)
    .where(eq(reviewParticipants.reviewId, reviewId));
  const existingKeys = existing.map(
    (participant) => `${participant.role}:${participant.actorId}`
  );
  const uniqueExistingKeys = new Set(existingKeys);
  if (
    uniqueExistingKeys.size !== existingKeys.length ||
    existingKeys.some((key) => !expected.has(key))
  ) {
    throw new Error(
      "The local Review participant graph conflicts with the server workspace."
    );
  }

  for (const [key, participant] of expected) {
    if (uniqueExistingKeys.has(key)) continue;
    await transaction
      .insert(reviewParticipants)
      .values(participant)
      .onConflictDoNothing();
  }

  const finalParticipants = await transaction
    .select({
      actorId: reviewParticipants.actorId,
      role: reviewParticipants.role,
    })
    .from(reviewParticipants)
    .where(eq(reviewParticipants.reviewId, reviewId));
  const finalKeys = new Set(
    finalParticipants.map(
      (participant) => `${participant.role}:${participant.actorId}`
    )
  );
  if (
    finalKeys.size !== expected.size ||
    [...expected.keys()].some((key) => !finalKeys.has(key))
  ) {
    throw new Error("The local Review participant graph is incomplete.");
  }
}
