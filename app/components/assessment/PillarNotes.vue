<template>
  <section
    :id="`pillar-notes-${pillarSlug}`"
    class="pillar-notes scroll-mt-24"
    :aria-label="`Notes for ${pillarName}`"
  >
    <button
      type="button"
      class="pillar-notes__header flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
      :aria-expanded="!collapsed"
      :aria-controls="`pillar-notes-content-${pillarSlug}`"
      @click="$emit('toggle')"
    >
      <div class="flex items-center gap-2">
        <Icon
          name="lucide:sticky-note"
          class="h-4 w-4 text-slate-500 dark:text-slate-400"
        />
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
          Notes
        </span>
        <span
          v-if="hasContent"
          class="bg-primary h-1.5 w-1.5 rounded-full"
          aria-hidden="true"
        />
      </div>
      <Icon
        name="lucide:chevron-down"
        class="h-4 w-4 text-slate-400 transition-transform duration-200 dark:text-slate-500"
        :class="{ 'rotate-180': !collapsed }"
      />
    </button>

    <div
      :id="`pillar-notes-content-${pillarSlug}`"
      class="pillar-notes__content grid transition-all duration-300 ease-out"
      :class="collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
    >
      <div class="overflow-hidden">
        <div class="space-y-4 pt-4">
          <div v-if="loading" class="flex items-center justify-center py-8">
            <Icon
              name="lucide:loader-2"
              class="h-5 w-5 animate-spin text-slate-400"
            />
          </div>

          <template v-else>
            <div class="space-y-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Capture observations, context, or follow-up items for this
                pillar. Notes are shared with your team and advisors.
              </p>
              <TemplateStudioRichTextEditor
                v-model="notes.content"
                placeholder="Add context, observations, or follow-up notes..."
                :limit="50000"
                :show-lists="true"
              />
            </div>

            <div v-if="attachments.length > 0" class="space-y-2">
              <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
                Attachments ({{ attachments.length }})
              </p>
              <div
                class="grid gap-2 sm:grid-cols-2"
                role="list"
                aria-label="Attachments"
              >
                <AssessmentAttachmentCard
                  v-for="attachment in attachments"
                  :key="attachment.id"
                  :attachment="attachment"
                  @delete="requestDeleteAttachment(attachment.id)"
                />
              </div>
            </div>

            <AssessmentAttachmentUpload
              ref="uploadRef"
              @upload="handleUpload"
              @error="handleUploadError"
            />

            <div class="flex items-center justify-end gap-3 pt-2">
              <Transition name="celebration">
                <div
                  v-if="showCelebration"
                  class="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400"
                >
                  <Icon name="lucide:sparkles" class="h-4 w-4" />
                  Notes saved!
                </div>
              </Transition>

              <button
                type="button"
                class="bg-primary hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="saving"
                @click="handleSave"
              >
                <Icon
                  v-if="saving"
                  name="lucide:loader-2"
                  class="h-4 w-4 animate-spin"
                />
                <Icon v-else name="lucide:save" class="h-4 w-4" />
                {{ saving ? "Saving..." : "Save Progress" }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </section>

  <UModal
    :open="!!pendingDeleteId"
    @update:open="!$event && cancelDeleteAttachment()"
  >
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-highlighted text-lg font-semibold">
          Delete attachment?
        </h3>
        <p class="text-muted text-sm">
          Are you sure you want to delete this attachment? This action cannot be
          undone.
        </p>
        <div class="flex justify-end gap-3">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="cancelDeleteAttachment"
          />
          <UButton
            color="error"
            label="Delete"
            @click="confirmDeleteAttachment"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { usePillarNotes } from "~/ui/usePillarNotes";
import type AttachmentUpload from "./AttachmentUpload.vue";

interface Props {
  reviewId: string;
  pillarSlug: string;
  pillarName: string;
  collapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: true,
});

defineEmits<{
  toggle: [];
  saved: [];
}>();

const uploadRef = ref<InstanceType<typeof AttachmentUpload> | null>(null);

const {
  notes,
  attachments,
  loading,
  saving,
  save,
  uploadAttachment,
  removeAttachment,
} = usePillarNotes(props.reviewId, props.pillarSlug);

const showCelebration = ref(false);

const hasContent = computed(
  () => notes.value.content.trim().length > 0 || attachments.value.length > 0
);

async function handleSave() {
  const success = await save();
  if (success) {
    showCelebration.value = true;
    setTimeout(() => {
      showCelebration.value = false;
    }, 2000);
  }
}

async function handleUpload(file: File) {
  uploadRef.value?.setUploading(true);
  await uploadAttachment(file);
  uploadRef.value?.setUploading(false);
}

function handleUploadError(message: string) {
  const toast = useToast();
  toast.add({
    title: "Upload failed",
    description: message,
    color: "error",
  });
}

const pendingDeleteId = ref<string | null>(null);

function requestDeleteAttachment(attachmentId: string) {
  pendingDeleteId.value = attachmentId;
}

async function confirmDeleteAttachment() {
  if (pendingDeleteId.value) {
    await removeAttachment(pendingDeleteId.value);
    pendingDeleteId.value = null;
  }
}

function cancelDeleteAttachment() {
  pendingDeleteId.value = null;
}
</script>

<style scoped>
.celebration-enter-active,
.celebration-leave-active {
  transition: all 0.3s ease;
}

.celebration-enter-from,
.celebration-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.9);
}
</style>
