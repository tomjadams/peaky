<script setup lang="ts">
/**
 * Explicit non-result maturity states (maturity-score/REQ-014; AC-022,
 * AC-042, AC-060).
 *
 * One card per pinned Revision without a calculable result: no-definition,
 * over-limit configuration-error, and no-applicable-result. Each state names
 * the action that resolves it. None renders a zero-percent result or an
 * empty stage path. A no-result Revision keeps effectiveResult null even
 * when override history exists — history is surfaced as history, never as a
 * fabricated stage.
 */
import type { RouteLocationRaw } from "vue-router";
import type {
  ReviewWorkspace,
  WorkspaceMaturityEntry,
} from "~/models/workspace";

interface Props {
  workspace: ReviewWorkspace;
  entry: Exclude<WorkspaceMaturityEntry, { kind: "result" }>;
  assessmentRouteName: string;
  assessmentParams: Record<string, string>;
  showAssessmentAction?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showAssessmentAction: true,
});

const revision = computed(() =>
  props.workspace.templateRevisions.find(
    (candidate) => candidate.id === props.entry.templateRevisionId
  )
);

const revisionLabel = computed(() =>
  revision.value
    ? `${revision.value.name} · revision ${revision.value.revisionNumber ?? "?"}`
    : "Pinned revision"
);

const templateStudioLink = computed(() =>
  revision.value ? `/templates/${revision.value.templateId}/edit` : null
);

const assessmentLink = computed(
  (): RouteLocationRaw => ({
    name: props.assessmentRouteName,
    params: props.assessmentParams,
    query: { templateRevisionId: props.entry.templateRevisionId },
  })
);
</script>

<template>
  <article
    class="maturity-entry-state min-w-0"
    :aria-label="`Maturity state for ${revisionLabel}; revision identity ${entry.templateRevisionId}`"
  >
    <!-- AC-060: explicit no-definition state. -->
    <template v-if="entry.kind === 'no-definition'">
      <h3 class="text-highlighted text-lg font-semibold">
        No maturity definition
      </h3>
      <p class="text-muted mt-1 text-sm">
        {{ revisionLabel }} carries no maturity definition, so no maturity
        result can be calculated for it.
      </p>
      <p class="text-muted mt-2 text-sm">
        To resolve this, configure maturity for the template in Template Studio
        and publish a new revision, then pin the review to it.
      </p>
      <UButton
        v-if="templateStudioLink"
        :to="templateStudioLink"
        variant="outline"
        color="neutral"
        size="sm"
        class="mt-3"
        icon="i-lucide-square-pen"
      >
        Open Template Studio
      </UButton>
    </template>

    <!-- Invalid pinned Revision configuration scoped to this Revision. -->
    <template v-else-if="entry.kind === 'configuration-error'">
      <h3 class="text-highlighted text-lg font-semibold">
        Maturity configuration error
      </h3>
      <template v-if="entry.code === 'question-limit-exceeded'">
        <p class="text-muted mt-1 text-sm">
          {{ revisionLabel }} contains {{ entry.questionCount }} questions, but
          maturity supports a maximum of {{ entry.limit }}. No maturity result
          is calculated for this revision; other pinned revisions are
          unaffected.
        </p>
        <p class="text-muted mt-2 text-sm">
          To resolve this, pin a template revision with at most
          {{ entry.limit }} questions.
        </p>
      </template>
      <template v-else>
        <p class="text-muted mt-1 text-sm">
          {{ revisionLabel }} gives practice {{ entry.practiceId }} on question
          {{ entry.questionId }} a custom share of {{ entry.share }}%. Every
          custom share must be greater than zero, so no maturity result is
          calculated for this revision.
        </p>
        <p class="text-muted mt-2 text-sm">
          Use equal weighting or publish positive custom shares, then pin the
          new revision.
        </p>
      </template>
    </template>

    <!-- AC-022: no applicable answered question — explicit, never 0%. -->
    <template v-else-if="entry.kind === 'no-result'">
      <h3 class="text-highlighted text-lg font-semibold">
        No applicable maturity result
      </h3>
      <p class="text-muted mt-1 text-sm">
        {{ revisionLabel }} has no applicable answered questions, so there is no
        maturity result. This is not a zero-percent score.
      </p>
      <p class="text-muted mt-1 text-sm">
        {{ entry.coverage.answered }} of {{ entry.coverage.total }} questions
        answered.
      </p>
      <UButton
        v-if="showAssessmentAction"
        :to="assessmentLink"
        variant="outline"
        color="neutral"
        size="sm"
        class="mt-3"
        icon="i-lucide-clipboard-check"
      >
        Answer the assessment
      </UButton>

      <section
        v-if="entry.overrideHistory.length > 0"
        class="mt-4"
        aria-label="Override history"
      >
        <h4 class="text-muted text-sm font-semibold">Override history</h4>
        <p class="text-muted mt-1 text-[13px]">
          Recorded Advisor overrides apply only once a calculated result exists.
        </p>
        <ul class="mt-2">
          <li
            v-for="transition in entry.overrideHistory"
            :key="transition.id"
            class="border-t border-[#EEF3F8] py-3 text-sm dark:border-white/10"
          >
            <p class="text-default">
              <span class="font-medium">{{ transition.action }}</span> by
              {{ transition.actorId }} · {{ transition.occurredAt }}
            </p>
            <p v-if="transition.explanation" class="text-muted mt-1">
              {{ transition.explanation }}
            </p>
          </li>
        </ul>
      </section>
    </template>
  </article>
</template>
