<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'max-w-xl' }">
    <template #content>
      <div ref="modalRef" class="p-6">
        <NAReasonForm
          :question-text="currentQuestion?.text"
          :item-text="currentItemText"
          :selected-reason="selectedReason"
          :comment="comment"
          :is-editing="isEditing"
          @update:selected-reason="selectReason"
          @update:comment="updateComment"
          @confirm="handleConfirm"
          @cancel="handleCancel"
          @clear="handleClear"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { onKeyStroke } from "@vueuse/core";
import { useNAModal } from "~/ui/useNAModal";
import type { NAReasonType } from "~/models/question";

const modal = useNAModal();

const isOpen = modal.isOpen;
const currentQuestion = modal.currentQuestion;
const currentItemId = modal.currentItemId ?? computed(() => null);
const selectedReason = modal.selectedReason;
const comment = modal.comment;
const isEditing = modal.isEditing;
const closeModal = modal.closeModal;
const selectReason = modal.selectReason;
const updateComment = modal.updateComment;
const getNAReason = modal.getNAReason;

const currentItemText = computed(() => {
  if (!currentItemId.value || !currentQuestion.value?.checklistItems) {
    return undefined;
  }
  const item = currentQuestion.value.checklistItems.find(
    (ci) => ci.id === currentItemId.value
  );
  return item?.text;
});

const emit = defineEmits<{
  confirm: [reason: { reason: NAReasonType; comment?: string }];
  clear: [];
}>();

const modalRef = ref<HTMLElement>();

const handleCancel = () => {
  closeModal();
};

const handleConfirm = () => {
  const naReason = getNAReason();
  if (naReason) {
    emit("confirm", naReason);
    closeModal();
  }
};

const handleClear = () => {
  emit("clear");
  closeModal();
};

onKeyStroke("Escape", () => {
  if (isOpen.value) {
    handleCancel();
  }
});

watch(isOpen, (newValue) => {
  if (newValue) {
    nextTick(() => {
      const firstButton = modalRef.value?.querySelector("button");
      firstButton?.focus();
    });
  }
});
</script>
