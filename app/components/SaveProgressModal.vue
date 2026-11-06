<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'max-w-lg' }">
    <template #body>
      <div class="space-y-4 p-1">
        <div>
          <h3 class="text-default text-base font-semibold">Save milestone</h3>
          <p class="text-muted mt-0.5 text-sm">
            Capture what you worked on — this becomes your audit trail.
          </p>
        </div>

        <div v-if="context" class="border-default rounded-lg border p-4">
          <!-- Progress header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="bg-success/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
              >
                <Icon
                  name="lucide:trending-up"
                  class="text-success h-4 w-4"
                  aria-hidden="true"
                />
              </div>
              <p class="text-default text-sm font-medium">
                {{ context.sessionChanges.length }}
                {{ context.sessionChanges.length === 1 ? "change" : "changes" }}
                this session
              </p>
            </div>
            <span
              class="bg-success/10 text-success rounded-full px-2.5 py-0.5 text-[13px] font-medium"
            >
              {{ context.snapshot.overallProgress }}% complete
            </span>
          </div>

          <!-- Per-question before/after diff -->
          <div class="border-default mt-3 space-y-1 border-t pt-3">
            <div
              v-for="change in context.sessionChanges"
              :key="change.questionId"
              class="bg-default flex items-start justify-between gap-3 rounded-lg p-2"
            >
              <p
                class="text-default min-w-0 flex-1 truncate text-[13px]"
                :title="change.questionText"
              >
                {{ change.questionText }}
              </p>
              <div class="flex shrink-0 items-center gap-1.5 text-[13px]">
                <span class="text-muted">{{ labelAnswer(change.before) }}</span>
                <Icon
                  name="lucide:arrow-right"
                  class="text-dimmed h-3 w-3"
                  aria-hidden="true"
                />
                <span
                  :class="
                    change.after === null
                      ? 'text-muted'
                      : 'text-default font-medium'
                  "
                >
                  {{ labelAnswer(change.after) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-1.5">
          <div>
            <p class="text-default text-sm font-medium">
              Milestone note
              <Icon
                name="lucide:pencil-line"
                class="text-muted mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            </p>
            <p class="text-muted text-[13px]">
              In your own words, briefly describe what changed.
            </p>
          </div>
          <div
            class="bg-default border-default flex items-start gap-2 rounded-lg border p-3"
          >
            <UTextarea
              v-model="comment"
              placeholder="Verified DR runbooks with the on-call team; marked security controls as N/A pending audit."
              :rows="2"
              class="flex-1"
              variant="none"
              autoresize
              @keydown.ctrl.enter="handleConfirm"
              @keydown.meta.enter="handleConfirm"
            />
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="handleCancel">
          Cancel
        </UButton>
        <UButton
          color="primary"
          icon="i-lucide-save"
          :loading="saving"
          @click="handleConfirm"
        >
          Save milestone
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { QuestionAnswer } from "~/models/question";
import { useSaveModal } from "~/ui/useSaveModal";

defineProps<{ saving?: boolean }>();

const { isOpen, context, confirm, cancel } = useSaveModal();

const comment = ref("");

watch(isOpen, (open) => {
  if (open) comment.value = "";
});

const labelAnswer = (answer: QuestionAnswer | null): string => {
  if (answer === null || answer === undefined) return "—";
  if (answer === "yes") return "Yes";
  if (answer === "no") return "No";
  if (answer === "na") return "N/A";
  if (Array.isArray(answer)) return `${answer.length} checked`;
  if (typeof answer === "object" && "checked" in answer) {
    return `${answer.checked.length} checked`;
  }
  return String(answer);
};

const handleConfirm = () => {
  confirm(comment.value);
};

const handleCancel = () => {
  cancel();
};
</script>
