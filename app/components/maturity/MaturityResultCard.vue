<script setup lang="ts">
/**
 * Rich per-Revision maturity result card (maturity-score/REQ-013 through
 * REQ-016; AC-023 through AC-031, AC-035, AC-056).
 *
 * One card per pinned Revision — never a combined score (AC-025, AC-039).
 * The effective stage, whole percentage, and coverage lead; the full
 * five-stage path, pillar breakdown, override cue, and the trace-backed
 * explanation follow. Stage resolution comes from the workspace entry; the
 * card never recalculates. Below full answer coverage the stage is qualified
 * as provisional wherever it appears (AC-056).
 */
import type { RouteLocationRaw } from "vue-router";
import type {
  ReviewWorkspace,
  WorkspaceMaturityEntry,
} from "~/models/workspace";
import { decodeMaturityDefinition } from "~/services/maturity/persistence";
import { deserializeRatio, toWholePercent } from "~/services/maturity/ratio";
import { MATURITY_STAGES } from "~/services/maturity/stages";
import { indexStagePathQuestions } from "~/services/maturity/stagePath";
import MaturityExplanationSlideover from "~/components/maturity/MaturityExplanationSlideover.vue";
import MaturityOverrideModal from "~/components/maturity/MaturityOverrideModal.vue";
import MaturityStagePath from "~/components/maturity/MaturityStagePath.vue";

interface Props {
  workspace: ReviewWorkspace;
  entry: Extract<WorkspaceMaturityEntry, { kind: "result" }>;
  assessmentRouteName: string;
  assessmentParams: Record<string, string>;
  /** UX only — the server re-authorizes every override transition. */
  canOverride: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ changed: [] }>();

const revision = computed(() =>
  props.workspace.templateRevisions.find(
    (candidate) => candidate.id === props.entry.templateRevisionId
  )
);

// The workspace already decoded this document to derive the result entry.
const definition = computed(() =>
  decodeMaturityDefinition(revision.value?.maturityDefinition)
);

const questions = computed(() =>
  indexStagePathQuestions(
    props.workspace.pillars.filter(
      (pillar) => pillar.templateRevisionId === props.entry.templateRevisionId
    )
  )
);

/** AC-056: the qualifier is removed only when every question is answered. */
const provisional = computed(() => props.entry.coverage.unanswered > 0);

const effective = computed(() => props.entry.effectiveResult);
const calculated = computed(() => props.entry.trace);
const calculatedDisplayPercent = computed(() =>
  toWholePercent(deserializeRatio(props.entry.trace.result))
);

const explanationOpen = ref(false);
const overrideOpen = ref(false);

const pillarName = (pillarId: string) =>
  props.workspace.pillars.find((pillar) => pillar.id === pillarId)?.name ??
  pillarId;

const pillarStageName = (stage: number | null) =>
  stage === null ? "—" : MATURITY_STAGES[stage - 1]!.name;

const linkFor = (questionId: string): RouteLocationRaw => ({
  name: props.assessmentRouteName,
  params: props.assessmentParams,
  query: { templateRevisionId: props.entry.templateRevisionId },
  hash: `#question-${questionId}`,
});
</script>

<template>
  <article
    class="maturity-result-card border-default min-w-0 border-b py-6"
    :aria-label="`Maturity result for ${revision?.name ?? 'pinned revision'}; revision identity ${entry.templateRevisionId}`"
  >
    <header
      class="flex min-w-0 flex-col items-start gap-4 md:flex-row md:justify-between"
    >
      <div class="max-w-full min-w-0">
        <h3 class="text-highlighted text-lg font-semibold break-words">
          {{ revision?.name ?? "Pinned revision" }}
        </h3>
        <p
          class="text-muted mt-1 flex max-w-full min-w-0 flex-wrap items-center gap-2 text-[13px]"
        >
          <span>revision {{ revision?.revisionNumber ?? "?" }}</span>
          <span
            tabindex="0"
            class="border-default max-w-full overflow-x-auto rounded-md border px-2 py-0.5 font-mono whitespace-nowrap"
            aria-label="Pinned revision identity, scroll horizontally"
            >{{ entry.templateRevisionId }}</span
          >
          <UBadge
            v-if="revision?.status === 'retired'"
            color="neutral"
            variant="subtle"
            size="sm"
            >Retired</UBadge
          >
          <span class="text-muted">
            {{ workspace.subject.name }} · {{ workspace.review.status }}
          </span>
        </p>
      </div>
      <div
        class="flex max-w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap"
      >
        <UButton
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-calculator"
          @click="explanationOpen = true"
        >
          How is this calculated?
        </UButton>
        <UButton
          v-if="canOverride"
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-shield-check"
          @click="overrideOpen = true"
        >
          Record reviewed maturity
        </UButton>
      </div>
    </header>

    <div class="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span class="text-highlighted text-4xl font-bold">
        {{ effective.displayPercent }}%
      </span>
      <span class="text-default text-lg font-semibold">
        Stage {{ effective.stage.stage }} · {{ effective.stage.name }}
      </span>
      <UBadge v-if="provisional" color="neutral" variant="subtle" size="sm">
        Provisional
      </UBadge>
      <UBadge
        v-if="effective.source === 'override'"
        color="primary"
        variant="subtle"
        size="sm"
        leading-icon="i-lucide-shield-check"
      >
        Advisor reviewed
      </UBadge>
    </div>
    <p class="text-muted mt-1 text-sm">
      {{ entry.coverage.answered }} of {{ entry.coverage.total }} questions
      answered
    </p>

    <!-- AC-030: the calculated result stays discoverable beside the override. -->
    <div
      v-if="effective.source === 'override' && effective.override"
      class="border-primary/50 mt-3 border-l-2 py-1 pl-4 text-sm"
    >
      <p class="text-default">
        Calculated: {{ calculatedDisplayPercent }}% · Stage
        {{ calculated.stage.stage }} {{ calculated.stage.name }}
      </p>
      <p class="text-muted mt-1 text-[13px]">
        Reviewed by {{ effective.override.actorId }} ·
        {{ effective.override.occurredAt }}
      </p>
    </div>

    <MaturityStagePath
      v-if="definition"
      class="mt-6"
      :definition="definition"
      :trace="entry.trace"
      :current-stage="effective.stage.stage"
      :provisional="provisional"
      :questions="questions"
      :link-for="linkFor"
    />

    <section class="mt-6" aria-label="Pillar breakdown">
      <h4 class="text-muted text-sm font-semibold">Pillar breakdown</h4>
      <div
        data-pillar-breakdown-scroll
        tabindex="0"
        class="mt-2 max-w-full overflow-x-auto"
        aria-label="Pillar breakdown table, scroll horizontally"
      >
        <table class="w-full min-w-[38rem] text-sm">
          <thead>
            <tr class="text-muted text-[13px] font-semibold">
              <th scope="col" class="py-1 text-left font-medium">Pillar</th>
              <th scope="col" class="py-1 text-right font-medium">Result</th>
              <th scope="col" class="py-1 text-right font-medium">Stage</th>
              <th scope="col" class="py-1 text-right font-medium">Answered</th>
              <th scope="col" class="py-1 text-right font-medium">
                Unanswered
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="pillar in entry.pillars"
              :key="pillar.pillarId"
              class="border-default border-t"
            >
              <td class="text-default py-2">
                {{ pillarName(pillar.pillarId) }}
              </td>
              <td class="text-default py-2 text-right">
                {{
                  pillar.displayPercent === null
                    ? "—"
                    : `${pillar.displayPercent}%`
                }}
              </td>
              <td class="text-muted py-2 text-right">
                {{ pillarStageName(pillar.stage) }}
              </td>
              <td class="text-muted py-2 text-right">
                {{ pillar.answered }}/{{ pillar.total }}
              </td>
              <td class="text-muted py-2 text-right">
                {{ pillar.unanswered }} unanswered
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <MaturityExplanationSlideover
      v-model:open="explanationOpen"
      :workspace="workspace"
      :entry="entry"
      :questions="questions"
    />
    <MaturityOverrideModal
      v-model:open="overrideOpen"
      :workspace="workspace"
      :entry="entry"
      @saved="emit('changed')"
    />
  </article>
</template>
