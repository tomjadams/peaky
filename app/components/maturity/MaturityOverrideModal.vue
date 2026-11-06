<script setup lang="ts">
/**
 * Advisor override form (maturity-score/REQ-016; AC-030, AC-031, AC-043).
 *
 * Records one append-only override transition: create when no current
 * override exists, supersede pointing at the current one, or revoke with no
 * reviewed result. Explanation is always required; evidence is required on
 * create/supersede. The calculated maturity stays visible for comparison.
 * Writes go through the domain validation and the outbound enqueue in
 * `recordMaturityOverride`; the server re-authorizes at the sync boundary.
 */
import type {
  ReviewWorkspace,
  WorkspaceMaturityEntry,
} from "~/models/workspace";
import { createUuidV7 } from "~/local-db";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import {
  OverrideTransitionError,
  resolveEffectiveOverride,
  type OverrideTransition,
} from "~/services/maturity/override";
import { recordMaturityOverride } from "~/services/maturity/overrideWrite";
import { deserializeRatio, toWholePercent } from "~/services/maturity/ratio";
import { MATURITY_STAGES } from "~/services/maturity/stages";

interface Props {
  open: boolean;
  workspace: ReviewWorkspace;
  entry: Extract<WorkspaceMaturityEntry, { kind: "result" }>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  saved: [];
}>();

const { actor } = useCurrentActor();

const current = computed(() =>
  resolveEffectiveOverride(
    props.entry.overrideHistory,
    props.workspace.review.id,
    props.entry.templateRevisionId
  )
);

const calculatedDisplayPercent = computed(() =>
  toWholePercent(deserializeRatio(props.entry.trace.result))
);

const stage = ref<1 | 2 | 3 | 4 | 5>(1);
const percent = ref<number>(0);
const explanation = ref("");
const evidence = ref("");
const submitting = ref(false);
/**
 * Revoke is an explicit mode, not a hidden side effect of one button:
 * entering it drops the reviewed-result fields (revoke ignores them) and
 * turns the submit action into an unmistakable Confirm revoke.
 */
const revoking = ref(false);
const errors = reactive({
  percent: "",
  explanation: "",
  evidence: "",
  form: "",
});

const stageOptions = MATURITY_STAGES.map((constant) => ({
  label: `Stage ${constant.stage} — ${constant.name}`,
  value: constant.stage,
}));

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    revoking.value = false;
    stage.value =
      current.value?.reviewedResult?.stage ?? props.entry.trace.stage.stage;
    percent.value =
      current.value?.reviewedResult?.percent ?? calculatedDisplayPercent.value;
    explanation.value = "";
    evidence.value = "";
    errors.percent = "";
    errors.explanation = "";
    errors.evidence = "";
    errors.form = "";
  }
);

const parseEvidence = () =>
  evidence.value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

const validate = (action: "create" | "supersede" | "revoke") => {
  errors.explanation =
    explanation.value.trim() === "" ? "Explanation is required." : "";
  errors.percent = "";
  errors.evidence = "";
  if (action === "revoke") return !errors.explanation;
  if (
    !Number.isInteger(percent.value) ||
    percent.value < 0 ||
    percent.value > 100
  ) {
    errors.percent = "Enter a whole percentage between 0 and 100.";
  }
  if (parseEvidence().length === 0) {
    errors.evidence = "At least one evidence identifier is required.";
  }
  return !errors.explanation && !errors.percent && !errors.evidence;
};

const submit = async (action: "create" | "supersede" | "revoke") => {
  if (!validate(action)) return;
  submitting.value = true;
  errors.form = "";
  const transition: OverrideTransition = {
    id: createUuidV7(),
    reviewId: props.workspace.review.id,
    templateRevisionId: props.entry.templateRevisionId,
    action,
    actorId: actor.value.id,
    occurredAt: new Date().toISOString(),
    priorTransitionId: current.value?.id ?? null,
    reviewedResult:
      action === "revoke"
        ? null
        : {
            percent: percent.value,
            stage: Number(stage.value) as 1 | 2 | 3 | 4 | 5,
          },
    explanation: explanation.value.trim(),
    evidence: action === "revoke" ? [] : parseEvidence(),
  };
  try {
    await recordMaturityOverride({
      history: props.entry.overrideHistory,
      transition,
    });
    emit("saved");
    emit("update:open", false);
  } catch (error) {
    errors.form =
      error instanceof OverrideTransitionError
        ? error.message
        : "The override could not be saved. Please try again.";
  } finally {
    submitting.value = false;
  }
};

const saveAction = computed(() => (current.value ? "supersede" : "create"));

/** The title names the transition being recorded — create, supersede, or
 *  revoke — so a busy Advisor never infers it from the subtitle. */
const dialogTitle = computed(() =>
  revoking.value
    ? "Revoke reviewed override"
    : current.value
      ? "Supersede reviewed maturity"
      : "Record reviewed maturity"
);

const saveLabel = computed(() =>
  current.value ? "Save supersede" : "Save override"
);
</script>

<template>
  <UModal
    :open="open"
    :title="dialogTitle"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-muted text-sm">
          Calculated: {{ calculatedDisplayPercent }}% · Stage
          {{ entry.trace.stage.stage }} {{ entry.trace.stage.name }}.
          <template v-if="current?.reviewedResult">
            Current override: {{ current.reviewedResult.percent }}% · Stage
            {{ current.reviewedResult.stage }}, recorded by
            {{ current.actorId }}.
          </template>
          The calculated result always stays available.
        </p>

        <UAlert
          v-if="errors.form"
          color="error"
          variant="subtle"
          :title="errors.form"
        />

        <!-- A revoke records no reviewed result, so the result fields only
             exist outside the revoke mode (never silently dropped). -->
        <div v-if="!revoking" class="flex flex-wrap gap-4">
          <UFormField
            label="Reviewed stage"
            name="stage"
            class="min-w-48 flex-1"
          >
            <USelect
              v-model="stage"
              :items="stageOptions"
              aria-label="Reviewed stage"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Reviewed percentage"
            name="percent"
            :error="errors.percent || undefined"
            class="w-36"
          >
            <UInput
              v-model.number="percent"
              type="number"
              min="0"
              max="100"
              aria-label="Reviewed percentage"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          label="Explanation"
          name="explanation"
          :error="errors.explanation || undefined"
          required
        >
          <UTextarea
            v-model="explanation"
            aria-label="Explanation"
            :rows="3"
            class="w-full"
            placeholder="Why the reviewed result replaces the calculated one"
          />
        </UFormField>

        <UFormField
          v-if="!revoking"
          label="Evidence identifiers"
          name="evidence"
          :error="errors.evidence || undefined"
        >
          <UTextarea
            v-model="evidence"
            aria-label="Evidence identifiers"
            :rows="2"
            class="w-full"
            placeholder="One identifier per line (for example EV-100)"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <UButton
          v-if="current && !revoking"
          color="error"
          variant="soft"
          :disabled="submitting"
          @click="revoking = true"
        >
          Revoke override
        </UButton>
        <span v-else />
        <div v-if="revoking" class="flex gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="submitting"
            @click="revoking = false"
          >
            Back
          </UButton>
          <UButton
            color="error"
            :loading="submitting"
            @click="submit('revoke')"
          >
            Confirm revoke
          </UButton>
        </div>
        <div v-else class="flex gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="submitting"
            @click="emit('update:open', false)"
          >
            Cancel
          </UButton>
          <UButton
            color="primary"
            :loading="submitting"
            @click="submit(saveAction)"
          >
            {{ saveLabel }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
