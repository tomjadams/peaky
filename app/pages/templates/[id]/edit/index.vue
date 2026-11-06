<template>
  <div
    ref="studioRoot"
    :inert="showPreview"
    :aria-hidden="showPreview"
    class="flex h-screen flex-col overflow-hidden"
  >
    <!-- Studio Header -->
    <TemplateStudioHeader
      :template="templateAggregate"
      :revision="template"
      :save-status="saveStatus"
      :last-saved-at="lastSavedAt"
      :is-dirty="isDirty"
      :editable="isEditable"
      :owner-team-id="ownerTeamId"
      :owner-team-items="ownerTeamOptions"
      :owner-team-error="ownerTeamError"
      :loading="studioLoading"
      @update:owner-team-id="setOwnerTeamId"
      @save="saveTemplate"
      @preview="showPreview = true"
      @publish="handlePublish"
      @share="showShare = true"
      @markdown="showMarkdown = true"
      @update:name="updateTemplateName"
      @update:description="updateTemplateDescription"
    />

    <div
      v-if="template && !isEditable"
      class="border-warning/20 bg-warning/10 text-default flex items-center justify-between gap-4 border-b px-4 py-2.5 text-sm"
      role="status"
    >
      <span class="flex items-center gap-2">
        <Icon
          name="lucide:lock-keyhole"
          class="text-warning h-4 w-4 shrink-0"
        />
        <span class="font-semibold">Read-only</span>
        <span class="text-muted">{{ editRestrictionMessage }}</span>
      </span>
      <UButton
        v-if="editDraftId"
        :to="{ name: 'template-edit', params: { id: editDraftId } }"
        size="xs"
        color="neutral"
        variant="outline"
      >
        Edit draft
      </UButton>
    </div>

    <!-- Pillar Tabs -->
    <TemplateStudioPillarTabs
      v-if="!studioLoading"
      ref="pillarTabsRef"
      :pillars="template?.pillars ?? []"
      :active-pillar-slug="activePillarSlug"
      :readonly="!isEditable"
      :readonly-reason="editRestrictionMessage"
      @select="setActivePillar"
      @add="addPillar"
      @delete="deletePillar"
      @reorder="reorderPillars"
    />

    <!-- Main Content — the studio's drafting table: the same cutting-mat
         material as the Guided Drafting Room, with the pillar's editor
         reading as a sheet of paper lying on it. -->
    <main
      class="studio-table flex-1 overflow-y-auto bg-[#F4F5F7] dark:bg-slate-950"
    >
      <!-- Questions Editor -->
      <!-- The sheet is capped at 60rem rather than the shell's usual 64rem so
           that the table shows around it: at 1440 that leaves ~224px of mat
           down each side instead of ~192px, which is what lets the dot grid
           register as the surface the paper is lying on. It stops there
           because the sheet still has to carry a full-width practice row —
           the text column plus the reserved 10.5rem stage track and its
           gutter — and at 57rem long practices were already wrapping onto a
           third line. -->
      <div
        class="studio-content mx-auto w-full px-4 transition-[width,max-width,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none min-[1280px]:px-6 min-[1600px]:w-[calc(100%_-_6rem)]"
        :class="
          expandedQuestionId
            ? 'max-w-[72rem] py-4 min-[1600px]:max-w-[88rem] min-[1600px]:py-6 min-[1920px]:max-w-[96rem]'
            : 'max-w-[60rem] py-8 min-[1600px]:max-w-[72rem] min-[1920px]:min-h-full min-[1920px]:max-w-[80rem] min-[1920px]:content-center'
        "
      >
        <!-- Loading State -->
        <div
          v-if="studioLoading"
          class="mx-auto w-full max-w-[60rem]"
          role="status"
          aria-label="Loading template editor"
        >
          <div class="space-y-12">
            <section>
              <div
                class="mb-3 h-[3px] w-10 rounded-[2px] bg-[#0284C7]/50 dark:bg-sky-400/60"
                aria-hidden="true"
              />
              <p class="text-default text-[15px] font-semibold">
                Loading template editor
              </p>
              <div
                class="mt-3 h-4 w-3/5 animate-pulse rounded bg-[#CBD5E1]/70 motion-reduce:animate-none dark:bg-slate-700"
                aria-hidden="true"
              />
              <div class="mt-6 grid grid-cols-5 gap-2" aria-hidden="true">
                <div
                  v-for="index in 5"
                  :key="index"
                  class="border-default space-y-2 border-t pt-3"
                >
                  <div
                    class="h-3 w-6 animate-pulse rounded bg-[#CBD5E1]/70 motion-reduce:animate-none dark:bg-slate-700"
                  />
                  <div
                    class="h-4 w-4/5 animate-pulse rounded bg-[#CBD5E1]/70 motion-reduce:animate-none dark:bg-slate-700"
                  />
                  <div
                    class="h-3 w-full animate-pulse rounded bg-[#CBD5E1]/70 motion-reduce:animate-none dark:bg-slate-700"
                  />
                </div>
              </div>
            </section>
            <section
              class="border-default space-y-4 border-t-2 pt-6"
              aria-hidden="true"
            >
              <div
                class="h-6 w-1/3 animate-pulse rounded bg-[#CBD5E1]/70 motion-reduce:animate-none dark:bg-slate-700"
              />
              <div
                class="border-default h-14 w-full animate-pulse border-b motion-reduce:animate-none"
              />
              <div
                class="border-default h-14 w-full animate-pulse border-b motion-reduce:animate-none"
              />
            </section>
          </div>
        </div>

        <TemplateStudioMaturitySection
          v-if="!studioLoading && template"
          @preview="showPreview = true"
        />

        <!-- No Pillar State -->
        <div
          v-if="!studioLoading && !activePillar"
          class="border-accented bg-default flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-20 text-center transition-colors dark:border-slate-700 dark:bg-slate-800/50"
          :class="
            template?.pillars.length === 0 && isEditable
              ? 'hover:border-primary/50 hover:bg-muted cursor-pointer dark:hover:border-slate-600 dark:hover:bg-slate-800'
              : ''
          "
          @click="
            template?.pillars.length === 0 && isEditable
              ? triggerAddPillar()
              : undefined
          "
        >
          <div class="bg-muted mb-4 rounded-full p-4 dark:bg-slate-700">
            <Icon name="lucide:layers" class="text-dimmed h-8 w-8" />
          </div>
          <h2 class="text-default text-lg font-semibold">
            {{
              template?.pillars.length === 0
                ? isEditable
                  ? "Create your first pillar"
                  : "No pillars in this revision"
                : "Select a pillar"
            }}
          </h2>
          <p class="text-muted mt-2 max-w-sm text-sm">
            {{
              template?.pillars.length === 0
                ? isEditable
                  ? 'Click here or "Add pillar" above to get started.'
                  : "This read-only revision does not contain any pillars."
                : "Choose a pillar from the tabs above to start editing its questions."
            }}
          </p>
          <UButton
            v-if="template?.pillars.length === 0 && isEditable"
            class="mt-4"
            variant="soft"
            @click.stop="triggerAddPillar"
          >
            <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
            Add pillar
          </UButton>
        </div>

        <!-- Question Editor -->
        <!-- The pillar's sheet on the table: white paper, ink top rule,
             registration marks in the corners — the surface the Guided
             Drafting Room takes over when a question opens.
             One heavy ink rule per screen: while a question is expanded that
             card is the active editor, so the sheet yields its rule to a
             hairline and reads as the table the card lies on. -->
        <div
          v-else-if="activePillar"
          class="border-accented bg-default relative rounded-b-lg border px-8 py-7 dark:bg-slate-900"
          :class="
            expandedQuestionId ? 'border-t' : 'border-t-inverted border-t-2'
          "
        >
          <span class="reg-mark reg-mark-tl" aria-hidden="true" />
          <span class="reg-mark reg-mark-tr" aria-hidden="true" />
          <span class="reg-mark reg-mark-bl" aria-hidden="true" />
          <span class="reg-mark reg-mark-br" aria-hidden="true" />
          <TemplateStudioQuestionList
            :pillar="activePillar"
            :pillar-index="activePillarIndex"
            :pillar-count="template?.pillars.length ?? 0"
            :expanded-question-id="expandedQuestionId"
            :get-question-slug="getQuestionSlug"
            :readonly="!isEditable"
            :readonly-reason="editRestrictionMessage"
            :question-limit-reached="questionLimitReached"
            :preview-open="showPreview"
            @preview="showPreview = true"
            @add-question="
              (text: string) => addQuestion(activePillarSlug!, text)
            "
            @delete-question="
              (id: string) => deleteQuestion(activePillarSlug!, id)
            "
            @expand-question="(id: string) => setExpandedQuestion(id)"
            @collapse-question="setExpandedQuestion(null)"
            @navigate-question="
              (id: string, direction: 1 | -1) => navigateQuestion(id, direction)
            "
            @update-question="
              (id: string, updates: Record<string, unknown>) =>
                updateQuestion(activePillarSlug!, id, updates)
            "
            @reorder-questions="
              (fromIndex: number, toIndex: number) =>
                reorderQuestions(activePillarSlug!, fromIndex, toIndex)
            "
            @add-practice="
              (qId: string, text: string) =>
                addPractice(activePillarSlug!, qId, text)
            "
            @update-practice="
              (qId: string, pId: string, text: string) =>
                updatePractice(activePillarSlug!, qId, pId, text)
            "
            @delete-practice="
              (qId: string, pId: string) =>
                deletePractice(activePillarSlug!, qId, pId)
            "
            @reorder-practices="
              (qId: string, fromIdx: number, toIdx: number) =>
                reorderPractices(activePillarSlug!, qId, fromIdx, toIdx)
            "
            @add-checklist-item="
              (qId: string, text: string) =>
                addChecklistItem(activePillarSlug!, qId, text)
            "
            @update-checklist-item="
              (qId: string, itemId: string, text: string) =>
                updateChecklistItem(activePillarSlug!, qId, itemId, text)
            "
            @delete-checklist-item="
              (qId: string, itemId: string) =>
                deleteChecklistItem(activePillarSlug!, qId, itemId)
            "
            @reorder-checklist-items="
              (qId: string, fromIdx: number, toIdx: number) =>
                reorderChecklistItems(activePillarSlug!, qId, fromIdx, toIdx)
            "
            @add-link="
              (qId: string, title: string, url: string) =>
                addLink(activePillarSlug!, qId, { title, url })
            "
            @update-link="
              (qId: string, index: number, title: string, url: string) =>
                updateLink(activePillarSlug!, qId, index, { title, url })
            "
            @delete-link="
              (qId: string, index: number) =>
                deleteLink(activePillarSlug!, qId, index)
            "
            @reorder-links="
              (qId: string, fromIdx: number, toIdx: number) =>
                reorderLinks(activePillarSlug!, qId, fromIdx, toIdx)
            "
            @update-pillar-description="
              (description: string) =>
                updatePillar(activePillarSlug!, { description })
            "
          />
        </div>
      </div>
    </main>
    <!-- End of content conditional wrapper -->

    <!-- Preview FAB -->
    <button
      v-if="!studioLoading"
      type="button"
      class="bg-primary hover:bg-primary-700 fixed right-6 bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_8px_24px_rgba(15,23,42,.10)] transition-colors"
      aria-label="Preview template"
      @click="showPreview = true"
    >
      <Icon name="lucide:eye" class="h-6 w-6" />
    </button>

    <!-- Preview Modal -->
    <Teleport to="body">
      <div
        v-if="showPreview"
        ref="previewRootRef"
        class="bg-default fixed inset-0 z-[60] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Template preview"
        @keydown="handlePreviewKeydown"
      >
        <div
          class="border-default bg-default flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-4 py-2 sm:flex-nowrap sm:px-6 dark:border-slate-700 dark:bg-slate-900"
        >
          <div class="flex min-w-0 items-center gap-3">
            <Icon name="lucide:eye" class="text-primary h-4 w-4 shrink-0" />
            <div class="min-w-0">
              <span class="text-muted block text-[13px] font-semibold">
                Preview
              </span>
              <h1
                class="text-highlighted truncate text-base font-semibold sm:text-lg"
              >
                {{ template?.name }}
              </h1>
              <p class="text-muted text-[13px]">
                Answers are not saved. Reloading this page clears them.
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <span class="text-muted hidden text-sm sm:inline"
              >Press Esc to exit</span
            >
            <button
              ref="previewExitRef"
              type="button"
              class="border-default text-default hover:bg-muted focus-visible:ring-primary flex min-h-11 items-center gap-2 rounded-[7px] border px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              @click="closePreview"
            >
              <Icon name="lucide:x" class="h-4 w-4" />
              Exit preview
            </button>
          </div>
        </div>

        <div
          class="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-1"
        >
          <aside
            data-testid="preview-navigation"
            class="border-default bg-default min-w-0 overflow-x-auto border-b lg:overflow-y-auto lg:border-r lg:border-b-0 dark:border-slate-800 dark:bg-slate-900"
          >
            <div
              class="flex min-w-max items-center gap-3 px-3 py-2 lg:block lg:min-w-0 lg:p-4"
            >
              <div class="hidden lg:block">
                <p class="text-highlighted truncate text-sm font-semibold">
                  {{ template?.name }}
                </p>
                <p class="text-muted mt-1 text-[13px] font-semibold capitalize">
                  {{ template?.status || "draft" }} revision
                </p>
              </div>

              <div class="lg:border-default lg:mt-6 lg:border-t lg:pt-4">
                <p
                  class="text-muted mb-2 hidden text-sm font-semibold lg:block"
                >
                  Pillars
                </p>
                <nav
                  aria-label="Preview pillars"
                  class="flex gap-1 lg:flex-col"
                >
                  <button
                    v-for="pillar in template?.pillars"
                    :key="pillar.slug"
                    type="button"
                    class="flex w-52 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors lg:w-full"
                    :class="
                      previewActivePillar === pillar.slug
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                    "
                    @click="scrollToPreviewPillar(pillar.slug)"
                  >
                    <span class="truncate">{{ pillar.name }}</span>
                    <span
                      class="text-default text-[13px] font-medium tabular-nums"
                    >
                      {{ previewPillarProgress(pillar.slug) }}% answered
                    </span>
                  </button>
                </nav>
              </div>
            </div>
          </aside>

          <div
            ref="previewContentRef"
            data-testid="preview-content"
            class="min-w-0 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          >
            <div class="mx-auto max-w-5xl">
              <TemplateStudioMaturityPreview
                v-if="template"
                class="mb-12"
                :template-revision-id="template.id"
                :definition="maturityDefinition"
                :questions="scorableQuestions"
                :answers="previewAnswers"
              />

              <div class="flex flex-col gap-12">
                <AssessmentPillarSection
                  v-for="pillar in template?.pillars"
                  :id="`preview-pillar-${pillar.slug}`"
                  :key="pillar.slug"
                  :pillar-name="pillar.name"
                  :pillar-slug="pillar.slug"
                  variant="flat"
                  :answered-count="previewPillarAnsweredCount(pillar.slug)"
                  :total-count="pillar.questions?.length || 0"
                >
                  <AssessmentQuestionRow
                    v-for="question in pillar.questions"
                    :key="question.id"
                    tabindex="-1"
                    data-preview-question-target
                    :question-id="question.id"
                    :question-label="
                      getQuestionSlug(pillar.slug, question.order)
                    "
                    :question-text="question.text"
                    :question-type="question.type"
                    :checklist-items="question.checklistItems"
                    :answer="previewAnswers[question.id] ?? null"
                    :is-info-active="
                      previewInfoQuestionId === question.id && isInfoPanelOpen
                    "
                    @update:answer="
                      handlePreviewAnswerChange(
                        question.id,
                        pillar.slug,
                        $event
                      )
                    "
                    @na-click="handlePreviewNAClick(question, pillar.slug)"
                    @item-na-click="handlePreviewItemNAClick(question, $event)"
                    @info-click="togglePreviewInfo(question)"
                  />
                </AssessmentPillarSection>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- MoreInfoPanel for Preview mode (reuses shared component) -->
    <MoreInfoPanel />

    <!-- Publish Confirmation Modal -->
    <UModal
      :open="showPublishConfirm"
      title="Publish template"
      description="Publishing will make this template available for creating new reviews. Are you sure you want to continue?"
      :ui="{ content: 'max-w-md' }"
      @update:open="showPublishConfirm = $event"
    >
      <template v-if="publishErrors.length > 0" #body>
        <div
          class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
        >
          <p class="mb-2 text-sm font-medium text-red-800 dark:text-red-400">
            Please fix the following issues:
          </p>
          <ul
            class="list-inside list-disc space-y-1 text-sm text-red-700 dark:text-red-300"
          >
            <li v-for="error in publishErrors" :key="error">{{ error }}</li>
          </ul>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <UButton
            size="md"
            color="neutral"
            variant="ghost"
            @click="showPublishConfirm = false"
          >
            Cancel
          </UButton>
          <UButton :loading="isPublishing" @click="confirmPublish">
            {{ isPublishing ? "Publishing..." : "Publish" }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Share Modal -->
    <TemplateStudioShareModal
      :is-open="showShare"
      :template-id="templateId"
      @close="showShare = false"
    />

    <!-- Markdown Modal -->
    <TemplateStudioMarkdownModal
      :is-open="showMarkdown"
      :template="template"
      @close="showMarkdown = false"
      @import="handleMarkdownImport"
    />

    <!-- NA Reason Slideover (for preview mode - rendered in Teleport for z-index) -->
    <Teleport to="body">
      <USlideover
        v-model:open="previewNASlideoverOpen"
        title="Not Applicable"
        side="right"
        :ui="{ content: 'max-w-xl z-[60]', overlay: 'z-[60]' }"
      >
        <template #body>
          <NAReasonForm
            :question-text="previewNAQuestion?.text"
            :selected-reason="previewNASelectedReason"
            :comment="previewNAComment"
            @update:selected-reason="previewNASelectedReason = $event"
            @update:comment="previewNAComment = $event"
            @confirm="handlePreviewNAConfirm"
            @cancel="previewNASlideoverOpen = false"
          />
        </template>
      </USlideover>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { TemplateQuestion, TemplateRevisionDetail } from "~/models";
import { fetchLocalTemplateDraftRecordById } from "~/composables/local/useLocalTemplateDraft";
import type { NAReasonType, QuestionAnswer } from "~/models/question";
import { isChecklistAnswer, isChecklistWithNAAnswer } from "~/models/question";
import type { Command } from "~/composables/nav/useCommandPalette";
import { useMoreInfoPanel } from "~/ui/useMoreInfoPanel";
import { useCommandPalette } from "~/composables/nav/useCommandPalette";
import { useTemplateStudio } from "~/composables/templates/studio/useTemplateStudio";
import { canAddScorableQuestion } from "~/services/maturity/authoring";
import { isQuestionComplete } from "~/services/review/questionCompletion";

definePageMeta({
  name: "template-edit",
  layout: "studio",
});

const route = useRoute();
const templateId = computed(() => route.params.id as string);

const {
  template,
  templateAggregate,
  activePillar,
  activePillarSlug,
  saveStatus,
  lastSavedAt,
  isDirty,
  isLoading,
  canEditDraft,
  isEditable: draftIsEditable,
  localDraftId,
  ownerTeamId,
  ownerTeamOptions,
  ownerTeamError,
  maturityDefinition,
  scorableQuestions,
  loadTemplate,
  setActivePillar,
  setOwnerTeamId,
  saveTemplate,
  publishTemplate,
  updateTemplateName,
  updateTemplateDescription,
  importTemplate,
  addPillar,
  updatePillar,
  deletePillar,
  reorderPillars,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  addPractice,
  updatePractice,
  deletePractice,
  reorderPractices,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
  addLink,
  updateLink,
  deleteLink,
  reorderLinks,
  getQuestionSlug,
} = useTemplateStudio();

const initialLoadComplete = ref(false);
const studioLoading = computed(
  () => isLoading.value || !initialLoadComplete.value
);
const isViewOnlyMode = computed(() => route.query.mode === "view");
const isEditable = computed(
  () => draftIsEditable.value && !isViewOnlyMode.value
);
const questionLimitReached = computed(
  () => !canAddScorableQuestion(scorableQuestions.value)
);

const studioRoot = useTemplateRef<HTMLElement>("studioRoot");
const pillarTabsRef = ref<{ openCreateModal: () => void } | null>(null);
// "Pillar n of m" on the sheet header — the room's "Section n of m"
// vocabulary one level up.
const activePillarIndex = computed(() =>
  template.value && activePillarSlug.value
    ? template.value.pillars.findIndex(
        (pillar) => pillar.slug === activePillarSlug.value
      )
    : -1
);

const showPreview = ref(false);
const showPublishConfirm = ref(false);
const showShare = ref(false);
const showMarkdown = ref(false);
const availableDraftId = ref<string | null>(null);
const editDraftId = computed(() => {
  if (!canEditDraft.value) return null;
  if (template.value?.status === "draft") {
    return localDraftId.value ?? template.value.id ?? null;
  }
  return availableDraftId.value;
});
const editRestrictionMessage = computed(() => {
  const unsavedNotice = isDirty.value
    ? " Unsaved changes remain on this device."
    : "";
  if (isViewOnlyMode.value && template.value?.status === "draft") {
    return editDraftId.value
      ? "Viewing this draft safely. Choose Edit draft to make changes."
      : "This draft is read-only.";
  }
  if (template.value?.status === "published") {
    return editDraftId.value
      ? "Published revisions are read-only. Use Edit draft to make changes."
      : "Published revisions are read-only.";
  }
  if (template.value?.status === "retired") {
    return `Retired revisions are read-only.${unsavedNotice}`;
  }
  if (templateAggregate.value?.status === "archived") {
    return `Archived templates are read-only until restored.${unsavedNotice}`;
  }
  return `You do not have permission to edit this template.${unsavedNotice}`;
});
const publishErrors = ref<string[]>([]);

const triggerAddPillar = () => {
  if (!isEditable.value) return;
  pillarTabsRef.value?.openCreateModal();
};
const isPublishing = ref(false);

// Preview mode state
const previewActivePillar = ref<string | null>(null);
const previewContentRef = ref<HTMLElement | null>(null);
const previewRootRef = ref<HTMLElement | null>(null);
const previewExitRef = ref<HTMLButtonElement | null>(null);
const previewReturnFocusRef = shallowRef<HTMLElement | null>(null);
const previewAnswers = ref<Record<string, QuestionAnswer>>({});

// Preview NA Slideover state (uses USlideover instead of modal to avoid modal-in-modal)
const previewNASlideoverOpen = ref(false);
const previewNAQuestion = ref<TemplateQuestion | null>(null);
const previewNAItemId = ref<string | null>(null);
const previewNASelectedReason = ref<NAReasonType | null>(null);
const previewNAComment = ref("");

// Info panel for preview (reuses MoreInfoPanel)
const {
  openMoreInfoPanel,
  closeMoreInfoPanel,
  isOpen: isInfoPanelOpen,
} = useMoreInfoPanel();
const previewInfoQuestionId = ref<string | null>(null);

const handlePreviewAnswerChange = (
  questionId: string,
  _pillarSlug: string,
  value: QuestionAnswer
) => {
  previewAnswers.value[questionId] = value;
};

const handlePreviewNAClick = (
  templateQuestion: TemplateQuestion,
  _pillarSlug: string
) => {
  previewNAQuestion.value = templateQuestion;
  previewNAItemId.value = null;
  previewNASelectedReason.value = null;
  previewNAComment.value = "";
  previewNASlideoverOpen.value = true;
};

const handlePreviewItemNAClick = (
  templateQuestion: TemplateQuestion,
  itemId: string
) => {
  previewNAQuestion.value = templateQuestion;
  previewNAItemId.value = itemId;
  previewNASelectedReason.value = null;
  previewNAComment.value = "";
  previewNASlideoverOpen.value = true;
};

const togglePreviewInfo = (question: TemplateQuestion) => {
  if (previewInfoQuestionId.value === question.id && isInfoPanelOpen.value) {
    closeMoreInfoPanel();
    previewInfoQuestionId.value = null;
  } else {
    previewInfoQuestionId.value = question.id;
    const questionType = question.type || "yes-no";
    const practices =
      questionType === "checklist"
        ? (question.checklistItems ?? []).map((item) => item.text)
        : (question.leadingPractices ?? []).map((p) => p.text);

    openMoreInfoPanel({
      title: question.text,
      whyImportant: question.importance || "No importance defined.",
      leadingPractices: practices,
      helpfulLinks: question.helpfulLinks || [],
    });
  }
};

const handlePreviewNAConfirm = () => {
  const question = previewNAQuestion.value;
  if (!question || !previewNASelectedReason.value) return;

  const itemId = previewNAItemId.value;
  if (itemId) {
    const currentAnswer = previewAnswers.value[question.id] ?? null;
    const checked = isChecklistWithNAAnswer(currentAnswer)
      ? currentAnswer.checked
      : isChecklistAnswer(currentAnswer)
        ? currentAnswer
        : [];
    const na = isChecklistWithNAAnswer(currentAnswer) ? currentAnswer.na : [];
    previewAnswers.value[question.id] = {
      checked: checked.filter((checkedId) => checkedId !== itemId),
      na: [...new Set([...na, itemId])],
    };
  } else {
    previewAnswers.value[question.id] = "na";
  }

  previewNAItemId.value = null;
  previewNASlideoverOpen.value = false;
};

const scrollToPreviewPillar = (slug: string) => {
  previewActivePillar.value = slug;
  const element = document.getElementById(`preview-pillar-${slug}`);
  if (element && previewContentRef.value) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

const previewPillarAnsweredCount = (pillarSlug: string) => {
  const pillar = template.value?.pillars.find(
    (candidate) => candidate.slug === pillarSlug
  );
  return (
    pillar?.questions.filter((question) =>
      isQuestionComplete(question, previewAnswers.value[question.id])
    ).length ?? 0
  );
};

const previewPillarProgress = (pillarSlug: string) => {
  const pillar = template.value?.pillars.find(
    (candidate) => candidate.slug === pillarSlug
  );
  if (!pillar?.questions.length) return 0;
  return Math.round(
    (previewPillarAnsweredCount(pillarSlug) / pillar.questions.length) * 100
  );
};

const closePreview = () => {
  showPreview.value = false;
};

const handlePreviewKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    closePreview();
    return;
  }
  if (event.key !== "Tab" || !previewRootRef.value) return;
  const focusable = Array.from(
    previewRootRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

// Reset preview state when opening
watch(showPreview, (isOpen) => {
  if (isOpen) {
    previewReturnFocusRef.value =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    previewActivePillar.value = template.value?.pillars?.[0]?.slug ?? null;
    previewInfoQuestionId.value = null;
    closeMoreInfoPanel();
    nextTick(() => previewExitRef.value?.focus());
    return;
  }

  const returnTarget = previewReturnFocusRef.value;
  previewReturnFocusRef.value = null;
  nextTick(() => {
    if (returnTarget?.isConnected) returnTarget.focus();
  });
});

// Local expand state to avoid global state issues
const expandedQuestionId = ref<string | null>(null);
const setExpandedQuestion = (id: string | null) => {
  expandedQuestionId.value = id;
};

// Cross-question navigation (guided room's prev/next chevrons) — move the
// single expanded question to its neighbour in the active pillar's
// currently displayed order. `questionId` names the question the request
// came from so this stays correct even if it fires a beat after
// `expandedQuestionId` last changed.
const navigateQuestion = (questionId: string, direction: 1 | -1) => {
  const questions = activePillar.value?.questions;
  if (!questions) return;
  const currentIndex = questions.findIndex((q) => q.id === questionId);
  if (currentIndex === -1) return;
  const targetIndex = currentIndex + direction;
  const target = questions[targetIndex];
  if (!target) return;
  setExpandedQuestion(target.id);
};

const resolveAvailableDraft = async () => {
  if (template.value?.status === "draft" || !templateAggregate.value?.id) {
    availableDraftId.value = null;
    return;
  }
  try {
    const draft = await fetchLocalTemplateDraftRecordById(
      templateAggregate.value.id
    );
    availableDraftId.value = draft?.draftId ?? null;
  } catch {
    availableDraftId.value = null;
  }
};

onMounted(async () => {
  try {
    await loadTemplate(templateId.value);
  } finally {
    initialLoadComplete.value = true;
  }
  void resolveAvailableDraft();
});

watch(localDraftId, async (draftId) => {
  if (!draftId || templateId.value !== "new") {
    return;
  }

  await navigateTo(`/templates/${draftId}/edit`, { replace: true });
});

// Command palette integration
const { registerCommands } = useCommandPalette();

// Navigation commands - jump to pillars
const pillarNavigationCommands = computed<Command[]>(() => {
  if (!template.value?.pillars) return [];
  return template.value.pillars.map((pillar) => ({
    id: `studio-nav-pillar-${pillar.slug}`,
    title: `Go to: ${pillar.name}`,
    group: "Navigation",
    icon: "lucide:bookmark",
    keywords: [
      "pillar",
      "section",
      "navigate",
      "jump",
      pillar.name.toLowerCase(),
    ],
    run: () => {
      setActivePillar(pillar.slug);
      // Scroll the pillar tab into view
      nextTick(() => {
        const tabEl = studioRoot.value?.querySelector(
          `[data-pillar-slug="${pillar.slug}"]`
        );
        tabEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
  }));
});

// Action commands
const studioActionCommands = computed<Command[]>(() => {
  const commands: Command[] = [
    // Save
    {
      id: "studio-save",
      title: "Save template",
      group: "Actions",
      icon: "lucide:save",
      shortcut: "⌘S",
      keywords: ["save", "draft", "update"],
      disabled: !isDirty.value,
      hidden: !isEditable.value,
      run: () => {
        void saveTemplate();
      },
    },
    // Preview
    {
      id: "studio-preview",
      title: "Preview template",
      group: "Actions",
      icon: "lucide:eye",
      keywords: ["preview", "view", "test", "show"],
      run: () => {
        showPreview.value = true;
      },
    },
    // Add pillar - triggers the add pillar UI
    {
      id: "studio-add-pillar",
      title: "Add new pillar",
      group: "Actions",
      icon: "lucide:plus-circle",
      keywords: ["pillar", "section", "add", "create", "new"],
      hidden: !isEditable.value,
      run: () => {
        // Click the "Add pillar" button to start the inline add flow
        const addBtn = studioRoot.value?.querySelector(
          "[data-add-pillar-btn]"
        ) as HTMLButtonElement | null;
        addBtn?.click();
      },
    },
    // Add question - focuses the add question input
    {
      id: "studio-add-question",
      title: "Add new question",
      group: "Actions",
      icon: "lucide:plus",
      keywords: ["question", "add", "create", "new"],
      disabled: !activePillar.value,
      hidden: !isEditable.value,
      run: () => {
        // Focus the add question input
        const input = studioRoot.value?.querySelector(
          "[data-add-question-input]"
        ) as HTMLInputElement | null;
        input?.focus();
      },
    },
    // Share
    {
      id: "studio-share",
      title: "Share template",
      group: "Actions",
      icon: "lucide:share-2",
      keywords: ["share", "collaborate", "invite", "team"],
      run: () => {
        showShare.value = true;
      },
    },
    // Markdown import/export
    {
      id: "studio-markdown",
      title: "Import / Export Markdown",
      group: "Actions",
      icon: "lucide:file-code",
      keywords: ["export", "import", "markdown", "download", "upload", "md"],
      run: () => {
        showMarkdown.value = true;
      },
    },
  ];

  if (!isEditable.value && editDraftId.value) {
    commands.unshift({
      id: "studio-edit-draft",
      title: "Edit draft template",
      group: "Actions",
      icon: "lucide:pencil",
      keywords: ["edit", "draft", "template", "author"],
      to: {
        name: "template-edit",
        params: { id: editDraftId.value },
      },
    });
  }

  // Collapse/Expand all (only if there are questions)
  const hasQuestions = template.value?.pillars?.some(
    (p) => p.questions && p.questions.length > 0
  );
  if (hasQuestions) {
    commands.push({
      id: "studio-collapse-all",
      title: "Collapse all questions",
      group: "View",
      icon: "lucide:chevrons-up",
      keywords: ["collapse", "fold", "minimize", "close"],
      run: () => {
        setExpandedQuestion(null);
      },
    });
  }

  return commands;
});

// Register commands on mount and update when template changes
onMounted(() => {
  let unregisterPillars = registerCommands(
    pillarNavigationCommands.value,
    "lifecycle"
  );
  let unregisterActions = registerCommands(
    studioActionCommands.value,
    "lifecycle"
  );

  // Re-register when template or state changes
  watch(
    [
      () => template.value?.pillars,
      activePillarSlug,
      isDirty,
      editDraftId,
      isEditable,
    ],
    () => {
      unregisterPillars();
      unregisterActions();
      unregisterPillars = registerCommands(
        pillarNavigationCommands.value,
        "lifecycle"
      );
      unregisterActions = registerCommands(
        studioActionCommands.value,
        "lifecycle"
      );
    },
    { deep: true }
  );

  // Cleanup on unmount handled by lifecycle scope
});

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    if (showPreview.value) showPreview.value = false;
    else if (showShare.value) showShare.value = false;
    else if (showMarkdown.value) showMarkdown.value = false;
    // showPublishConfirm's escape handling now comes free with UModal.
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

const handlePublish = () => {
  publishErrors.value = [];
  showPublishConfirm.value = true;
};

const confirmPublish = async () => {
  isPublishing.value = true;
  const result = await publishTemplate();
  isPublishing.value = false;

  if (result.success) {
    showPublishConfirm.value = false;
  } else {
    publishErrors.value = result.errors ?? ["Unknown error occurred"];
  }
};

const handleMarkdownImport = (imported: Partial<TemplateRevisionDetail>) => {
  importTemplate(imported);
  showMarkdown.value = false;
};

onBeforeRouteLeave((to, from, next) => {
  if (isDirty.value) {
    const answer = window.confirm(
      "You have unsaved changes. Are you sure you want to leave?"
    );
    if (!answer) {
      next(false);
      return;
    }
  }
  next();
});
</script>

<style scoped>
/* Content area padding */
.studio-content {
  padding-top: clamp(2rem, 8vh, 6rem);
  padding-bottom: 4rem;
}

/* The studio's own cutting mat — identical recipe to the Guided Drafting
   Room's table, so opening a question reads as the sheet taking over the
   screen, not a scene change. */
.studio-table {
  background-image: radial-gradient(circle, #e4e7eb 1px, transparent 1px);
  background-size: 24px 24px;
}
.dark .studio-table {
  background-image: radial-gradient(
    circle,
    rgba(51, 65, 85, 0.5) 1px,
    transparent 1px
  );
}

/* Registration marks — same hairline L-marks as the room's sheet. */
.reg-mark {
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
}
.reg-mark::before,
.reg-mark::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  background: var(--ui-border);
}
.dark .reg-mark::before,
.dark .reg-mark::after {
  background: #334155;
}
.reg-mark::before {
  width: 12px;
  height: 1px;
}
.reg-mark::after {
  width: 1px;
  height: 12px;
}
.reg-mark-tl {
  top: 10px;
  left: 10px;
}
.reg-mark-tr {
  top: 10px;
  right: 10px;
  transform: scaleX(-1);
}
.reg-mark-bl {
  bottom: 10px;
  left: 10px;
  transform: scaleY(-1);
}
.reg-mark-br {
  bottom: 10px;
  right: 10px;
  transform: scale(-1);
}
</style>
