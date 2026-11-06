<script setup lang="ts">
import { computed, ref } from "vue";
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
  describeHandoffViolation,
  HANDOFF_LIMITS,
  HandoffLimitError,
  type HandoffLimitViolation,
} from "~/services/handoff/limits";
import {
  practiceEntityId,
  type PracticeReference,
} from "~/services/handoff/practice";
import {
  projectSelectablePractices,
  type SelectablePractice,
} from "~/services/handoff/projection";
import {
  deselectHandoffPractice,
  selectHandoffPractice,
} from "~/services/handoff/handoffWrite";
import type { ReviewContext } from "~/services/review/ImprovementPlanProjection";
import HandoffComposer from "~/components/handoff/HandoffComposer.vue";
import HandoffPracticeRow from "~/components/handoff/HandoffPracticeRow.vue";
import type { HandoffMaturityPreview } from "~/services/maturity/handoffPreview";
import { formatCompactDuration, formatFullDate } from "~/utils/date";
import {
  completeLocalHandoffManually,
  evaluateLocalHandoffAutomatically,
  reopenLatestLocalHandoff,
  type LocalHandoffAnalytics,
  type LocalReviewHandoffRecord,
} from "~/services/handoff/localLifecycle";

interface Props {
  reviewContext: ReviewContext;
  reviewName: string;
  rows: readonly HandoffPracticeRecord[];
  history: readonly AssociationTransition[];
  activeHandoff?: LocalReviewHandoffRecord | null;
  handoffAnalytics?: readonly LocalHandoffAnalytics[];
  ownedPracticeIds?: ReadonlySet<string>;
  maturityPreviews?: readonly HandoffMaturityPreview[];
  practicePathFor: (reference: PracticeReference) => string;
  reviewPath?: string;
  loading?: boolean;
  showSelectionList?: boolean;
  showComposer?: boolean;
  selectionRevisionId?: string;
  writeAvailable?: boolean;
  writeUnavailableReason?: string;
}

const props = withDefaults(defineProps<Props>(), {
  showSelectionList: true,
  showComposer: true,
  activeHandoff: null,
  handoffAnalytics: () => [],
  ownedPracticeIds: () => new Set<string>(),
  maturityPreviews: () => [],
  selectionRevisionId: undefined,
  reviewPath: undefined,
  loading: undefined,
  writeAvailable: true,
  writeUnavailableReason:
    "Reload Follow-ups to prepare this review for offline changes.",
});
const emit = defineEmits<{ changed: []; retry: [] }>();

const { actor } = useCurrentActor();
const selectViolations = ref<readonly HandoffLimitViolation[]>([]);
const selectError = ref("");

const currentAssociations = computed(() => {
  const map = new Map<string, ExternalWorkItemReference>();
  const entityIds = [
    ...new Set(props.history.map((row) => practiceEntityId(row.practice))),
  ];
  for (const entityId of entityIds) {
    const current = resolveCurrentAssociation(props.history, entityId);
    if (current?.reference) map.set(entityId, current.reference);
  }
  return map;
});
const practices = computed(() => {
  const projected = projectSelectablePractices(
    props.reviewContext,
    currentAssociations.value
  );
  const activeIds = new Set(props.rows.map((row) => row.id));
  const eligible = projected.filter(
    (practice) =>
      !props.ownedPracticeIds.has(practice.entityId) ||
      activeIds.has(practice.entityId)
  );
  return props.selectionRevisionId
    ? eligible.filter(
        (practice) =>
          practice.reference.templateRevisionId === props.selectionRevisionId
      )
    : eligible;
});
const draft = computed(() =>
  deriveHandoffDraft([...props.rows], {
    reviewId: props.reviewContext.reviewId,
    reviewName: props.reviewName,
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
const limitReached = computed(
  () => selectedIds.value.size >= HANDOFF_LIMITS.practicesPerHandoff
);
const completeModalOpen = ref(false);
const completionUnresolvedCount = ref(0);
const completionError = ref("");
const completionMessage = ref("");
const completedHandoffHistory = computed(() =>
  props.handoffAnalytics
    .filter((handoff) => handoff.completedAt !== null)
    .toSorted((left, right) => right.sequence - left.sequence)
);
const formatCompletedAt = (value: string | null): string =>
  value ? formatFullDate(value) : "Not completed";
const formatDuration = (durationMs: number | null): string =>
  durationMs === null ? "In progress" : formatCompactDuration(durationMs);
const handleCompletionRequest = async () => {
  if (!props.activeHandoff) return;
  completionError.value = "";
  try {
    const evaluation = await evaluateLocalHandoffAutomatically(
      props.reviewContext.reviewId
    );
    completionUnresolvedCount.value = evaluation.resolution.unresolvedCount;
    completeModalOpen.value = true;
  } catch {
    completionError.value = "The handoff status could not be prepared.";
  }
};
const handleCompletionConfirm = async (note: string | null) => {
  try {
    const completed = await completeLocalHandoffManually({
      reviewId: props.reviewContext.reviewId,
      completedBy: actor.value.id,
      note,
    });
    if (!completed) return;
    completeModalOpen.value = false;
    completionMessage.value = "Handoff closed on this device.";
    emit("changed");
  } catch {
    completionError.value = "The handoff could not be closed.";
  }
};
const handleReopenLatest = async () => {
  completionError.value = "";
  try {
    const reopened = await reopenLatestLocalHandoff(
      props.reviewContext.reviewId
    );
    if (!reopened) return;
    completionMessage.value = "Handoff reopened on this device.";
    emit("changed");
  } catch {
    completionError.value = "The latest handoff could not be reopened.";
  }
};
const handleToggle = async (
  practice: SelectablePractice,
  selected: boolean
) => {
  if (!props.writeAvailable) return;
  selectViolations.value = [];
  selectError.value = "";
  try {
    if (selected) {
      await selectHandoffPractice({
        existing: [...props.rows],
        practice,
        actorId: actor.value.id,
        occurredAt: new Date().toISOString(),
      });
    } else {
      await deselectHandoffPractice({
        rows: [...props.rows],
        entityId: practice.entityId,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    if (error instanceof HandoffLimitError) {
      selectViolations.value = error.violations;
      return;
    }
    selectError.value = "The selection could not be saved. Please try again.";
    return;
  }
  emit("changed");
};
</script>

<template>
  <div class="min-w-0">
    <section
      v-if="showSelectionList"
      class="mb-10 min-w-0"
      aria-labelledby="fallback-follow-ups-heading"
    >
      <h3
        id="fallback-follow-ups-heading"
        class="text-highlighted text-[26px] font-extrabold"
      >
        Needs attention
      </h3>
      <p class="text-muted mt-1 text-sm">
        This template has no maturity result, so areas needing attention are
        ordered by severity without stage context.
      </p>
      <UAlert
        v-if="!writeAvailable"
        role="alert"
        color="warning"
        variant="subtle"
        class="mt-4"
        title="Handoff changes are not ready on this device"
        :description="writeUnavailableReason"
      >
        <template #actions>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            @click="emit('retry')"
          >
            Retry local setup
          </UButton>
        </template>
      </UAlert>
      <UAlert
        v-if="selectError"
        role="alert"
        color="error"
        variant="subtle"
        class="mt-4"
        :title="selectError"
      />
      <UAlert
        v-if="selectViolations.length > 0"
        role="alert"
        color="error"
        variant="subtle"
        class="mt-4"
        title="Selection could not be saved"
      >
        <template #description>
          <ul>
            <li v-for="violation in selectViolations" :key="violation.field">
              {{ violation.field }}: {{ describeHandoffViolation(violation) }}
            </li>
          </ul>
        </template>
      </UAlert>
      <p v-if="loading" class="text-muted mt-5 text-sm">
        Loading areas needing attention…
      </p>
      <p v-else-if="practices.length === 0" class="text-muted mt-5 text-sm">
        No areas needing attention are available for handoff.
      </p>
      <ul v-else class="border-default mt-5 border-t">
        <li v-for="practice in practices" :key="practice.entityId">
          <HandoffPracticeRow
            :practice="practice"
            :selected="selectedIds.has(practice.entityId)"
            :selection-limit-reached="
              !writeAvailable ||
              (limitReached && !selectedIds.has(practice.entityId))
            "
            @toggle="(selected: boolean) => handleToggle(practice, selected)"
          />
        </li>
      </ul>
    </section>

    <p role="status" aria-live="polite" class="sr-only">
      {{ completionMessage }}
    </p>
    <UAlert
      v-if="showComposer && completionError"
      role="alert"
      color="error"
      variant="subtle"
      class="mb-3"
      :title="completionError"
    />

    <HandoffComposer
      v-if="showComposer"
      :draft="draft"
      :rows="rows"
      :history="history"
      :maturity-previews="maturityPreviews"
      :active="activeHandoff !== null"
      :practice-path-for="practicePathFor"
      :review-path="reviewPath"
      @complete="handleCompletionRequest"
      @changed="emit('changed')"
    />

    <details
      v-if="showComposer && completedHandoffHistory.length > 0"
      class="group border-default mt-4 border-t"
    >
      <summary
        class="focus-visible:ring-primary flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-[7px] text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        <span class="text-default">
          Handoff history · {{ completedHandoffHistory.length }}
        </span>
        <Icon
          name="lucide:chevron-down"
          class="text-muted size-4 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ol class="border-default border-t">
        <li
          v-for="(handoff, index) in completedHandoffHistory"
          :key="handoff.id"
          class="border-default border-b py-4 last:border-b-0"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-default text-sm font-semibold">
                Handoff {{ handoff.sequence }}
              </p>
              <p class="text-muted mt-0.5 text-[13px]">
                {{
                  handoff.completionMode === "auto"
                    ? "Closed automatically"
                    : "Closed manually"
                }}
                · {{ formatCompletedAt(handoff.completedAt) }}
              </p>
            </div>
            <span class="text-muted shrink-0 text-[13px] tabular-nums">
              {{ formatDuration(handoff.durationMs) }}
            </span>
          </div>
          <p class="text-muted mt-2 text-[13px]">
            {{ handoff.selectedPracticeIds.length }} practice{{
              handoff.selectedPracticeIds.length === 1 ? "" : "s"
            }}
            · {{ handoff.unresolvedCount ?? 0 }} unresolved when closed
          </p>
          <p v-if="handoff.note" class="text-default mt-2 text-sm">
            {{ handoff.note }}
          </p>
          <UButton
            v-if="
              index === 0 &&
              !activeHandoff &&
              handoff.completionMode === 'manual'
            "
            color="neutral"
            variant="link"
            size="xs"
            class="mt-2 p-0"
            @click="handleReopenLatest"
          >
            Reopen handoff
          </UButton>
        </li>
      </ol>
    </details>

    <HandoffCompleteModal
      v-if="showComposer"
      v-model:open="completeModalOpen"
      :unresolved-count="completionUnresolvedCount"
      @confirm="handleCompletionConfirm"
    />
  </div>
</template>
