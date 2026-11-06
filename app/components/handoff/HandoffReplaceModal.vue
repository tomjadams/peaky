<script setup lang="ts">
/**
 * Explicit association replacement (improvement-plans/REQ-008, REQ-011;
 * AC-032, AC-039).
 *
 * A modal compares the practice's current external reference with the
 * proposed one and requires an explicit confirmation. The replacement
 * appends a new transition pointing at the current one — the previous
 * reference stays in immutable replacement history and every other
 * practice's association is untouched. Validation consumes the shared
 * HandoffLimits contract; confirmation is gated on sync health.
 */
import type { FormError } from "@nuxt/ui";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { useHandoffSyncGate } from "~/composables/handoff/useHandoffSyncGate";
import { createUuidV7 } from "~/local-db";
import {
  AssociationTransitionError,
  externalWorkItemReferenceFromUrl,
  type AssociationTransition,
} from "~/services/handoff/association";
import { replaceHandoffAssociation } from "~/services/handoff/handoffWrite";
import {
  describeHandoffViolation,
  HandoffLimitError,
  validateExternalReference,
} from "~/services/handoff/limits";

interface Props {
  open: boolean;
  /** The current association transition being replaced. */
  current: AssociationTransition;
  practiceTitle: string;
  history: readonly AssociationTransition[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  saved: [];
}>();

const { actor } = useCurrentActor();
const { gate } = useHandoffSyncGate();

const state = reactive({ url: "" });
const submitting = ref(false);
const formError = ref("");

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    // Prefill from the current reference so a correction is an edit, not a
    // retype; the comparison stays visible above.
    state.url = props.current.reference?.url ?? "";
    formError.value = "";
  },
  { immediate: true }
);

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

const onSubmit = async () => {
  submitting.value = true;
  formError.value = "";
  try {
    const reference = externalWorkItemReferenceFromUrl(state.url);
    await replaceHandoffAssociation({
      history: props.history,
      transition: {
        id: createUuidV7(),
        reviewId: props.current.reviewId,
        practice: props.current.practice,
        action: "replace",
        reference,
        priorTransitionId: props.current.id,
        actorId: actor.value.id,
        occurredAt: new Date().toISOString(),
      },
      gate: gate.value,
    });
    emit("saved");
    emit("update:open", false);
  } catch (error) {
    formError.value =
      error instanceof AssociationTransitionError ||
      error instanceof HandoffLimitError
        ? error.message
        : "The reference could not be replaced. Please try again.";
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <UModal
    :open="open"
    :title="`Replace reference for &quot;${practiceTitle}&quot;`"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <div class="bg-muted rounded-lg p-3">
          <p class="text-dimmed text-xs font-medium tracking-wider uppercase">
            Current reference
          </p>
          <p v-if="current.reference" class="text-default mt-1 text-sm">
            {{ current.reference.provider }} {{ current.reference.externalId }}
          </p>
          <p v-if="current.reference" class="text-muted mt-0.5 text-xs">
            {{ current.reference.url }}
          </p>
        </div>

        <UAlert
          color="primary"
          variant="subtle"
          icon="i-lucide-history"
          title="The current reference stays in the replacement history."
        />

        <UAlert
          v-if="formError"
          role="alert"
          color="error"
          variant="subtle"
          :title="formError"
        />

        <UAlert
          v-if="!gate.confirmation.available"
          color="warning"
          variant="subtle"
          icon="i-lucide-cloud-off"
          :title="gate.confirmation.reason ?? undefined"
        />

        <UForm
          :state="state"
          :validate="validate"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField
            name="url"
            label="New work item URL"
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
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="submitting"
              @click="emit('update:open', false)"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              color="primary"
              :loading="submitting"
              :disabled="!gate.confirmation.available"
            >
              Replace reference
            </UButton>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
