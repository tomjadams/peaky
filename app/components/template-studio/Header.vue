<template>
  <header
    class="border-default bg-default flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2 lg:h-14 lg:flex-nowrap lg:py-0 dark:border-slate-700"
    :aria-busy="loading"
  >
    <div
      v-if="loading"
      class="flex w-full items-center justify-between gap-6"
      role="status"
      aria-label="Loading template"
    >
      <span class="sr-only">Loading template</span>
      <span
        class="bg-muted h-5 w-56 max-w-1/2 animate-pulse rounded motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span
        class="bg-muted h-8 w-48 animate-pulse rounded motion-reduce:animate-none"
        aria-hidden="true"
      />
    </div>

    <div
      v-else
      class="flex min-w-0 basis-full items-center gap-2 lg:basis-auto"
    >
      <!-- Breadcrumbs -->
      <NuxtLink
        to="/templates"
        class="text-muted hover:text-default text-[15px] font-semibold transition-colors"
      >
        Templates
      </NuxtLink>

      <Icon name="lucide:chevron-right" class="text-dimmed h-4 w-4" />

      <!-- Template Name — one identity: clicking it edits the name AND the
           description together in the details modal. The hover pencil is
           the signifier people already know from the old inline edit. -->
      <h1 v-if="isEditable" class="group relative min-w-0">
        <UTooltip text="Edit name and description">
          <!-- No aria-label: the template name IS the accessible name (and
               what tests target); the tooltip describes the action. -->
          <button
            type="button"
            class="text-highlighted hover:bg-muted flex max-w-full items-center gap-1.5 rounded px-2 py-1 text-[17px] font-bold transition-colors"
            @click="openDetails"
          >
            <!-- Dotted underline: the resting "click to edit" cue, the same
                 mark as the PM/EL identity links. Ink on hover. -->
            <span
              class="min-w-0 truncate underline decoration-[#CBD5E1] decoration-dotted decoration-[1.5px] underline-offset-4 transition-colors group-hover:decoration-[#0369A1] dark:decoration-slate-600 dark:group-hover:decoration-sky-400"
            >
              {{ displayRevision?.name || "Untitled" }}
            </span>
            <Icon
              name="lucide:pencil"
              class="text-dimmed h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        </UTooltip>
      </h1>
      <h1
        v-else
        class="text-highlighted min-w-0 truncate px-2 py-1 text-[17px] font-bold"
      >
        {{ displayRevision?.name || "Untitled" }}
      </h1>

      <span
        class="rounded border px-2 py-0.5 text-[13px] font-bold"
        :class="statusBadgeClass"
      >
        {{ statusBadgeLabel }}
      </span>
      <button
        v-if="templateLifecycle?.id === '' && !ownerTeamId"
        type="button"
        class="text-warning hover:bg-warning/10 rounded px-2 py-1 text-[13px] font-semibold"
        @click="openDetails"
      >
        Owner Team required
      </button>
    </div>

    <div
      v-if="!loading"
      data-testid="studio-header-actions"
      class="flex min-w-0 basis-full flex-wrap items-center justify-end gap-1.5 lg:basis-auto lg:flex-nowrap lg:gap-2"
    >
      <!-- Save Status -->
      <div class="text-muted mr-auto flex items-center gap-1.5 text-sm lg:mr-2">
        <template v-if="saveStatus === 'saving'">
          <Icon name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" />
          <span>Saving</span>
        </template>
        <template v-else-if="saveStatus === 'saved' && lastSavedAt">
          <Icon name="lucide:check" class="text-success h-3.5 w-3.5" />
          <span class="text-default font-medium">
            {{ templateLifecycle ? "Saved locally" : "Saved" }}
          </span>
        </template>
        <template v-else-if="saveStatus === 'error'">
          <Icon name="lucide:alert-circle" class="text-error h-3.5 w-3.5" />
          <span class="text-error">Failed</span>
        </template>
        <template v-else-if="isDirty">
          <span class="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span>Unsaved</span>
        </template>
      </div>

      <!-- Icon Buttons with Tooltips -->
      <UTooltip text="Export / Import Markdown">
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-file-code"
          aria-label="Export or import Markdown"
          data-testid="markdown-modal-trigger"
          @click="$emit('markdown')"
        />
      </UTooltip>

      <UTooltip text="Share Template">
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-share-2"
          aria-label="Share template"
          @click="$emit('share')"
        />
      </UTooltip>

      <div data-testid="header-separator" class="bg-accented mx-1 h-5 w-px" />

      <!-- Primary Actions -->
      <button
        v-if="isEditable"
        type="button"
        class="text-default hover:bg-muted rounded px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50"
        :disabled="!isDirty || saveStatus === 'saving'"
        @click="$emit('save')"
      >
        Save Draft
      </button>

      <UTooltip text="Preview as reviewer">
        <UButton
          variant="ghost"
          color="neutral"
          size="md"
          icon="i-lucide-eye"
          label="Preview"
          @click="$emit('preview')"
        />
      </UTooltip>

      <div
        v-if="isEditable"
        data-testid="header-separator"
        class="bg-accented mx-1 h-5 w-px"
      />

      <!-- Command Palette -->
      <UTooltip text="Quick actions">
        <UButton
          variant="ghost"
          color="neutral"
          size="xs"
          icon="i-lucide-command"
          aria-label="Open command palette"
          @click="openCommandPalette"
        >
          <kbd class="font-mono text-[13px]">{{ isMac ? "⌘" : "Ctrl" }}K</kbd>
        </UButton>
      </UTooltip>

      <!-- Theme Toggle -->
      <ThemeToggle compact />
    </div>

    <!-- Template details — the template's identity in one place: the name,
         and the description shown on template cards in the review wizard.
         Edits apply live and ride the draft autosave; Done just closes. -->
    <UModal
      v-model:open="showDetailsModal"
      title="Template details"
      :ui="{ content: 'max-w-lg' }"
    >
      <template #body>
        <div class="space-y-5">
          <div>
            <label
              for="template-details-name"
              class="text-muted mb-1.5 block text-sm font-semibold"
            >
              Name
            </label>
            <input
              id="template-details-name"
              v-model="draftName"
              type="text"
              class="border-default bg-muted/50 text-highlighted placeholder:text-dimmed focus:border-primary w-full rounded-lg border px-3 py-2 text-[15px] font-semibold focus:outline-none dark:border-slate-700 dark:bg-slate-900"
              placeholder="e.g. Operational Resilience Drill"
              @input="commitName"
            />
          </div>

          <div>
            <div class="mb-1.5 flex items-baseline justify-between">
              <label
                for="template-details-description"
                class="text-muted text-sm font-semibold"
              >
                Description
              </label>
              <span
                class="text-[13px] tabular-nums"
                :class="
                  descriptionLength >= DESCRIPTION_LIMIT
                    ? 'text-warning font-semibold'
                    : 'text-dimmed'
                "
              >
                {{ descriptionLength }}/{{ DESCRIPTION_LIMIT }}
              </span>
            </div>
            <textarea
              id="template-details-description"
              :value="displayRevision?.description ?? ''"
              :maxlength="DESCRIPTION_LIMIT"
              rows="3"
              class="border-default bg-muted/50 text-default placeholder:text-dimmed focus:border-primary w-full resize-none rounded-lg border px-3 py-2 text-sm leading-snug focus:outline-none dark:border-slate-700 dark:bg-slate-900"
              placeholder="e.g. Quarterly resilience checks for critical services, rollback, on-call, and failure-mode coverage."
              @input="
                emit(
                  'update:description',
                  ($event.target as HTMLTextAreaElement).value
                )
              "
            />
            <p class="text-muted mt-1.5 text-[13px]">
              Shown in template selection when teams start a new review.
            </p>
          </div>

          <div class="border-default border-t pt-4">
            <UFormField
              v-if="templateLifecycle?.id === ''"
              label="Owner Team"
              :error="ownerTeamError ?? undefined"
              required
            >
              <USelect
                :model-value="ownerTeamId ?? undefined"
                :items="ownerTeamItems"
                aria-label="Owner Team"
                required
                class="w-full"
                @update:model-value="emit('update:ownerTeamId', String($event))"
              />
            </UFormField>
            <dl
              v-else
              class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm"
            >
              <dt class="text-dimmed">Owner Team</dt>
              <dd class="text-default text-right font-medium">
                {{ ownerTeamDisplay ?? "Not assigned" }}
              </dd>
              <dt class="text-dimmed">Template</dt>
              <dd class="text-default text-right font-medium capitalize">
                {{ templateLifecycle?.status ?? "active" }}
              </dd>
              <dt class="text-dimmed">Revision</dt>
              <dd class="text-default text-right font-medium capitalize">
                {{ displayRevision?.status ?? "draft" }}
                <span v-if="displayRevision?.revisionNumber">
                  · v{{ displayRevision.revisionNumber }}
                </span>
              </dd>
              <dt class="text-dimmed">Storage</dt>
              <dd class="text-default text-right font-medium">
                {{
                  displayRevision?.status === "draft"
                    ? "Local draft"
                    : "Published snapshot"
                }}
              </dd>
            </dl>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end">
          <UButton color="primary" @click="showDetailsModal = false">
            Done
          </UButton>
        </div>
      </template>
    </UModal>
  </header>
</template>

<script setup lang="ts">
import { useCommandPalette } from "~/composables/nav/useCommandPalette";
import type { Template, TemplateRevisionDetail } from "~/models";
import type { SaveStatus } from "~/composables/templates/studio/useTemplateStudio";

const props = withDefaults(
  defineProps<{
    template: Template | TemplateRevisionDetail | null;
    revision?: TemplateRevisionDetail | null;
    saveStatus: SaveStatus;
    lastSavedAt: Date | null;
    isDirty: boolean;
    editable?: boolean;
    ownerTeamId?: string | null;
    ownerTeamItems?: Array<{ label: string; value: string }>;
    ownerTeamError?: string | null;
    loading?: boolean;
  }>(),
  {
    revision: null,
    editable: undefined,
    loading: false,
    ownerTeamId: null,
    ownerTeamItems: () => [],
    ownerTeamError: null,
  }
);

const displayRevision = computed(() => {
  if (props.revision) return props.revision;
  return props.template && "pillars" in props.template ? props.template : null;
});
const templateLifecycle = computed(() =>
  props.revision && props.template && !("pillars" in props.template)
    ? props.template
    : null
);
const ownerTeamDisplay = computed(
  () =>
    props.ownerTeamItems.find((item) => item.value === props.ownerTeamId)
      ?.label ?? props.ownerTeamId
);

const emit = defineEmits<{
  save: [];
  preview: [];
  publish: [];
  share: [];
  markdown: [];
  "update:name": [name: string];
  "update:description": [description: string];
  "update:ownerTeamId": [ownerTeamId: string];
}>();

// ── Template details modal ───────────────────────────────────────────────
// One identity surface: name + description together. Template cards in the
// review wizard clamp descriptions to two lines — author at card size.
const DESCRIPTION_LIMIT = 160;
const showDetailsModal = ref(false);
const descriptionLength = computed(
  () => displayRevision.value?.description.length ?? 0
);

const isEditable = computed(
  () => props.editable ?? displayRevision.value?.status === "draft"
);

// The name field drafts locally and commits only while trimmed non-empty,
// so clearing the input mid-thought never writes an empty name — the last
// valid name stands, and reopening the modal shows it restored.
const draftName = ref("");
const openDetails = () => {
  draftName.value = displayRevision.value?.name ?? "";
  showDetailsModal.value = true;
};
const commitName = () => {
  const trimmed = draftName.value.trim();
  if (trimmed && trimmed !== displayRevision.value?.name) {
    emit("update:name", trimmed);
  }
};

const { open: openCommandPalette } = useCommandPalette();

const isMac = computed(() => {
  if (import.meta.server) return true;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
});

const statusBadgeClass = computed(() => {
  switch (displayRevision.value?.status) {
    case "published":
      return "border-success/25 bg-success/10 text-success";
    case "retired":
      return "border-default bg-muted text-muted";
    default:
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  }
});

const statusBadgeLabel = computed(() => {
  const status = displayRevision.value?.status || "draft";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return displayRevision.value?.revisionNumber
    ? `${label} · v${displayRevision.value.revisionNumber}`
    : label;
});
</script>
