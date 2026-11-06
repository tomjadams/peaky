<template>
  <UModal
    :open="isOpen"
    :title="modalTitle"
    :ui="{
      content:
        'h-[calc(100dvh-2rem)] max-h-[52rem] w-[calc(100vw-2rem)] max-w-6xl overflow-hidden rounded-lg bg-elevated shadow-[0_8px_24px_rgba(15,23,42,.10)] ring-1 ring-default sm:h-[calc(100dvh-4rem)] sm:w-[calc(100vw-4rem)]',
    }"
    @update:open="!$event && $emit('close')"
  >
    <template #content>
      <div class="flex h-full min-h-0 w-full flex-col">
        <!-- Header -->
        <div
          class="border-default flex shrink-0 items-center justify-between border-b px-6 py-4 dark:border-slate-700"
        >
          <div class="flex items-center gap-4">
            <h3
              id="markdown-modal-title"
              class="text-highlighted text-lg font-semibold"
            >
              {{ modalTitle }}
            </h3>
            <div
              class="border-default flex rounded-lg border p-0.5 dark:border-slate-700"
            >
              <button
                type="button"
                :class="[
                  'rounded-md px-3 py-1 text-sm font-semibold transition-colors',
                  mode === 'export'
                    ? 'bg-primary text-white'
                    : 'text-muted hover:bg-muted dark:hover:bg-slate-700',
                ]"
                @click="mode = 'export'"
              >
                Export
              </button>
              <button
                type="button"
                :class="[
                  'rounded-md px-3 py-1 text-sm font-semibold transition-colors',
                  mode === 'import'
                    ? 'bg-primary text-white'
                    : 'text-muted hover:bg-muted dark:hover:bg-slate-700',
                ]"
                @click="mode = 'import'"
              >
                Import
              </button>
            </div>
          </div>
          <button
            type="button"
            class="text-dimmed hover:bg-muted hover:text-default rounded-lg p-1.5 transition-colors dark:hover:bg-slate-700"
            aria-label="Close"
            @click="$emit('close')"
          >
            <Icon name="lucide:x" class="h-5 w-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="min-h-0 flex-1 overflow-hidden p-6">
          <!-- Export Mode -->
          <div
            v-if="mode === 'export'"
            class="flex h-full min-h-0 flex-col gap-4"
          >
            <div class="flex items-center justify-between">
              <p class="text-muted text-sm">
                Copy this markdown to share or backup your template
              </p>
              <button
                type="button"
                class="border-accented text-default hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                @click="copyMarkdown"
              >
                <Icon
                  :name="copied ? 'lucide:check' : 'lucide:copy'"
                  class="h-4 w-4"
                />
                {{ copied ? "Copied!" : "Copy All" }}
              </button>
            </div>
            <UTextarea
              :model-value="exportedMarkdown"
              readonly
              :rows="24"
              variant="outline"
              :ui="{
                root: 'min-h-0 flex-1',
                base: 'h-full min-h-[16rem] resize-none overflow-auto bg-muted font-mono text-sm leading-6',
              }"
            />
          </div>

          <!-- Import Mode -->
          <div v-else class="flex h-full min-h-0 flex-col gap-4">
            <template v-if="pendingImport">
              <div class="bg-muted flex-1 overflow-y-auto rounded-lg p-6">
                <div class="bg-primary mb-4 h-[3px] w-10 rounded-full" />
                <h4 class="text-highlighted text-xl font-bold">
                  Review import
                </h4>
                <p class="text-muted mt-2 max-w-2xl text-sm">
                  Replacing the template changes its name and all pillar and
                  question content. Review the scope before continuing.
                </p>
                <div class="mt-6 grid gap-4 sm:grid-cols-2">
                  <div class="border-default bg-default rounded-lg border p-4">
                    <p class="text-muted text-sm font-semibold">Current</p>
                    <p class="text-default mt-1 font-semibold">
                      {{ template?.name ?? "Untitled template" }}
                    </p>
                    <p class="text-muted mt-3 text-sm">
                      {{ currentPillarCount }} pillars ·
                      {{ currentQuestionCount }} questions
                    </p>
                  </div>
                  <div
                    class="border-primary/40 bg-default rounded-lg border p-4"
                  >
                    <p class="text-primary text-sm font-semibold">Incoming</p>
                    <p class="text-default mt-1 font-semibold">
                      {{ pendingImport.name ?? "Untitled template" }}
                    </p>
                    <p class="text-muted mt-3 text-sm">
                      {{ incomingPillarCount }} pillars ·
                      {{ incomingQuestionCount }} questions
                    </p>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <p class="text-muted text-sm">
                Paste Markdown to review before replacing the current template.
              </p>
              <UTextarea
                v-model="importMarkdown"
                placeholder="# Template: My Template&#10;&#10;## Pillar: Reliability&#10;&#10;### Question 1 [Critical]&#10;Your question text here...&#10;&#10;**Why it's important:**&#10;Explanation...&#10;&#10;**Leading Practices:**&#10;- Practice 1&#10;- Practice 2"
                :rows="24"
                :color="parseError ? 'error' : 'primary'"
                :highlight="!!parseError"
                :aria-invalid="!!parseError"
                :ui="{
                  root: 'min-h-0 flex-1',
                  base: 'h-full min-h-[16rem] resize-none overflow-auto bg-muted font-mono text-sm leading-6',
                }"
              />
              <div
                v-if="parseError"
                class="border-error/30 bg-error/5 text-error rounded-lg border p-3 text-sm"
              >
                {{ parseError }}
              </div>
            </template>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="border-default flex shrink-0 justify-end gap-3 border-t px-6 py-4 dark:border-slate-700"
        >
          <button
            v-if="mode === 'import' && pendingImport"
            type="button"
            class="border-default text-default hover:bg-muted rounded-lg border px-4 py-2 text-sm font-semibold"
            @click="pendingImport = null"
          >
            Back
          </button>
          <button
            type="button"
            class="text-muted hover:bg-muted rounded-lg px-4 py-2 text-sm font-medium dark:hover:bg-slate-700"
            @click="$emit('close')"
          >
            Cancel
          </button>
          <button
            v-if="mode === 'import'"
            type="button"
            class="bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            :disabled="!pendingImport && !importMarkdown.trim()"
            @click="handleImport"
          >
            {{ pendingImport ? "Replace template" : "Review import" }}
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { TemplateRevisionDetail } from "~/models";
import {
  parseTemplateMarkdown,
  templateToMarkdown,
  UnsupportedTemplateRulesMarkdownError,
} from "~/utils/templateMarkdown";

const props = defineProps<{
  isOpen: boolean;
  template: TemplateRevisionDetail | null;
}>();

const emit = defineEmits<{
  close: [];
  import: [template: Partial<TemplateRevisionDetail>];
}>();

const mode = ref<"export" | "import">("export");
const modalTitle = computed(() =>
  mode.value === "export" ? "Export as Markdown" : "Import from Markdown"
);
const importMarkdown = ref("");
const parseError = ref("");
const copied = ref(false);
const pendingImport = ref<Partial<TemplateRevisionDetail> | null>(null);

const countQuestions = (value: Partial<TemplateRevisionDetail> | null) =>
  value?.pillars?.reduce(
    (total, pillar) => total + pillar.questions.length,
    0
  ) ?? 0;
const currentPillarCount = computed(() => props.template?.pillars.length ?? 0);
const currentQuestionCount = computed(() => countQuestions(props.template));
const incomingPillarCount = computed(
  () => pendingImport.value?.pillars?.length ?? 0
);
const incomingQuestionCount = computed(() =>
  countQuestions(pendingImport.value)
);

const exportedMarkdown = computed(() => {
  if (!props.template) return "";
  return templateToMarkdown(props.template);
});

const copyMarkdown = async () => {
  await navigator.clipboard.writeText(exportedMarkdown.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
};

const handleImport = () => {
  parseError.value = "";

  if (pendingImport.value) {
    emit("import", pendingImport.value);
    pendingImport.value = null;
    importMarkdown.value = "";
    return;
  }

  let parsed: Partial<TemplateRevisionDetail> | null;
  try {
    parsed = parseTemplateMarkdown(importMarkdown.value);
  } catch (error) {
    parseError.value =
      error instanceof UnsupportedTemplateRulesMarkdownError
        ? error.message
        : "Failed to parse markdown. Please check the format.";
    return;
  }

  if (!parsed) {
    parseError.value = "Failed to parse markdown. Please check the format.";
    return;
  }

  if (!parsed.pillars || parsed.pillars.length === 0) {
    parseError.value =
      'No pillars found in the markdown. Make sure to use "## Pillar: Name" format.';
    return;
  }

  pendingImport.value = parsed;
};

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      mode.value = "export";
      importMarkdown.value = "";
      parseError.value = "";
      pendingImport.value = null;
    }
  }
);
</script>
