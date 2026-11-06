<template>
  <UForm
    ref="formRef"
    :schema="attachmentSchema"
    :state="state"
    class="attachment-upload"
    @submit="handleSubmit"
  >
    <UFormField name="files">
      <div class="attachment-upload__dropzone">
        <UFileUpload
          v-model="state.files"
          multiple
          :accept="acceptedTypes"
          icon="i-lucide-cloud-upload"
          label="Click to upload or drag and drop"
          description="PDF, XLSX, PNG, JPEG up to 10MB"
          :preview="false"
          :reset="true"
          class="attachment-upload__input"
          aria-label="Upload attachments: PDF, XLSX, PNG, JPEG up to 10MB"
          :ui="{
            base: 'border-2 rounded-lg',
          }"
          @update:model-value="handleFilesChange"
        />

        <div v-if="uploading" class="attachment-upload__overlay">
          <div class="attachment-upload__overlay-content">
            <UIcon
              name="i-lucide-loader-2"
              class="attachment-upload__spinner"
            />
            Uploading...
          </div>
        </div>
      </div>
    </UFormField>
  </UForm>
</template>

<script setup lang="ts">
import * as z from "zod";

/** Parent handles actual upload to server and displays validation errors */
const emit = defineEmits<{
  upload: [file: File];
  error: [message: string];
}>();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
]);

const acceptedTypes = ".pdf,.xlsx,.xls,.png,.jpg,.jpeg";

const fileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= MAX_FILE_SIZE, "File exceeds 10MB limit")
  .refine(
    (file) => ACCEPTED_MIME_TYPES.has(file.type),
    "Only PDF, XLSX, and images are allowed"
  );

const attachmentSchema = z.object({
  files: z.array(fileSchema).nullable(),
});

type AttachmentSchema = z.output<typeof attachmentSchema>;

const formRef = ref();
const uploading = ref(false);

const state = reactive<AttachmentSchema>({
  files: null,
});

/** Validates files and emits upload events. Resets state to allow subsequent uploads. */
async function handleFilesChange(files: File[] | null | undefined) {
  if (!files || files.length === 0) return;

  const result = attachmentSchema.safeParse({ files });

  if (!result.success) {
    const error = result.error.errors[0]?.message || "Invalid file";
    emit("error", error);
    state.files = null;
    return;
  }

  for (const file of files) {
    emit("upload", file);
  }

  state.files = null;
}

function handleSubmit() {
  // Form submission is handled via @update:model-value on UFileUpload
}

defineExpose({
  /** Controls the loading overlay visibility. Called by parent during upload. */
  setUploading: (value: boolean) => {
    uploading.value = value;
  },
});
</script>

<style scoped>
.attachment-upload__dropzone {
  position: relative;
}

.attachment-upload__input {
  min-height: 8rem;
}

.attachment-upload__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background-color: var(--ui-bg);
  opacity: 0.9;
}

.attachment-upload__overlay-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}

.attachment-upload__spinner {
  width: 1rem;
  height: 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
