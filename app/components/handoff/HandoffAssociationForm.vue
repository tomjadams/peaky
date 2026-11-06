<script setup lang="ts">
/**
 * Provider-neutral existing-ticket association form (improvement-plans/
 * REQ-007, REQ-008, REQ-011; AC-028 through AC-031, AC-039 through AC-042).
 *
 * One existing external work item covers the whole handoff. The form derives
 * the provider and item ID from one validated HTTPS URL. There is no creation
 * control and Peaky never edits the ticket. Field validation uses the shared
 * HandoffLimits contract. A duplicate conflict identifies every conflicting
 * practice with its current reference and offers explicit replacement. The
 * confirmation succeeds or fails atomically.
 */
import type { FormError } from "@nuxt/ui";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { useHandoffSyncGate } from "~/composables/handoff/useHandoffSyncGate";
import { createUuidV7 } from "~/local-db";
import {
  externalWorkItemReferenceFromUrl,
  type AssociationTransition,
} from "~/services/handoff/association";
import type { OrderedDraftPractice } from "~/services/handoff/draft";
import type { HandoffConfirmationConflict } from "~/services/handoff/confirmation";
import { confirmHandoffAssociation } from "~/services/handoff/handoffWrite";
import {
  describeHandoffViolation,
  HANDOFF_LIMITS,
  validateExternalReference,
} from "~/services/handoff/limits";
import {
  practiceEntityId,
  type PracticeReference,
} from "~/services/handoff/practice";

interface Props {
  /** The draft's selected practices, in order — all linked to one item. */
  practices: readonly OrderedDraftPractice[];
  history: readonly AssociationTransition[];
  embedded?: boolean;
}

const props = withDefaults(defineProps<Props>(), { embedded: false });
const emit = defineEmits<{
  confirmed: [];
  replace: [conflict: HandoffConfirmationConflict];
}>();

const { actor } = useCurrentActor();
const { gate } = useHandoffSyncGate();

const state = reactive({ url: "" });
const submitting = ref(false);
const formError = ref("");
const conflicts = ref<readonly HandoffConfirmationConflict[]>([]);
const linkedMessage = ref("");

/** Field-addressable validation against the shared contract (AC-039). */
const validate = (value: typeof state): FormError[] => {
  try {
    const reference = externalWorkItemReferenceFromUrl(value.url);
    return validateExternalReference(reference).map((violation) => ({
      name: "url",
      message: describeHandoffViolation(violation),
    }));
  } catch (error) {
    return [
      {
        name: "url",
        message:
          error instanceof Error
            ? error.message
            : "Enter a valid work item URL.",
      },
    ];
  }
};
const detectedReference = computed(() => {
  try {
    return externalWorkItemReferenceFromUrl(state.url);
  } catch {
    return null;
  }
});

const titleFor = (reference: PracticeReference): string => {
  const entityId = practiceEntityId(reference);
  return (
    props.practices.find((practice) => practice.record.id === entityId)?.record
      .snapshot.title ?? reference.practiceId
  );
};

const onSubmit = async () => {
  submitting.value = true;
  formError.value = "";
  conflicts.value = [];
  linkedMessage.value = "";
  try {
    const reference = externalWorkItemReferenceFromUrl(state.url);
    const result = await confirmHandoffAssociation({
      practices: props.practices.map((practice) => practice.record.reference),
      history: props.history,
      reference,
      actorId: actor.value.id,
      occurredAt: new Date().toISOString(),
      transitionIdFor: () => createUuidV7(),
      gate: gate.value,
    });
    if (result.ok) {
      linkedMessage.value = `Linked ${props.practices.length} practices to ${reference.provider} ${reference.externalId}.`;
      emit("confirmed");
      return;
    }
    if (result.code === "duplicate_association") {
      conflicts.value = result.conflicts;
      return;
    }
    if (result.code === "practice_limit_exceeded") {
      const limit =
        result.violations[0]?.limit ?? HANDOFF_LIMITS.practicesPerHandoff;
      formError.value = `A handoff can contain at most ${limit} practices.`;
      return;
    }
    if (result.code === "empty_selection") {
      formError.value =
        "Select at least one practice before linking a work item.";
      return;
    }
    // Unknown failure codes must still surface — never an empty message.
    const detail = result.violations.map(describeHandoffViolation).join(" ");
    formError.value =
      detail || "The work item could not be linked. Please try again.";
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div :class="embedded ? '' : 'border-default mt-5 border-t pt-5'">
    <h4 v-if="!embedded" class="text-default text-sm font-semibold">
      Link existing work item
    </h4>
    <p class="text-muted mt-0.5 text-[13px]">
      Every selected practice references the same existing work item. Peaky
      never edits the item.
    </p>

    <p role="status" aria-live="polite" class="sr-only">{{ linkedMessage }}</p>

    <UAlert
      v-if="!gate.confirmation.available"
      color="warning"
      variant="subtle"
      icon="i-lucide-cloud-off"
      class="mt-3"
      title="Linking needs a current shared sync view"
      description="You can review the required fields now. Confirmation becomes available when shared sync is current again."
    />

    <UAlert
      v-if="formError"
      role="alert"
      color="error"
      variant="subtle"
      class="mt-3"
      :title="formError"
    />

    <UAlert
      v-if="conflicts.length > 0"
      role="alert"
      color="warning"
      variant="subtle"
      class="mt-3"
      :title="`${conflicts.length} selected ${conflicts.length === 1 ? 'practice is' : 'practices are'} already linked`"
    >
      <template #description>
        <ul class="mt-1 space-y-1.5">
          <li
            v-for="conflict in conflicts"
            :key="practiceEntityId(conflict.practice)"
            class="flex flex-wrap items-center gap-2"
          >
            <span class="text-sm">
              {{ titleFor(conflict.practice) }} — currently linked to
              {{ conflict.current.provider }} {{ conflict.current.externalId }}
            </span>
            <UButton
              variant="link"
              color="primary"
              size="xs"
              class="p-0"
              :aria-label="`Replace the reference for &quot;${titleFor(conflict.practice)}&quot;`"
              @click="emit('replace', conflict)"
            >
              Replace…
            </UButton>
          </li>
        </ul>
      </template>
    </UAlert>

    <UForm
      :state="state"
      :validate="validate"
      class="mt-3 space-y-4"
      @submit="onSubmit"
    >
      <UFormField
        name="url"
        label="Work item URL"
        description="Peaky detects the provider and work item ID from the URL."
        required
      >
        <UInput
          v-model="state.url"
          class="w-full"
          placeholder="https://tracker.example.com/browse/TEAM-123"
        />
      </UFormField>
      <p
        v-if="detectedReference"
        class="border-default bg-muted text-default rounded-[7px] border px-3 py-2 text-[13px]"
      >
        Detected {{ detectedReference.provider }} ·
        {{ detectedReference.externalId }}
      </p>
      <div class="flex justify-end">
        <UButton
          type="submit"
          color="primary"
          :loading="submitting"
          :disabled="!gate.confirmation.available"
        >
          Link existing work item
        </UButton>
      </div>
    </UForm>
  </div>
</template>
