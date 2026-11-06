/**
 * Get session history derived from review events.
 *
 * Sessions are now derived from append-only events, not mutable snapshots.
 * This provides backward-compatible session views with full auditability.
 *
 * @see site/docs/development/walkthroughs/local-first-auditing.md
 */
import { getEventsByReviewId } from "../../../../data/review-events";
import type { AssessmentSession } from "~/models/session";

export default defineEventHandler((event) => {
  const reviewId = getRouterParam(event, "id");
  if (!reviewId) {
    throw createError({ statusCode: 400, message: "Review ID is required" });
  }

  // Get events for the review
  const events = getEventsByReviewId(reviewId);

  // Derive session-like groups from checkpoint events
  const checkpointEvents = events.filter(
    (e) => e.eventType === "ReviewCheckpointSaved.v1"
  );

  // Build sessions from checkpoint events
  const sessions: AssessmentSession[] = checkpointEvents.map((e) => {
    const data = e.data as {
      note?: string;
      questionsAnswered?: number;
      questionsChanged?: number;
      progressDelta?: number;
      overallProgress?: number;
      pillarSnapshots?: Array<{
        slug?: string;
        name?: string;
        progress?: number;
        totalQuestions?: number;
        answeredQuestions?: number;
      }>;
      templateId?: string;
    };

    const progressDelta = data.progressDelta ?? 0;
    const questionsAnswered = data.questionsAnswered ?? 0;
    const overallProgress = data.overallProgress ?? progressDelta;
    const pillarSnapshots = data.pillarSnapshots ?? [];

    return {
      id: e.id,
      reviewId,
      templateId: data.templateId ?? "",
      createdAt: e.time,
      createdBy: {
        id: e.actorId,
        name: e.actorName ?? e.actorId,
      },
      snapshot: {
        overallProgress,
        pillars: pillarSnapshots.map((pillar) => ({
          slug: pillar.slug ?? "",
          name: pillar.name ?? "",
          progress: pillar.progress ?? 0,
          totalQuestions: pillar.totalQuestions ?? 0,
          answeredQuestions: pillar.answeredQuestions ?? 0,
        })),
      },
      delta: {
        questionsAnswered,
        questionsChanged: data.questionsChanged ?? 0,
        progressDelta,
      },
      note: data.note,
    };
  });

  return sessions;
});
