/**
 * Shared handoff selection state (maturity-score/REQ-018, AC-067;
 * improvement-plans/REQ-005, AC-039, AC-041, AC-042).
 *
 * Places selection on the Follow-ups queue while the composer handles order,
 * notes, Copy Markdown, completion, and association. All writes go through the
 * domain write path. Limit rejections surface as field-addressable errors.
 */
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import {
  resolveCurrentAssociation,
  type AssociationTransition,
  type ExternalWorkItemReference,
} from "~/services/handoff/association";
import {
  deriveHandoffDraft,
  type HandoffPracticeRecord,
} from "~/services/handoff/draft";
import {
  HANDOFF_LIMITS,
  HandoffLimitError,
  type HandoffLimitViolation,
} from "~/services/handoff/limits";
import { practiceEntityId } from "~/services/handoff/practice";
import {
  projectSelectablePractices,
  type SelectablePractice,
} from "~/services/handoff/projection";
import {
  deselectHandoffPractice,
  selectHandoffPractice,
} from "~/services/handoff/handoffWrite";
import type { ReviewContext } from "~/services/review/ImprovementPlanProjection";
import type { Ref } from "vue";

export function useHandoffSelection(input: {
  readonly reviewContext: Ref<ReviewContext | null>;
  readonly rows: Ref<readonly HandoffPracticeRecord[]>;
  readonly history: Ref<readonly AssociationTransition[]>;
  readonly reviewName: Ref<string>;
  readonly ownedPracticeIds: Ref<ReadonlySet<string>>;
}) {
  const { actor } = useCurrentActor();

  const selectViolations = ref<readonly HandoffLimitViolation[]>([]);
  /** Non-limit failures from the write path, surfaced instead of rethrown. */
  const selectError = ref("");
  const selectErrorEntityId = ref<string | null>(null);

  /** Current external reference per practice entity, resolved from history. */
  const currentAssociations = computed(() => {
    const map = new Map<string, ExternalWorkItemReference>();
    const entityIds = [
      ...new Set(
        input.history.value.map((row) => practiceEntityId(row.practice))
      ),
    ];
    for (const entityId of entityIds) {
      const current = resolveCurrentAssociation(input.history.value, entityId);
      if (current?.reference) map.set(entityId, current.reference);
    }
    return map;
  });

  const practices = computed(() => {
    if (!input.reviewContext.value) return [];
    const activePracticeIds = new Set(input.rows.value.map((row) => row.id));
    return projectSelectablePractices(
      input.reviewContext.value,
      currentAssociations.value
    ).filter(
      (practice) =>
        !input.ownedPracticeIds.value.has(practice.entityId) ||
        activePracticeIds.has(practice.entityId)
    );
  });

  const selectableByEntityId = computed(
    () =>
      new Map(practices.value.map((practice) => [practice.entityId, practice]))
  );

  const draft = computed(() =>
    deriveHandoffDraft([...input.rows.value], {
      reviewId: input.reviewContext.value?.reviewId ?? "",
      reviewName: input.reviewName.value,
    })
  );

  const selectedIds = computed(
    () =>
      new Set(
        draft.value.kind === "ready"
          ? draft.value.practices.map((practice) => practice.record.id)
          : []
      )
  );
  const selectedCount = computed(() => selectedIds.value.size);
  const limitReached = computed(
    () => selectedCount.value >= HANDOFF_LIMITS.practicesPerHandoff
  );

  /**
   * Selects or deselects one practice through the write path. Returns true
   * when the write succeeded and the caller should refresh the local rows.
   */
  const toggle = async (
    practice: SelectablePractice,
    selected: boolean
  ): Promise<boolean> => {
    selectViolations.value = [];
    selectError.value = "";
    selectErrorEntityId.value = null;
    try {
      if (selected) {
        await selectHandoffPractice({
          existing: [...input.rows.value],
          practice,
          actorId: actor.value.id,
          occurredAt: new Date().toISOString(),
        });
      } else {
        await deselectHandoffPractice({
          rows: [...input.rows.value],
          entityId: practice.entityId,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      selectErrorEntityId.value = practice.entityId;
      if (error instanceof HandoffLimitError) {
        selectViolations.value = error.violations;
        return false;
      }
      selectError.value =
        "The selection could not be saved. Reload Follow-ups and try again.";
      return false;
    }
    return true;
  };

  return {
    practices,
    selectableByEntityId,
    draft,
    selectedIds,
    selectedCount,
    limitReached,
    selectError,
    selectErrorEntityId,
    selectViolations,
    toggle,
  };
}
