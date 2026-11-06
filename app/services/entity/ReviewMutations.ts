/**
 * Mutation service for the Review entity.
 *
 * Encapsulates all write operations for reviews: create, checkpoint, update,
 * archive, restore, and delete. Integrates with the local-first outbox and
 * domain event log for background sync.
 *
 * Mutation taxonomy and domain events produced:
 *
 *   create()          → review.created event
 *   saveMilestone()   → review.checkpoint.saved event
 *   update()          → no event (mutable fields only — name/status edits
 *                        are intentionally not audited at the field level)
 *   archive()         → review.archived event
 *   restore()         → review.restored event
 *   delete()          → review.deleted event
 *
 * All methods are free of Vue reactivity — safe to call from composables,
 * route handlers, or other services.
 */

import { withDatabase, nowISO, createUuidV7, eq, inArray } from "~/local-db";
import {
  reviews,
  reviewTemplateSelections,
  subjects,
  templates,
  templateRevisions,
  type ReviewStatus,
} from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import { createEvent } from "~/services/events/createEvent";
import { getHLCClock } from "~/services/sync/syncClock";
import type {
  ReviewCreated,
  ReviewArchived,
  ReviewRestored,
  ReviewDeleted,
  ReviewCheckpointSaved,
} from "~/services/events/DomainEvent";
import type { SessionDelta, SessionSnapshot } from "~/models";
import type { LocalReview } from "~/composables/local/useLocalReview";

async function fetchReviewName(reviewId: string): Promise<string> {
  const result = await withDatabase(async (db) => {
    return db
      .select({ name: reviews.name })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);
  });
  const row = result[0] ?? null;
  if (!row) throw new Error(`Review not found: ${reviewId}`);
  return row.name;
}

export class ReviewMutations {
  /**
   * Create a new review with template selections.
   *
   * Performs a multi-table insert inside a single `localMutation.commit()` call:
   * 1. `reviews` — the review header row
   * 2. `review_template_selections` — one row per exact Template Revision ID
   * 3. `events` — a `review.created` audit record
   * 4. `local_outbox` — queued for background sync
   *
   * The `stateWrite` callback handles both `reviews` and
   * `review_template_selections` inserts within one transaction.
   *
   * @returns The generated review ID.
   * @throws If `subjectId`, `name`, or at least one `templateId` is missing.
   */
  async create(input: {
    subjectId: string;
    subjectType: "product" | "team";
    name: string;
    templateRevisionIds: string[];
    scope: "team" | "application" | "product";
    applicationIds?: string[];
    teamIds?: string[];
  }): Promise<string> {
    if (!input.subjectId) throw new Error("subjectId is required");
    if (!input.name) throw new Error("name is required");
    if (input.templateRevisionIds.length === 0)
      throw new Error("At least one Template Revision is required");
    if (input.templateRevisionIds.length > 3)
      throw new Error("At most three Template Revisions are allowed");
    if (
      new Set(input.templateRevisionIds).size !==
      input.templateRevisionIds.length
    )
      throw new Error("Template Revision selections must be distinct");

    const id = createUuidV7();
    const subjectType = input.subjectType;
    const selectedTemplateIds: string[] = [];

    const event = createEvent<ReviewCreated>(
      "ReviewCreated.v1",
      id,
      {
        name: input.name,
        subjectId: input.subjectId,
        subjectType,
        templateIds: selectedTemplateIds,
        scope: input.scope,
        applicationIds: input.applicationIds ?? [],
        teamIds: input.teamIds ?? [],
      },
      { reviewId: id }
    );

    const clock = getHLCClock();
    // One HLC for the whole creation — all fields are set atomically.
    const hlc = clock.now();

    try {
      await localMutation.commit({
        stateWrite: async (tx) => {
          const now = nowISO();
          const subjectRows = await tx
            .select({ id: subjects.id, type: subjects.type })
            .from(subjects)
            .where(eq(subjects.id, input.subjectId))
            .limit(1);
          if (subjectRows[0]?.type !== input.subjectType)
            throw new Error("Review subject is missing or has the wrong type");

          const revisionRows = await tx
            .select({
              id: templateRevisions.id,
              templateId: templateRevisions.templateId,
              status: templateRevisions.status,
            })
            .from(templateRevisions)
            .where(inArray(templateRevisions.id, input.templateRevisionIds));
          const revisionById = new Map(
            revisionRows.map((revision) => [revision.id, revision] as const)
          );
          const selectedRevisions = input.templateRevisionIds.map(
            (revisionId) => revisionById.get(revisionId)
          );
          if (selectedRevisions.some((revision) => !revision))
            throw new Error("A selected Template Revision does not exist");
          if (
            selectedRevisions.some(
              (revision) => revision?.status !== "published"
            )
          )
            throw new Error(
              "Only current published Template Revisions can be selected"
            );

          const parentTemplateIds = selectedRevisions.map(
            (revision) => revision!.templateId
          );
          if (new Set(parentTemplateIds).size !== parentTemplateIds.length)
            throw new Error(
              "Selected Revisions must belong to distinct Templates"
            );

          const templateRows = await tx
            .select({ id: templates.id, status: templates.status })
            .from(templates)
            .where(inArray(templates.id, parentTemplateIds));
          const templateById = new Map(
            templateRows.map((template) => [template.id, template] as const)
          );
          if (
            parentTemplateIds.some(
              (templateId) => templateById.get(templateId)?.status !== "active"
            )
          )
            throw new Error(
              "Selected Revisions require active parent Templates"
            );
          selectedTemplateIds.push(...parentTemplateIds);

          await tx.insert(reviews).values({
            id,
            subjectId: input.subjectId,
            name: input.name,
            status: "draft",
            createdAt: now,
            updatedAt: now,
          });

          await tx.insert(reviewTemplateSelections).values(
            input.templateRevisionIds.map((templateRevisionId, index) => ({
              reviewId: id,
              templateRevisionId,
              position: index,
              createdAt: now,
            }))
          );
        },
        event,
        outbox: {
          entityType: "review",
          entityId: id,
          operation: "upsert",
          fields: [
            { name: "subjectId", value: input.subjectId, hlc },
            { name: "name", value: input.name, hlc },
            { name: "status", value: "draft", hlc },
          ],
        },
      });

      return id;
    } catch (err) {
      console.error("[ReviewMutations.create] Failed:", { input, error: err });
      throw err;
    }
  }

  /**
   * Save a milestone event for a review session.
   *
   * The event IS the state — a no-op stateWrite is used. The milestone payload
   * is written to events and queued in local_outbox.
   */
  async saveMilestone(input: {
    reviewId: string;
    templateId: string;
    comment: string;
    snapshot: SessionSnapshot;
    delta: SessionDelta;
  }): Promise<string> {
    if (!input.reviewId) throw new Error("reviewId is required");

    const checkpointPayload = {
      reviewId: input.reviewId,
      templateId: input.templateId,
      note: input.comment.trim() || undefined,
      questionsAnswered: input.delta.questionsAnswered,
      questionsChanged: input.delta.questionsChanged,
      progressDelta: input.delta.progressDelta,
      overallProgress: input.snapshot.overallProgress,
      pillarSnapshots: input.snapshot.pillars.map((pillar) => ({
        slug: pillar.slug,
        name: pillar.name,
        progress: pillar.progress,
        totalQuestions: pillar.totalQuestions,
        answeredQuestions: pillar.answeredQuestions,
      })),
    };

    const event = createEvent<ReviewCheckpointSaved>(
      "ReviewCheckpointSaved.v1",
      createUuidV7(),
      checkpointPayload,
      { reviewId: input.reviewId }
    );

    const { eventId } = await localMutation.commit({
      stateWrite: async () => {},
      event,
      outbox: {
        entityType: "review_checkpoint",
        entityId: input.reviewId,
        operation: "upsert",
        fields: [],
      },
    });

    return eventId;
  }

  /**
   * Update mutable fields on a review (name, status).
   *
   * Uses `localMutation.draft()` — state write + outbox, no audit event.
   * Name/status edits are synced at the field level but intentionally not
   * audited as domain events.
   */
  async update(
    reviewId: string,
    data: Partial<Pick<LocalReview, "name" | "status">>
  ): Promise<void> {
    if (!reviewId) throw new Error("reviewId is required");

    const fields: { name: string; value: unknown; hlc: string }[] = [];
    const clock = getHLCClock();

    if (data.name !== undefined)
      fields.push({ name: "name", value: data.name, hlc: clock.now() });
    if (data.status !== undefined)
      fields.push({ name: "status", value: data.status, hlc: clock.now() });

    if (fields.length > 0) {
      await localMutation.draft({
        stateWrite: async (tx, { now }) => {
          const updates: Partial<typeof reviews.$inferInsert> = {};
          if (data.name !== undefined) updates.name = data.name;
          if (data.status !== undefined) updates.status = data.status;
          updates.updatedAt = now;
          await tx.update(reviews).set(updates).where(eq(reviews.id, reviewId));
        },
        outbox: {
          entityType: "review",
          entityId: reviewId,
          operation: "upsert",
          fields,
        },
      });
    }
  }

  /**
   * Archive a review.
   *
   * Sets status to "archived" and emits a ReviewArchived domain event.
   */
  async archive(reviewId: string): Promise<void> {
    if (!reviewId) throw new Error("reviewId is required");

    const name = await fetchReviewName(reviewId);
    const event = createEvent<ReviewArchived>(
      "ReviewArchived.v1",
      reviewId,
      { name },
      { reviewId }
    );

    const clock = getHLCClock();

    await localMutation.commit({
      stateWrite: async (tx) => {
        await tx
          .update(reviews)
          .set({ status: "archived", updatedAt: event.time })
          .where(eq(reviews.id, reviewId));
      },
      event,
      outbox: {
        entityType: "review",
        entityId: reviewId,
        operation: "upsert",
        fields: [{ name: "status", value: "archived", hlc: clock.now() }],
      },
    });
  }

  /**
   * Restore an archived review to its previous (or specified) status.
   *
   * Emits a ReviewRestored domain event.
   */
  async restore(
    reviewId: string,
    status: ReviewStatus = "draft"
  ): Promise<void> {
    if (!reviewId) throw new Error("reviewId is required");

    const nextStatus = status === "archived" ? "draft" : status;
    const name = await fetchReviewName(reviewId);
    const event = createEvent<ReviewRestored>(
      "ReviewRestored.v1",
      reviewId,
      { name },
      { reviewId }
    );

    const clock = getHLCClock();

    await localMutation.commit({
      stateWrite: async (tx) => {
        await tx
          .update(reviews)
          .set({ status: nextStatus, updatedAt: event.time })
          .where(eq(reviews.id, reviewId));
      },
      event,
      outbox: {
        entityType: "review",
        entityId: reviewId,
        operation: "upsert",
        fields: [{ name: "status", value: nextStatus, hlc: clock.now() }],
      },
    });
  }

  /**
   * Permanently delete a review from the local database.
   *
   * Emits a ReviewDeleted domain event.
   */
  async delete(reviewId: string): Promise<void> {
    if (!reviewId) throw new Error("reviewId is required");

    const name = await fetchReviewName(reviewId);
    const event = createEvent<ReviewDeleted>(
      "ReviewDeleted.v1",
      reviewId,
      { name },
      { reviewId }
    );

    await localMutation.commit({
      stateWrite: async (tx) => {
        await tx.delete(reviews).where(eq(reviews.id, reviewId));
      },
      event,
      outbox: {
        entityType: "review",
        entityId: reviewId,
        operation: "delete",
        fields: [],
      },
    });
  }
}

export const reviewMutations = new ReviewMutations();
