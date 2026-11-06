<script setup lang="ts">
/**
 * Maturity results section (maturity-score/REQ-014; AC-025, AC-039, AC-062).
 *
 * Scoped centralization: one clearly separated card per pinned Revision —
 * never a combined Review score — on Review Details and the review
 * Improvement Plan. When rendered outside Review Details, a return path to
 * the Review is offered; assessment deep links live on every card.
 */
import type { RouteLocationRaw } from "vue-router";
import type { ReviewWorkspace } from "~/models/workspace";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import MaturityEntryStateCard from "~/components/maturity/MaturityEntryStateCard.vue";
import MaturityResultCard from "~/components/maturity/MaturityResultCard.vue";

interface Props {
  workspace: ReviewWorkspace;
  assessmentRouteName: string;
  assessmentParams: Record<string, string>;
  /** Return path to the Review; omitted on the Review Details page itself. */
  reviewLink?: RouteLocationRaw | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{ changed: [] }>();

const { actor } = useCurrentActor();

// UX-only discovery cue: a persisted Advisor assignment reveals the form.
// The server separately requires Review edit access and re-authorizes every
// transition; this client check never grants authority.
const canOverride = computed(() =>
  (props.workspace.advisors ?? []).some(
    (participant) => participant.id === actor.value.id
  )
);
</script>

<template>
  <section
    v-if="workspace.maturity.length > 0"
    class="maturity-results"
    aria-label="Maturity"
  >
    <div
      class="mb-4 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h3 class="text-default text-lg font-semibold">Maturity</h3>
        <p class="text-muted mt-0.5 text-sm">
          Each pinned template revision keeps its own separate result.
        </p>
      </div>
      <UButton
        v-if="reviewLink"
        :to="reviewLink"
        variant="ghost"
        color="neutral"
        size="sm"
        icon="i-lucide-arrow-left"
      >
        Back to review
      </UButton>
    </div>

    <div>
      <template
        v-for="entry in workspace.maturity"
        :key="entry.templateRevisionId"
      >
        <MaturityResultCard
          v-if="entry.kind === 'result'"
          :workspace="workspace"
          :entry="entry"
          :assessment-route-name="assessmentRouteName"
          :assessment-params="assessmentParams"
          :can-override="canOverride"
          @changed="emit('changed')"
        />
        <MaturityEntryStateCard
          v-else
          :workspace="workspace"
          :entry="entry"
          :assessment-route-name="assessmentRouteName"
          :assessment-params="assessmentParams"
        />
      </template>
    </div>
  </section>
</template>
