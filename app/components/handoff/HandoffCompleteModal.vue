<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{
  unresolvedCount: number;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{
  confirm: [note: string | null];
}>();

const note = ref("");
const noteRequired = computed(() => props.unresolvedCount > 0);
const canComplete = computed(
  () => !noteRequired.value || note.value.trim().length > 0
);

watch(open, (value) => {
  if (!value) note.value = "";
});

const handleConfirm = () => {
  if (!canComplete.value) return;
  emit("confirm", note.value.trim() || null);
};
</script>

<template>
  <UModal
    v-model:open="open"
    title="Close handoff"
    description="Close this handoff and preserve its history."
    :ui="{ content: 'max-w-lg' }"
  >
    <template #body>
      <div class="space-y-5">
        <div class="space-y-2">
          <p class="text-default text-sm font-semibold">
            Assessment answers do not change
          </p>
          <p class="text-muted text-sm">
            Closing the handoff records that ownership was transferred. It does
            not check assessment items or mark the work complete.
          </p>
          <p class="text-muted text-[13px]">
            Selected practices cannot be added to another handoff after this one
            is closed.
          </p>
        </div>

        <div v-if="unresolvedCount > 0">
          <p class="text-default text-sm font-semibold">
            {{ unresolvedCount }} selected practice{{
              unresolvedCount === 1 ? " still needs" : "s still need"
            }}
            follow-up
          </p>
          <p class="text-muted mt-1 text-sm">
            You can still close the handoff. Record why it is closing before the
            assessment reflects the work.
          </p>
          <UFormField label="Closing note" required class="mt-4">
            <UTextarea
              v-model="note"
              :rows="3"
              :maxlength="2000"
              placeholder="For example: Demo handoff, priorities changed, or work tracked elsewhere"
              class="w-full"
            />
            <template #hint>
              <span class="tabular-nums">{{ note.length }} / 2000</span>
            </template>
          </UFormField>
        </div>
        <p v-else class="text-muted text-sm">
          Every selected practice is resolved. Closing this handoff records the
          finish time and keeps its history available for reporting.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">
          Keep working
        </UButton>
        <UButton :disabled="!canComplete" @click="handleConfirm">
          Close handoff
        </UButton>
      </div>
    </template>
  </UModal>
</template>
