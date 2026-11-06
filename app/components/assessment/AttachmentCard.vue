<template>
  <article
    class="attachment-card group relative flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-all hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600 dark:hover:bg-slate-800"
    role="listitem"
  >
    <div
      class="attachment-card__icon flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
      :class="iconClass"
    >
      <Icon :name="iconName" class="h-5 w-5" />
    </div>

    <div class="attachment-card__info min-w-0 flex-1">
      <p
        class="attachment-card__name truncate text-sm font-medium text-slate-900 dark:text-white"
        :title="attachment.filename"
      >
        {{ attachment.filename }}
      </p>
      <p
        class="attachment-card__meta text-xs text-slate-500 dark:text-slate-400"
      >
        {{ formatBytes(attachment.sizeBytes) }} · {{ attachment.createdByName }}
      </p>
    </div>

    <div class="attachment-card__actions flex items-center gap-1">
      <button
        type="button"
        class="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        :aria-label="`Download ${attachment.filename}`"
        @click="handleDownload"
      >
        <Icon name="lucide:download" class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="rounded p-1.5 text-slate-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        :aria-label="`Delete ${attachment.filename}`"
        @click="$emit('delete')"
      >
        <Icon name="lucide:trash-2" class="h-4 w-4" />
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { PillarAttachment } from "~/models";

interface Props {
  attachment: PillarAttachment;
}

const props = defineProps<Props>();

defineEmits<{
  delete: [];
}>();

const iconName = computed(() => {
  const type = props.attachment.contentType;
  if (type === "application/pdf") return "lucide:file-text";
  if (type.includes("spreadsheet") || type.includes("excel"))
    return "lucide:file-spreadsheet";
  if (type.startsWith("image/")) return "lucide:image";
  return "lucide:file";
});

const iconClass = computed(() => {
  const type = props.attachment.contentType;
  if (type === "application/pdf")
    return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
  if (type.includes("spreadsheet") || type.includes("excel"))
    return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
  if (type.startsWith("image/")) return "bg-primary/10 text-primary";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400";
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function handleDownload() {
  window.open(`/api/attachments/${props.attachment.id}/download`, "_blank");
}
</script>
