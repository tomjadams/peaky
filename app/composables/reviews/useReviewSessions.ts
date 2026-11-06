import type { AssessmentSession } from "~/models";
import {
  withDatabase,
  eq,
  and,
  asc,
  safeParse,
  events,
  waitForLocalDbReady,
} from "~/local-db";

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function toString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function fetchLocalCheckpointSessions(
  reviewId: string
): Promise<AssessmentSession[]> {
  return withDatabase(async (db) => {
    const localCheckpointRows = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.reviewId, reviewId),
          eq(events.eventType, "ReviewCheckpointSaved.v1")
        )
      )
      .orderBy(asc(events.time));

    return localCheckpointRows.map((row) => {
      const payload = safeParse<Record<string, unknown>>(row.data, {});
      const note = toString(payload.note) || undefined;
      const questionsAnswered = toNumber(payload.questionsAnswered);
      const questionsChanged = toNumber(payload.questionsChanged);
      const progressDelta = toNumber(payload.progressDelta);
      const overallProgress =
        toNumber(payload.overallProgress) || progressDelta;
      const pillarSnapshots = Array.isArray(payload.pillarSnapshots)
        ? payload.pillarSnapshots
        : [];

      return {
        id: row.id,
        reviewId: row.reviewId ?? "",
        templateId: toString(payload.templateId),
        createdAt: row.time,
        createdBy: {
          id: row.actorId,
          name: row.actorId,
        },
        snapshot: {
          overallProgress,
          pillars: pillarSnapshots.map((snapshot) => {
            const item =
              typeof snapshot === "object" && snapshot !== null
                ? (snapshot as Record<string, unknown>)
                : {};

            return {
              slug: toString(item.slug),
              name: toString(item.name),
              progress: toNumber(item.progress),
              totalQuestions: toNumber(item.totalQuestions),
              answeredQuestions: toNumber(item.answeredQuestions),
            };
          }),
        },
        delta: {
          questionsAnswered,
          questionsChanged,
          progressDelta,
        },
        note,
      };
    });
  });
}

export function useReviewSessions(reviewId: MaybeRef<string>) {
  const sessions = ref<AssessmentSession[]>([]);
  const loading = ref(true);
  const error = ref<Error | null>(null);

  const fetchSessions = async () => {
    loading.value = true;
    error.value = null;

    const id = toValue(reviewId);

    if (!id) {
      sessions.value = [];
      loading.value = false;
      return;
    }

    if (import.meta.server) {
      loading.value = true;
      return;
    }

    try {
      await waitForLocalDbReady();

      const localSessions = await fetchLocalCheckpointSessions(id);
      sessions.value = localSessions;

      if (localSessions.length > 0) {
        loading.value = false;
        return;
      }

      const remoteSessions = await $fetch<AssessmentSession[]>(
        `/api/reviews/${id}/sessions`
      );
      sessions.value = [...remoteSessions].toSorted(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } catch (e) {
      const localSessions = await fetchLocalCheckpointSessions(id).catch(
        () => []
      );
      sessions.value = localSessions;

      if (localSessions.length === 0) {
        error.value =
          e instanceof Error ? e : new Error("Failed to fetch sessions");
      }
    } finally {
      loading.value = false;
    }
  };

  watch(() => toValue(reviewId), fetchSessions, { immediate: true });

  return { sessions, loading, error, refresh: fetchSessions };
}
