<template>
  <Teleport to="body">
    <Transition name="room-fade-scale">
      <div
        v-if="open"
        ref="roomRootRef"
        data-testid="guided-drafting-room"
        :inert="previewOpen"
        :aria-hidden="previewOpen"
        class="bg-default border-t-primary fixed inset-0 z-50 flex flex-col overflow-hidden border-t-2 dark:bg-slate-900"
        :class="[
          ceremonyMode === 'full'
            ? 'ceremony-full'
            : ceremonyMode === 'handoff'
              ? 'ceremony-handoff'
              : '',
          hasNavigatedSinceOpen ? 'has-navigated' : '',
        ]"
        role="dialog"
        aria-modal="true"
        :aria-label="`Guided drafting: ${questionSlug}`"
      >
        <!-- Header strip -->
        <div
          class="border-primary/20 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-[#EAF3FA] px-4 py-2 lg:h-16 lg:flex-nowrap lg:px-6 lg:py-0 dark:border-sky-400/20 dark:bg-sky-400/10"
        >
          <div class="flex min-w-0 basis-full items-center gap-3 lg:basis-auto">
            <span
              class="border-primary/30 bg-primary/10 text-highlighted shrink-0 rounded border px-2 py-0.5 font-mono text-[13px] font-bold"
            >
              {{ questionSlug }}
            </span>
            <span
              class="text-muted shrink-0 text-[13px] font-semibold tabular-nums"
            >
              {{ severityLabel }} · weight {{ scoreWeight }}
            </span>
            <div class="flex shrink-0 items-center gap-0.5">
              <UButton
                data-testid="guided-room-prev-question"
                variant="ghost"
                color="neutral"
                icon="i-lucide-chevron-left"
                aria-label="Previous question"
                :disabled="!hasPreviousQuestion"
                @click="$emit('navigate-question', -1)"
              />
              <UButton
                data-testid="guided-room-next-question"
                variant="ghost"
                color="neutral"
                icon="i-lucide-chevron-right"
                aria-label="Next question"
                :disabled="!hasNextQuestion"
                @click="$emit('navigate-question', 1)"
              />
            </div>
            <p class="text-muted min-w-0 truncate text-[15px]">
              <InlineMarkdown v-if="question.text" :text="question.text" />
              <span v-else class="text-dimmed italic">Untitled question</span>
            </p>
          </div>

          <div
            class="flex min-w-0 basis-full flex-wrap items-center justify-end gap-2 lg:basis-auto lg:flex-nowrap lg:gap-4"
          >
            <!-- Save status — same indicator as the studio header -->
            <div class="text-muted flex items-center gap-1.5 text-sm">
              <template v-if="saveStatus === 'saving'">
                <Icon name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" />
                <span>Saving</span>
              </template>
              <template v-else-if="saveStatus === 'saved' && lastSavedAt">
                <Icon name="lucide:check" class="text-success h-3.5 w-3.5" />
                <span class="text-default font-medium">{{ savedLabel }}</span>
              </template>
              <template v-else-if="saveStatus === 'error'">
                <Icon
                  name="lucide:alert-circle"
                  class="text-error h-3.5 w-3.5"
                />
                <span class="text-error">Failed</span>
              </template>
              <template v-else-if="isDirty">
                <span class="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>Unsaved</span>
              </template>
            </div>

            <div
              v-if="hasAnyErrors"
              class="text-error flex items-center gap-1.5 text-[13px]"
            >
              <Icon name="lucide:alert-circle" class="h-3.5 w-3.5" />
              <span
                >{{ allValidationErrors.length }} validation error{{
                  allValidationErrors.length > 1 ? "s" : ""
                }}</span
              >
            </div>

            <UButton
              data-testid="guided-room-preview"
              color="primary"
              variant="ghost"
              icon="i-lucide-eye"
              @click="$emit('preview')"
            >
              Preview template
            </UButton>

            <!-- z-[60]: the menu portals to <body> with z auto, and the
                 room itself is z-50 — without the bump the room paints
                 over its own menu. -->
            <UDropdownMenu
              :items="roomMenuItems"
              :content="{ align: 'end' }"
              :ui="{ content: 'z-[60]' }"
            >
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-ellipsis"
                aria-label="More actions"
                data-testid="guided-room-menu"
              />
            </UDropdownMenu>

            <UButton
              data-testid="guided-room-done"
              color="neutral"
              variant="outline"
              @click="requestClose"
            >
              Back to template
            </UButton>
          </div>
        </div>

        <!-- Body: route rail + canvas -->
        <div
          data-testid="guided-room-body"
          class="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden min-[1920px]:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-1 xl:grid-cols-[280px_minmax(0,1fr)]"
        >
          <!-- Left rail — the authoring route -->
          <nav
            ref="railRef"
            aria-label="Guided sections"
            data-testid="guided-rail"
            class="border-default bg-default relative overflow-x-auto border-b px-3 py-2 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:py-6 xl:px-4 xl:py-8 dark:border-slate-700 dark:bg-slate-900"
          >
            <ol class="relative flex min-w-max flex-row lg:min-w-0 lg:flex-col">
              <li
                v-for="(section, index) in SECTIONS"
                :key="section.id"
                :class="{
                  'just-filled': justFilledSectionIds.has(section.id),
                }"
              >
                <button
                  type="button"
                  :data-testid="`guided-waypoint-${section.id}`"
                  :data-waypoint-index="index"
                  :aria-current="
                    section.id === currentSectionId ? 'step' : undefined
                  "
                  :aria-label="`${section.label}, ${waypointState(section)}`"
                  class="route-waypoint relative grid w-44 grid-cols-[24px_minmax(0,1fr)] items-center gap-x-3 rounded-lg px-2 py-3 text-left transition-colors lg:w-full"
                  :class="
                    section.id === currentSectionId
                      ? 'is-current bg-[#EAF3FA] dark:bg-sky-400/10'
                      : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                  "
                  @click="goToSection(index)"
                  @keydown="handleWaypointKeydown"
                >
                  <span
                    class="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center"
                  >
                    <span
                      v-if="waypointState(section) === 'current'"
                      class="dot bg-primary ring-primary/20 dark:ring-primary/30 h-4 w-4 rounded-full ring-4"
                    />
                    <span
                      v-else-if="waypointState(section) === 'complete'"
                      class="dot bg-success ring-success/20 flex h-5 w-5 items-center justify-center rounded-full text-white ring-4"
                    >
                      <Icon name="lucide:check" class="h-3 w-3" />
                    </span>
                    <span
                      v-else-if="waypointState(section) === 'started'"
                      class="dot border-primary bg-primary/20 h-3 w-3 rounded-full border-2"
                    />
                    <span
                      v-else
                      class="dot border-accented bg-default h-2.5 w-2.5 rounded-full border-2 dark:border-slate-600 dark:bg-slate-900"
                    />
                    <span class="halo" aria-hidden="true" />
                  </span>
                  <span
                    class="min-w-0 truncate text-[15px]"
                    :class="waypointLabelClass(section)"
                  >
                    {{ section.label }}
                  </span>
                </button>
              </li>
            </ol>
          </nav>

          <!-- Canvas — one section at a time -->
          <div
            ref="canvasRef"
            data-testid="guided-canvas"
            class="drafting-table min-w-0 overflow-y-auto bg-[#F4F5F7] px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8 xl:px-12 xl:py-10 dark:bg-slate-950"
          >
            <div
              class="sheet border-default bg-default relative mx-auto flex min-h-full w-full max-w-[880px] flex-col rounded-lg border px-4 pt-6 pb-5 min-[1920px]:max-w-[1200px] sm:px-6 sm:pt-8 lg:px-8 xl:px-10 xl:pt-9 xl:pb-6 dark:border-slate-700 dark:bg-slate-900"
            >
              <span class="reg-mark reg-mark-tl" aria-hidden="true" />
              <span class="reg-mark reg-mark-tr" aria-hidden="true" />
              <span class="reg-mark reg-mark-bl" aria-hidden="true" />
              <span class="reg-mark reg-mark-br" aria-hidden="true" />
              <Transition
                name="section-fade"
                mode="out-in"
                @before-leave="destroySortables"
                @after-enter="handleSectionEntered"
              >
                <div
                  :key="currentSectionId"
                  ref="sectionContentRef"
                  class="pb-10"
                  :class="{ 'ink-armed': !hasNavigatedSinceOpen }"
                >
                  <div class="ink-1 mb-8">
                    <div
                      class="mb-3 h-[3px] w-6 rounded-full bg-sky-600 dark:bg-sky-400"
                    />
                    <div
                      class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-baseline sm:gap-4"
                    >
                      <div class="flex min-w-0 items-center gap-2.5">
                        <h2
                          :id="sectionHeadingId"
                          ref="sectionHeadingRef"
                          tabindex="-1"
                          class="text-highlighted rounded-sm text-[22px] font-bold focus:outline-none"
                        >
                          {{ currentSection.label }}
                        </h2>
                        <span
                          class="rounded px-2 py-0.5 text-[13px] font-semibold"
                          :class="currentSectionStatus.class"
                        >
                          {{ currentSectionStatus.label }}
                        </span>
                      </div>
                      <span
                        class="flex shrink-0 items-baseline gap-1 tabular-nums"
                      >
                        <span class="sr-only">
                          Section {{ currentStep }} of {{ SECTIONS.length }}
                        </span>
                        <span
                          aria-hidden="true"
                          class="text-primary text-[32px] leading-none font-extrabold"
                        >
                          {{ String(currentStep).padStart(2, "0") }}
                        </span>
                        <span
                          aria-hidden="true"
                          class="text-muted text-sm font-semibold"
                        >
                          / {{ String(SECTIONS.length).padStart(2, "0") }}
                        </span>
                      </span>
                    </div>
                  </div>
                  <p class="ink-2 text-muted mt-2 mb-8 text-base">
                    {{ currentSection.description }}
                  </p>

                  <div class="ink-3">
                    <!-- Section: Question type -->
                    <div
                      v-if="currentSectionId === 'type'"
                      class="flex flex-wrap gap-3"
                    >
                      <label
                        class="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-[15px] transition-all"
                        :class="
                          (question.type || 'yes-no') === 'yes-no'
                            ? 'border-primary ring-primary bg-primary/10 text-primary font-bold ring-1 ring-inset'
                            : 'border-accented text-muted hover:border-primary/50 font-semibold'
                        "
                      >
                        <input
                          type="radio"
                          name="questionType"
                          value="yes-no"
                          :checked="(question.type || 'yes-no') === 'yes-no'"
                          class="sr-only"
                          @change="$emit('update:type', 'yes-no')"
                        />
                        <Icon
                          v-if="(question.type || 'yes-no') === 'yes-no'"
                          name="lucide:check"
                          class="h-4 w-4"
                        />
                        Yes / No
                      </label>
                      <label
                        class="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-[15px] transition-all"
                        :class="
                          question.type === 'checklist'
                            ? 'border-primary ring-primary bg-primary/10 text-primary font-bold ring-1 ring-inset'
                            : 'border-accented text-muted hover:border-primary/50 font-semibold'
                        "
                      >
                        <input
                          type="radio"
                          name="questionType"
                          value="checklist"
                          :checked="question.type === 'checklist'"
                          class="sr-only"
                          @change="$emit('update:type', 'checklist')"
                        />
                        <Icon
                          v-if="question.type === 'checklist'"
                          name="lucide:check"
                          class="h-4 w-4"
                        />
                        Checklist (at least {{ MIN_CHECKLIST_ITEMS }} items)
                      </label>
                    </div>

                    <!-- Section: Question -->
                    <div v-if="currentSectionId === 'question'">
                      <TemplateStudioRichTextEditor
                        :model-value="question.text || ''"
                        :limit="CHAR_LIMITS.questionText"
                        :show-lists="false"
                        :show-italic="false"
                        placeholder="What question should they answer?"
                        @update:model-value="$emit('update:text', $event)"
                      />
                    </div>

                    <!-- Section: Why this matters -->
                    <div v-if="currentSectionId === 'importance'">
                      <TemplateStudioRichTextEditor
                        :model-value="question.importance || ''"
                        :limit="CHAR_LIMITS.importance"
                        :show-lists="true"
                        placeholder="Describe why this question is important..."
                        @update:model-value="$emit('update:importance', $event)"
                      />
                    </div>

                    <!-- Section: Leading practices (checklist question) -->
                    <div
                      v-if="currentSectionId === 'checklist-items'"
                      class="space-y-4"
                    >
                      <div ref="checklistItemsListRef" class="space-y-2">
                        <div
                          v-for="item in question.checklistItems || []"
                          :key="item.id"
                          class="group/item border-default bg-elevated flex items-start gap-2.5 rounded-md border px-3 py-3 transition-colors"
                        >
                          <span :class="ROW_FIRST_LINE">
                            <Icon
                              name="lucide:grip-vertical"
                              class="checklist-item-drag-handle text-dimmed h-3.5 w-3.5 shrink-0 cursor-grab"
                            />
                          </span>
                          <span :class="ROW_FIRST_LINE">
                            <span
                              class="bg-primary h-1.5 w-1.5 shrink-0 rounded-full"
                            />
                          </span>
                          <textarea
                            v-auto-grow
                            :value="item.text"
                            rows="1"
                            class="text-default placeholder:text-dimmed min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-base leading-relaxed focus:outline-none dark:text-slate-300"
                            placeholder="Add a leading practice..."
                            @input="
                              growToContent(
                                $event.target as HTMLTextAreaElement
                              );
                              $emit(
                                'update-checklist-item',
                                item.id,
                                ($event.target as HTMLTextAreaElement).value
                              );
                            "
                            @keydown.enter.prevent="
                              handleAddChecklistItemOnEnter
                            "
                          />
                          <span :class="ROW_FIRST_LINE">
                            <button
                              type="button"
                              class="delete-checklist-item-btn shrink-0 rounded p-1 text-red-400 opacity-0 transition-all group-focus-within/item:opacity-100 group-hover/item:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                              title="Delete practice"
                              aria-label="Delete practice"
                              @click="$emit('delete-checklist-item', item.id)"
                            >
                              <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        class="text-primary hover:text-primary/80 flex items-center gap-1.5 px-1 py-2 text-[15px] font-semibold transition-colors"
                        @click="handleAddChecklistItemOnEnter"
                      >
                        <Icon name="lucide:plus" class="h-3.5 w-3.5" />
                        Add practice
                      </button>

                      <div
                        v-if="validChecklistItemCount < MIN_CHECKLIST_ITEMS"
                        class="text-warning flex items-center gap-1.5 text-[13px]"
                      >
                        <Icon name="lucide:alert-circle" class="h-3.5 w-3.5" />
                        <span
                          >Required: at least {{ MIN_CHECKLIST_ITEMS }} leading
                          practices</span
                        >
                      </div>
                    </div>

                    <!-- Section: Leading practices -->
                    <div
                      v-if="currentSectionId === 'practices'"
                      class="space-y-4"
                    >
                      <div ref="practicesListRef" class="space-y-2">
                        <div
                          v-for="practice in question.leadingPractices"
                          :key="practice.id"
                          class="group/item border-default bg-elevated flex items-center gap-2.5 rounded-md border px-3 py-3 transition-colors"
                        >
                          <Icon
                            name="lucide:grip-vertical"
                            class="practice-drag-handle text-dimmed h-3.5 w-3.5 shrink-0 cursor-grab"
                          />
                          <span
                            class="bg-primary h-1.5 w-1.5 shrink-0 rounded-full"
                          />
                          <textarea
                            v-auto-grow
                            :value="practice.text"
                            rows="1"
                            class="text-default placeholder:text-dimmed min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-base leading-relaxed focus:outline-none dark:text-slate-300"
                            placeholder="Add a leading practice..."
                            @input="
                              growToContent(
                                $event.target as HTMLTextAreaElement
                              );
                              $emit(
                                'update-practice',
                                practice.id,
                                ($event.target as HTMLTextAreaElement).value
                              );
                            "
                            @keydown.enter.prevent="$emit('add-practice', '')"
                          />
                          <button
                            type="button"
                            class="delete-practice-btn shrink-0 rounded p-1 text-red-400 opacity-0 transition-all group-focus-within/item:opacity-100 group-hover/item:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                            title="Delete practice"
                            aria-label="Delete practice"
                            @click="$emit('delete-practice', practice.id)"
                          >
                            <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        class="text-primary hover:text-primary/80 flex items-center gap-1.5 px-1 py-2 text-[15px] font-semibold transition-colors"
                        @click="$emit('add-practice', '')"
                      >
                        <Icon name="lucide:plus" class="h-3.5 w-3.5" />
                        Add practice
                      </button>
                    </div>

                    <!-- Section: Resources -->
                    <div
                      v-if="currentSectionId === 'resources'"
                      class="space-y-4"
                    >
                      <div ref="linksListRef" class="space-y-2">
                        <div
                          v-for="(link, idx) in question.helpfulLinks"
                          :key="link.id ?? idx"
                          class="group/item border-default bg-elevated flex items-center gap-2.5 rounded-md border px-3 py-3 transition-colors"
                        >
                          <template v-if="editingLinkIndex === idx">
                            <div class="flex flex-1 flex-col gap-1.5">
                              <input
                                v-model="editingLinkTitle"
                                type="text"
                                class="focus:border-primary border-default bg-muted w-full rounded-[7px] border px-2 py-1 text-base leading-relaxed focus:outline-none dark:border-slate-600 dark:bg-slate-700"
                                placeholder="Link title"
                                @keydown.enter="saveEditLink(idx)"
                                @keydown.escape.stop="cancelEditLink"
                              />
                              <input
                                v-model="editingLinkUrl"
                                type="url"
                                class="focus:border-primary border-default bg-muted w-full rounded-[7px] border px-2 py-1 text-base leading-relaxed focus:outline-none dark:border-slate-600 dark:bg-slate-700"
                                placeholder="https://..."
                                @keydown.enter="saveEditLink(idx)"
                                @keydown.escape.stop="cancelEditLink"
                              />
                            </div>
                            <button
                              type="button"
                              class="shrink-0 rounded p-1 text-green-500 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30"
                              title="Save"
                              @click="saveEditLink(idx)"
                            >
                              <Icon name="lucide:check" class="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              class="text-dimmed hover:bg-muted hover:text-default shrink-0 rounded p-1 dark:hover:bg-slate-600"
                              title="Cancel"
                              @click="cancelEditLink"
                            >
                              <Icon name="lucide:x" class="h-3.5 w-3.5" />
                            </button>
                          </template>
                          <template v-else>
                            <span
                              class="link-drag-handle text-dimmed shrink-0 cursor-grab"
                            >
                              <Icon
                                name="lucide:grip-vertical"
                                class="h-3.5 w-3.5"
                              />
                            </span>
                            <a
                              :href="link.url"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-primary hover:text-primary/80 decoration-primary/35 hover:decoration-primary flex min-w-0 flex-1 items-center gap-2 text-base leading-relaxed font-medium underline underline-offset-4"
                              @click.stop
                            >
                              <Icon
                                name="lucide:external-link"
                                class="h-3.5 w-3.5 shrink-0 opacity-60"
                              />
                              <span class="break-words whitespace-normal">{{
                                link.title
                              }}</span>
                            </a>
                            <button
                              type="button"
                              class="text-dimmed hover:bg-muted hover:text-default shrink-0 rounded p-1 opacity-0 transition-all group-focus-within/item:opacity-100 group-hover/item:opacity-100 focus-visible:opacity-100 dark:hover:bg-slate-600"
                              title="Edit resource"
                              aria-label="Edit resource"
                              @click="startEditLink(idx, link.title, link.url)"
                            >
                              <Icon name="lucide:pencil" class="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              class="shrink-0 rounded p-1 text-red-400 opacity-0 transition-all group-focus-within/item:opacity-100 group-hover/item:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                              title="Delete resource"
                              aria-label="Delete resource"
                              @click="$emit('delete-link', idx)"
                            >
                              <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                            </button>
                          </template>
                        </div>
                      </div>

                      <div
                        v-if="isAddingLink"
                        class="border-primary/20 bg-primary/5 space-y-2 rounded-lg border p-3"
                      >
                        <input
                          ref="newLinkTitleRef"
                          v-model="newLinkTitle"
                          type="text"
                          class="focus:border-primary border-default bg-muted w-full rounded-[7px] border px-3 py-2 text-base leading-relaxed focus:outline-none dark:border-slate-600 dark:bg-slate-700"
                          placeholder="Link title"
                          @keydown.enter="addLinkAndNext"
                          @keydown.escape.stop="cancelAddLink"
                        />
                        <input
                          ref="newLinkUrlRef"
                          v-model="newLinkUrl"
                          type="url"
                          class="focus:border-primary border-default bg-muted w-full rounded-[7px] border px-3 py-2 text-base leading-relaxed focus:outline-none dark:border-slate-600 dark:bg-slate-700"
                          placeholder="https://..."
                          @keydown.enter="addLink"
                          @keydown.escape.stop="cancelAddLink"
                        />
                        <div class="flex justify-end gap-2">
                          <button
                            type="button"
                            class="text-muted hover:text-default rounded px-3 py-1.5 text-sm"
                            @click="cancelAddLink"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            class="bg-primary hover:bg-primary/90 rounded px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                            :disabled="!newLinkTitle || !newLinkUrl"
                            @click="addLink"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      <button
                        v-else
                        type="button"
                        class="text-primary hover:text-primary/80 flex items-center gap-1.5 px-1 py-2 text-[15px] font-semibold transition-colors"
                        @click="startAddLink"
                      >
                        <Icon name="lucide:plus" class="h-3.5 w-3.5" />
                        Add resource
                      </button>
                    </div>

                    <div
                      v-if="currentSectionId === 'follow-up-placement'"
                      class="space-y-4"
                    >
                      <template v-if="question.type === 'checklist'">
                        <div
                          class="flex flex-wrap items-center justify-between gap-3"
                        >
                          <span class="text-muted text-sm tabular-nums">
                            {{ question.checklistItems?.length ?? 0 }}
                            practice{{
                              (question.checklistItems?.length ?? 0) === 1
                                ? ""
                                : "s"
                            }}
                          </span>
                          <TemplateStudioMaturityQuestionPanel
                            :question="question"
                            mode="bulk"
                          />
                        </div>
                        <div data-testid="guided-placement-table">
                          <div
                            class="border-default text-muted hidden grid-cols-[minmax(0,1fr)_15rem] gap-4 border-b px-1 py-2 text-sm font-semibold lg:grid"
                          >
                            <span>Practice</span>
                            <span class="text-right">Follow-up placement</span>
                          </div>
                          <div
                            v-for="(
                              item, itemIndex
                            ) in question.checklistItems ?? []"
                            :key="item.id"
                            data-testid="guided-placement-row"
                            class="border-muted grid min-w-0 grid-cols-1 items-center gap-2 border-b px-1 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-4 dark:border-slate-700/30"
                          >
                            <span
                              class="text-default min-w-0 text-base break-words"
                            >
                              {{ item.text || `Practice ${itemIndex + 1}` }}
                            </span>
                            <span
                              class="min-w-0 justify-self-stretch lg:justify-self-end"
                            >
                              <TemplateStudioMaturityQuestionPanel
                                :question="question"
                                mode="practice"
                                :practice-id="item.id"
                                :practice-text="item.text"
                                :practice-index="itemIndex + 1"
                              />
                            </span>
                          </div>
                        </div>
                      </template>
                      <template v-else>
                        <p class="text-default text-sm font-semibold">
                          Follow-up placement for this question
                        </p>
                        <TemplateStudioMaturityQuestionPanel
                          :question="question"
                        />
                      </template>
                    </div>
                  </div>
                </div>
              </Transition>

              <!-- Footer navigation row -->
              <div
                class="border-default mt-auto flex items-center justify-between border-t pt-6 dark:border-slate-700"
              >
                <!-- Left slot stays mounted (possibly empty) so the
                     Done/Next cluster keeps its right edge on section 1.
                     Delete lives in the header's More-actions menu — a
                     destructive action doesn't time-share a nav position. -->
                <div>
                  <UButton
                    v-if="currentStep > 1"
                    data-testid="guided-nav-previous"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-chevron-left"
                    @click="previousSection"
                  >
                    Previous
                  </UButton>
                </div>

                <div class="flex items-center gap-3">
                  <div
                    v-if="hasValidationErrors"
                    class="text-error flex items-center gap-1.5 text-[13px]"
                  >
                    <Icon name="lucide:alert-circle" class="h-3.5 w-3.5" />
                    <span
                      >{{ validationErrors.length }} validation error{{
                        validationErrors.length > 1 ? "s" : ""
                      }}</span
                    >
                  </div>

                  <UButton
                    v-if="isLastSection"
                    data-testid="guided-room-footer-done"
                    variant="solid"
                    color="primary"
                    @click="requestClose"
                  >
                    Done
                  </UButton>
                  <UButton
                    v-else
                    data-testid="guided-nav-next"
                    variant="solid"
                    color="primary"
                    trailing-icon="i-lucide-chevron-right"
                    :disabled="!isCurrentStepValid"
                    @click="nextSection"
                  >
                    Next
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { Directive } from "vue";
import type { TemplateQuestion } from "~/models";
import {
  CHAR_LIMITS,
  MIN_CHECKLIST_ITEMS,
} from "~/services/template/TemplateValidation";
import { SEVERITY_WEIGHTS } from "~/services/maturity/definition";
import {
  saveStatus,
  lastSavedAt,
  isDirty,
  templateAggregate,
} from "~/composables/templates/studio/useTemplateStudio-state";
import Sortable, { type SortableEvent } from "sortablejs";
import { useDraftingRoomHandoff } from "~/composables/templates/useDraftingRoomHandoff";

// Read shared save state directly because each question mounts its own room.

const props = defineProps<{
  open: boolean;
  question: TemplateQuestion;
  questionSlug: string;
  hasPreviousQuestion: boolean;
  hasNextQuestion: boolean;
  previewOpen?: boolean;
  requestedSectionId?: string;
}>();

const emit = defineEmits<{
  close: [];
  delete: [];
  preview: [];
  "navigate-question": [direction: 1 | -1];
  "update:type": [value: "yes-no" | "checklist"];
  "update:text": [value: string];
  "update:importance": [value: string];
  "add-practice": [text: string];
  "update-practice": [id: string, text: string];
  "delete-practice": [id: string];
  "add-checklist-item": [text: string];
  "update-checklist-item": [id: string, text: string];
  "delete-checklist-item": [id: string];
  "reorder-checklist-items": [fromIndex: number, toIndex: number];
  "add-link": [title: string, url: string];
  "update-link": [index: number, title: string, url: string];
  "delete-link": [index: number];
  "reorder-links": [fromIndex: number, toIndex: number];
  "reorder-practices": [fromIndex: number, toIndex: number];
}>();

const roomMenuItems = [
  {
    label: "Delete question",
    icon: "i-lucide-trash-2",
    color: "error" as const,
    onSelect: () => emit("delete"),
  },
];

const SEVERITY_LABEL = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
} as const;

const severityLabel = computed(() => SEVERITY_LABEL[props.question.riskLevel]);
const scoreWeight = computed(() => SEVERITY_WEIGHTS[props.question.riskLevel]);
const savedLabel = computed(() =>
  templateAggregate.value ? "Saved locally" : "Saved"
);

/**
 * A checklist practice textarea auto-grows with its content (see
 * `growToContent` below), so its box can be one, two, or three lines tall.
 * Its row companions — drag handle, status dot, delete button — should stay
 * pinned to the FIRST line of text rather than drift to the vertical middle
 * of that box. Each companion is wrapped in a span of exactly this height
 * (the textarea's own `text-base leading-relaxed` line box: 1rem * 1.625)
 * and vertically centers its content inside it, so the wrapper's center
 * lands on line one's center regardless of how many lines follow. Paired
 * with `items-start` on the row so the flex box doesn't stretch these
 * wrappers to the row's full height.
 */
const ROW_FIRST_LINE = "inline-flex h-[1.625rem] items-center justify-center";

/**
 * Grows a textarea to fit its content, no inner scrollbar. Reset to "auto"
 * first so a shrink (deleting a line) is picked up too, not just growth.
 * Applied both from the `v-auto-grow` directive below (mount, so seeded
 * multi-line content renders full-height on first paint, and every
 * re-render after) and inline from the `@input` handler (so a keystroke
 * resizes the box immediately, without waiting on the prop round-trip).
 */
function growToContent(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

const vAutoGrow: Directive<HTMLTextAreaElement> = {
  mounted: growToContent,
  updated: growToContent,
};

type Section = {
  id: string;
  label: string;
  required?: boolean;
  recommended?: boolean;
  setting?: boolean;
  description: string;
};

const ALL_SECTIONS: Section[] = [
  {
    id: "type",
    label: "Question type",
    required: true,
    description: "Choose one answer, or one check per practice.",
  },
  {
    id: "question",
    label: "Question",
    required: true,
    description: "Write one direct question.",
  },
  {
    id: "checklist-items",
    label: "Leading practices",
    required: true,
    description: "List the practices reviewers check one by one.",
  },
  {
    id: "importance",
    label: "Why this matters",
    recommended: true,
    description: "Add context reviewers need before answering.",
  },
  {
    id: "practices",
    label: "Leading practices",
    description: "List examples reviewers can consult before answering.",
  },
  {
    id: "resources",
    label: "Resources",
    description: "Link to evidence that helps reviewers answer.",
  },
  {
    id: "follow-up-placement",
    label: "Follow-up placement",
    setting: true,
    description:
      "Choose the stage whose definition best fits this item. Placement is not priority or timing.",
  },
];

const SECTIONS = computed<Section[]>(() => {
  const questionType = props.question.type || "yes-no";
  if (questionType === "checklist") {
    return ALL_SECTIONS.filter((s) => s.id !== "practices");
  }
  return ALL_SECTIONS.filter((s) => s.id !== "checklist-items");
});

const roomRootRef = ref<HTMLElement | null>(null);
const railRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLElement | null>(null);
const sectionContentRef = ref<HTMLElement | null>(null);
const sectionHeadingRef = ref<HTMLHeadingElement | null>(null);

const DEFAULT_SECTION_ID = "type";
const currentSectionId = ref(DEFAULT_SECTION_ID);
const pendingRequestedSectionId = ref(props.requestedSectionId);
const practicesListRef = ref<HTMLElement | null>(null);
const checklistItemsListRef = ref<HTMLElement | null>(null);
const linksListRef = ref<HTMLElement | null>(null);
const practicesSortable = ref<Sortable | null>(null);
const checklistSortable = ref<Sortable | null>(null);
const linksSortable = ref<Sortable | null>(null);
const newLinkTitleRef = ref<HTMLInputElement | null>(null);
const newLinkUrlRef = ref<HTMLInputElement | null>(null);

const isAddingLink = ref(false);
const newLinkTitle = ref("");
const newLinkUrl = ref("");
const editingLinkIndex = ref<number | null>(null);
const editingLinkTitle = ref("");
const editingLinkUrl = ref("");

const currentSectionIndex = computed(() => {
  const index = SECTIONS.value.findIndex(
    (section) => section.id === currentSectionId.value
  );
  return index >= 0 ? index : 0;
});
const currentStep = computed(() => currentSectionIndex.value + 1);
const currentSection = computed(
  () => SECTIONS.value[currentSectionIndex.value]!
);
const sectionHeadingId = computed(
  () => `guided-section-${props.question.id}-${currentSectionId.value}`
);
const currentSectionStatus = computed(() => {
  if (currentSection.value.required) {
    return { class: "bg-primary/10 text-primary", label: "Required" };
  }
  if (currentSection.value.recommended) {
    return { class: "bg-warning/10 text-warning", label: "Recommended" };
  }
  if (currentSection.value.setting) {
    return { class: "bg-muted text-muted", label: "Setting" };
  }
  return { class: "bg-muted text-muted", label: "Optional" };
});
const isLastSection = computed(
  () => currentStep.value === SECTIONS.value.length
);

const validChecklistItemCount = computed(() => {
  return (props.question.checklistItems || []).filter((item) =>
    item.text?.trim()
  ).length;
});

const hasRichTextContent = (html?: string): boolean =>
  !!html && html.replace(/<[^>]*>/g, "").trim().length > 0;

/** Whether a section already has meaningful content — drives the rail's filled/hollow waypoints. */
const sectionHasContent = (section: Section): boolean => {
  switch (section.id) {
    case "type":
      return true;
    case "question":
      return !!props.question.text?.trim();
    case "checklist-items":
      return validChecklistItemCount.value > 0;
    case "importance":
      return hasRichTextContent(props.question.importance);
    case "practices":
      return props.question.leadingPractices.some((p) => p.text?.trim());
    case "resources":
      return (props.question.helpfulLinks ?? []).length > 0;
    case "follow-up-placement":
      return true;
    default:
      return false;
  }
};

const sectionIsComplete = (section: Section): boolean => {
  switch (section.id) {
    case "type":
      return true;
    case "question": {
      const text = props.question.text?.trim() ?? "";
      return text.length > 0 && text.length <= CHAR_LIMITS.questionText;
    }
    case "checklist-items":
      return (
        validChecklistItemCount.value >= MIN_CHECKLIST_ITEMS &&
        (props.question.checklistItems ?? []).every(
          (item) =>
            item.text.trim().length > 0 &&
            item.text.length <= CHAR_LIMITS.practice
        )
      );
    case "importance":
      return (
        hasRichTextContent(props.question.importance) &&
        (props.question.importance?.length ?? 0) <= CHAR_LIMITS.importance
      );
    case "practices":
      return (
        props.question.leadingPractices.length > 0 &&
        props.question.leadingPractices.every(
          (practice) =>
            practice.text.trim().length > 0 &&
            practice.text.length <= CHAR_LIMITS.practice
        )
      );
    case "resources":
      return (props.question.helpfulLinks ?? []).length > 0;
    case "follow-up-placement":
      return true;
    default:
      return false;
  }
};

// ---------------------------------------------------------------------------
// Entrance ceremony — see DESIGN.md's Guided Drafting Room section.
//
// `ceremonyMode` is decided once, the instant the room opens, from the
// drafting-room hand-off flag: a recent cross-question chevron hand-off
// plays the abbreviated variant, anything else (first open, reopening the
// same question) plays the full one. It self-clears on a timer — by then
// every entrance animation it gates has already reached its held end state,
// so clearing is a no-op visually, it just stops a later `currentSectionId`
// change from re-arming the "current waypoint" halo (see `is-current`
// below).
//
// `hasNavigatedSinceOpen` is the second, independent gate: it flips true the
// moment the reader actually drives navigation (rail click / Previous /
// Next) and stays true for the rest of this open session. The keyed section
// div's `ink-armed` class reads it directly, which is what actually keeps
// the ink-in reveal from replaying on ordinary section switches — the
// ceremonyMode timer alone can't guarantee that, since a fast switch could
// land inside its window.
// ---------------------------------------------------------------------------

const HANDOFF_WINDOW_MS = 600;
const CEREMONY_FULL_SETTLE_MS = 1300;
const CEREMONY_HANDOFF_SETTLE_MS = 650;

const { lastHandoffAt } = useDraftingRoomHandoff();

const ceremonyMode = ref<"full" | "handoff" | null>(null);
const hasNavigatedSinceOpen = ref(false);
let ceremonySettleTimeout: ReturnType<typeof setTimeout> | undefined;

const armCeremony = () => {
  if (ceremonySettleTimeout) clearTimeout(ceremonySettleTimeout);
  const handoffAt = lastHandoffAt.value;
  const isHandoff =
    handoffAt !== null && Date.now() - handoffAt < HANDOFF_WINDOW_MS;
  ceremonyMode.value = isHandoff ? "handoff" : "full";
  hasNavigatedSinceOpen.value = false;
  ceremonySettleTimeout = setTimeout(
    () => {
      ceremonyMode.value = null;
    },
    isHandoff ? CEREMONY_HANDOFF_SETTLE_MS : CEREMONY_FULL_SETTLE_MS
  );
};

// ---------------------------------------------------------------------------
// Section-earns-green reward — a one-shot pop + halo pulse the instant a
// section's content flips from empty to non-empty while the room is open.
// The snapshot is captured fresh every time the room opens (see the `open`
// watcher) so edits made elsewhere (e.g. Compact mode, before this room was
// opened) never read as "just now" once Guided catches up to them.
// ---------------------------------------------------------------------------

const JUST_FILLED_DURATION_MS = 800;

const justFilledSectionIds = ref<Set<string>>(new Set());
let sectionContentSnapshot: Record<string, boolean> = {};
const justFilledTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const clearJustFilledTimeout = (sectionId: string) => {
  const existing = justFilledTimeouts.get(sectionId);
  if (existing) {
    clearTimeout(existing);
    justFilledTimeouts.delete(sectionId);
  }
};

const markJustFilled = (sectionId: string) => {
  justFilledSectionIds.value = new Set(justFilledSectionIds.value).add(
    sectionId
  );
  clearJustFilledTimeout(sectionId);
  justFilledTimeouts.set(
    sectionId,
    setTimeout(() => {
      const next = new Set(justFilledSectionIds.value);
      next.delete(sectionId);
      justFilledSectionIds.value = next;
      justFilledTimeouts.delete(sectionId);
    }, JUST_FILLED_DURATION_MS)
  );
};

const resetSectionContentSnapshot = () => {
  sectionContentSnapshot = Object.fromEntries(
    SECTIONS.value.map((section) => [section.id, sectionIsComplete(section)])
  );
  for (const timeout of justFilledTimeouts.values()) clearTimeout(timeout);
  justFilledTimeouts.clear();
  justFilledSectionIds.value = new Set();
};

const checkForNewlyFilledSections = () => {
  for (const section of SECTIONS.value) {
    const isComplete = sectionIsComplete(section);
    if (!sectionContentSnapshot[section.id] && isComplete) {
      markJustFilled(section.id);
    }
    sectionContentSnapshot[section.id] = isComplete;
  }
};

// Only meaningful while the room is open — the fields that could change
// `sectionHasContent()` are only rendered/editable then. Guarded anyway:
// the snapshot above is only trustworthy once `open` has reset it.
watch(
  () => [
    props.question.type,
    props.question.text,
    props.question.importance,
    props.question.checklistItems,
    props.question.leadingPractices,
    props.question.helpfulLinks,
  ],
  () => {
    if (!props.open) return;
    checkForNewlyFilledSections();
  },
  { deep: true }
);

type WaypointState = "current" | "complete" | "started" | "empty";

const waypointState = (section: Section): WaypointState => {
  if (section.id === currentSectionId.value) return "current";
  if (sectionIsComplete(section)) return "complete";
  return sectionHasContent(section) ? "started" : "empty";
};

const waypointLabelClass = (section: Section): string => {
  if (section.id === currentSectionId.value) {
    return "text-primary font-bold";
  }
  if (section.setting) return "text-default";
  if (!section.required) return "text-muted";
  return "text-default";
};

const allValidationErrors = computed(() => {
  const errors: string[] = [];
  const textLength = props.question.text?.length ?? 0;
  const importanceLength = props.question.importance?.length ?? 0;

  if (textLength > CHAR_LIMITS.questionText) {
    errors.push(
      `Question text exceeds ${CHAR_LIMITS.questionText} characters (${textLength})`
    );
  }
  if (importanceLength > CHAR_LIMITS.importance) {
    errors.push(
      `Importance exceeds ${CHAR_LIMITS.importance} characters (${importanceLength})`
    );
  }

  for (const practice of props.question.leadingPractices) {
    const practiceLength = practice.text?.length ?? 0;
    if (practiceLength > CHAR_LIMITS.practice) {
      errors.push(
        `Practice exceeds ${CHAR_LIMITS.practice} characters (${practiceLength})`
      );
    }
  }

  const questionType = props.question.type || "yes-no";
  if (questionType === "checklist") {
    const itemCount = validChecklistItemCount.value;
    if (itemCount < MIN_CHECKLIST_ITEMS) {
      errors.push(
        `Checklist requires at least ${MIN_CHECKLIST_ITEMS} leading practices (currently ${itemCount})`
      );
    }
    for (const item of props.question.checklistItems || []) {
      const itemLength = item.text?.length ?? 0;
      if (itemLength > CHAR_LIMITS.checklistItem) {
        errors.push(
          `Leading practice exceeds ${CHAR_LIMITS.checklistItem} characters (${itemLength})`
        );
      }
    }
  }

  return errors;
});

const getStepIndexForSection = (sectionId: string): number => {
  return SECTIONS.value.findIndex((s) => s.id === sectionId);
};

const collectTextErrors = (sectionIndex: number): string[] => {
  const stepIndex = getStepIndexForSection("question");
  if (sectionIndex < stepIndex) return [];
  const len = props.question.text?.length ?? 0;
  return len > CHAR_LIMITS.questionText
    ? [`Question text exceeds ${CHAR_LIMITS.questionText} characters (${len})`]
    : [];
};

const collectImportanceErrors = (sectionIndex: number): string[] => {
  const stepIndex = getStepIndexForSection("importance");
  if (stepIndex === -1 || sectionIndex < stepIndex) return [];
  const len = props.question.importance?.length ?? 0;
  return len > CHAR_LIMITS.importance
    ? [`Importance exceeds ${CHAR_LIMITS.importance} characters (${len})`]
    : [];
};

const collectPracticeErrors = (sectionIndex: number): string[] => {
  const stepIndex = getStepIndexForSection("practices");
  if (stepIndex === -1 || sectionIndex < stepIndex) return [];
  return props.question.leadingPractices.flatMap((practice) => {
    const len = practice.text?.length ?? 0;
    return len > CHAR_LIMITS.practice
      ? [`Practice exceeds ${CHAR_LIMITS.practice} characters (${len})`]
      : [];
  });
};

const collectChecklistErrors = (sectionIndex: number): string[] => {
  const stepIndex = getStepIndexForSection("checklist-items");
  if (stepIndex === -1 || sectionIndex <= stepIndex) return [];
  if ((props.question.type ?? "yes-no") !== "checklist") return [];
  const errors: string[] = [];
  const itemCount = validChecklistItemCount.value;
  if (itemCount < MIN_CHECKLIST_ITEMS) {
    const needed = MIN_CHECKLIST_ITEMS - itemCount;
    errors.push(
      `Add at least ${needed} more item${needed > 1 ? "s" : ""} to continue`
    );
  }
  for (const item of props.question.checklistItems || []) {
    const len = item.text?.length ?? 0;
    if (len > CHAR_LIMITS.checklistItem) {
      errors.push(
        `Leading practice exceeds ${CHAR_LIMITS.checklistItem} characters (${len})`
      );
    }
  }
  return errors;
};

const validationErrors = computed(() => {
  if (!currentSectionId.value) return [];
  const sectionIndex = currentSectionIndex.value;
  return [
    ...collectTextErrors(sectionIndex),
    ...collectImportanceErrors(sectionIndex),
    ...collectPracticeErrors(sectionIndex),
    ...collectChecklistErrors(sectionIndex),
  ];
});

const hasValidationErrors = computed(() => validationErrors.value.length > 0);
const hasAnyErrors = computed(() => allValidationErrors.value.length > 0);

const isCurrentStepValid = computed(() => {
  if (currentSectionId.value === "checklist-items") {
    const questionType = props.question.type || "yes-no";
    if (questionType === "checklist") {
      return validChecklistItemCount.value >= MIN_CHECKLIST_ITEMS;
    }
  }
  return true;
});

const focusSectionAfterEnter = ref(false);

const waypointAt = (index: number) =>
  railRef.value?.querySelector<HTMLButtonElement>(
    `[data-waypoint-index="${index}"]`
  ) ?? null;

const revealWaypoint = (index: number) => {
  nextTick(() => {
    waypointAt(index)?.scrollIntoView?.({
      block: "nearest",
      inline: "center",
    });
  });
};

const focusPendingSectionHeading = () => {
  const heading = sectionHeadingRef.value;
  if (
    !focusSectionAfterEnter.value ||
    !heading ||
    heading.id !== sectionHeadingId.value
  ) {
    return;
  }
  focusSectionAfterEnter.value = false;
  heading.focus();
};

const moveToSection = (index: number, focusSection = false) => {
  const section = SECTIONS.value[index];
  if (!section) return;
  if (section.id !== currentSectionId.value) {
    hasNavigatedSinceOpen.value = true;
    focusSectionAfterEnter.value = focusSection;
  }
  currentSectionId.value = section.id;
  revealWaypoint(index);
};

const nextSection = () => {
  moveToSection(currentSectionIndex.value + 1, true);
};

const previousSection = () => {
  moveToSection(currentSectionIndex.value - 1, true);
};

const goToSection = (index: number) => {
  moveToSection(index);
};

const handleWaypointKeydown = (event: KeyboardEvent) => {
  const direction =
    event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
  if (direction === 0) return;

  const waypoint = event.currentTarget as HTMLButtonElement;
  const focusedIndex = Number(waypoint.dataset.waypointIndex);
  if (!Number.isInteger(focusedIndex)) return;
  const targetIndex = Math.min(
    Math.max(focusedIndex + direction, 0),
    SECTIONS.value.length - 1
  );
  event.preventDefault();
  moveToSection(targetIndex);
  nextTick(() => waypointAt(targetIndex)?.focus());
};

watch(currentSectionId, () => nextTick(focusPendingSectionHeading), {
  flush: "post",
});

const requestClose = () => {
  emit("close");
};

watch(
  () => props.question.type,
  () => {
    if (
      !SECTIONS.value.some((section) => section.id === currentSectionId.value)
    ) {
      currentSectionId.value = DEFAULT_SECTION_ID;
    }
    revealWaypoint(currentSectionIndex.value);
  }
);

watch(
  () => props.requestedSectionId,
  (sectionId) => {
    pendingRequestedSectionId.value = sectionId;
  }
);

// ---------------------------------------------------------------------------
// Open lifecycle. Normal sessions start at the product default. A requested
// section is consumed once, so it cannot override later navigation or reopens.
// ---------------------------------------------------------------------------

const focusFirstField = () => {
  const container = sectionContentRef.value;
  if (!container) return;
  const focusable = container.querySelector<HTMLElement>(
    'input, textarea, [contenteditable="true"], button:not([disabled])'
  );
  focusable?.focus();
};

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      destroySortables();
      return;
    }
    const requestedSectionId = pendingRequestedSectionId.value;
    pendingRequestedSectionId.value = undefined;
    const requestedIndex = requestedSectionId
      ? SECTIONS.value.findIndex((section) => section.id === requestedSectionId)
      : -1;
    const openingIndex = requestedIndex >= 0 ? requestedIndex : 0;
    currentSectionId.value =
      SECTIONS.value[openingIndex]?.id ?? DEFAULT_SECTION_ID;
    revealWaypoint(openingIndex);
    focusSectionAfterEnter.value = false;
    armCeremony();
    resetSectionContentSnapshot();
    isAddingLink.value = false;
    editingLinkIndex.value = null;
    nextTick(() => {
      initSortableForCurrentSection();
      focusFirstField();
    });
  }
);

// ---------------------------------------------------------------------------
// Keyboard: Escape closes from anywhere in the document and Tab stays trapped
// inside the room. A portalled menu gets the first Escape press.
// ---------------------------------------------------------------------------

const getFocusableElements = (): HTMLElement[] => {
  if (!roomRootRef.value) return [];
  return Array.from(
    roomRootRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    )
  ).filter((el) => el.offsetParent !== null);
};

const hasOpenPortalledLayer = () => {
  const room = roomRootRef.value;
  if (!room) return false;
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-dismissable-layer]")
  ).some((layer) => !room.contains(layer));
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.open || props.previewOpen || event.defaultPrevented) return;
  if (hasOpenPortalledLayer()) return;

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    requestClose();
    return;
  }

  if (event.key === "Tab") {
    const focusable = getFocusableElements();
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
};

// ---------------------------------------------------------------------------
// Resources (helpful links) — add / edit form state.
// ---------------------------------------------------------------------------

const startAddLink = () => {
  isAddingLink.value = true;
  nextTick(() => {
    newLinkTitleRef.value?.focus();
  });
};

const cancelAddLink = () => {
  isAddingLink.value = false;
  newLinkTitle.value = "";
  newLinkUrl.value = "";
};

const addLinkAndNext = () => {
  if (newLinkTitle.value.trim()) {
    nextTick(() => {
      newLinkUrlRef.value?.focus();
    });
  }
};

const addLink = () => {
  if (newLinkTitle.value.trim() && newLinkUrl.value.trim()) {
    emit("add-link", newLinkTitle.value.trim(), newLinkUrl.value.trim());
    newLinkTitle.value = "";
    newLinkUrl.value = "";
    isAddingLink.value = false;
  }
};

const startEditLink = (index: number, title: string, url: string) => {
  editingLinkIndex.value = index;
  editingLinkTitle.value = title;
  editingLinkUrl.value = url;
};

const cancelEditLink = () => {
  editingLinkIndex.value = null;
  editingLinkTitle.value = "";
  editingLinkUrl.value = "";
};

const saveEditLink = (index: number) => {
  if (editingLinkTitle.value.trim() && editingLinkUrl.value.trim()) {
    emit(
      "update-link",
      index,
      editingLinkTitle.value.trim(),
      editingLinkUrl.value.trim()
    );
    cancelEditLink();
  }
};

const handleAddChecklistItemOnEnter = () => {
  emit("add-checklist-item", "");
  nextTick(() => {
    if (checklistItemsListRef.value) {
      const inputs = checklistItemsListRef.value.querySelectorAll("textarea");
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) {
        lastInput.focus();
      }
    }
  });
};

// ---------------------------------------------------------------------------
// Drag-to-reorder — (re)created after the section-fade transition inserts
// the new section's DOM, torn down right before it's removed.
// ---------------------------------------------------------------------------

const destroySortables = () => {
  practicesSortable.value?.destroy();
  practicesSortable.value = null;
  checklistSortable.value?.destroy();
  checklistSortable.value = null;
  linksSortable.value?.destroy();
  linksSortable.value = null;
};

const initSortableForCurrentSection = () => {
  if (currentSectionId.value === "practices" && practicesListRef.value) {
    practicesSortable.value = Sortable.create(practicesListRef.value, {
      animation: 200,
      handle: ".practice-drag-handle",
      ghostClass: "sortable-ghost",
      onEnd: (evt: SortableEvent) => {
        if (
          evt.oldIndex !== undefined &&
          evt.newIndex !== undefined &&
          evt.oldIndex !== evt.newIndex
        ) {
          emit("reorder-practices", evt.oldIndex, evt.newIndex);
        }
      },
    });
  }
  if (
    currentSectionId.value === "checklist-items" &&
    checklistItemsListRef.value
  ) {
    checklistSortable.value = Sortable.create(checklistItemsListRef.value, {
      animation: 200,
      handle: ".checklist-item-drag-handle",
      ghostClass: "sortable-ghost",
      onEnd: (evt: SortableEvent) => {
        if (
          evt.oldIndex !== undefined &&
          evt.newIndex !== undefined &&
          evt.oldIndex !== evt.newIndex
        ) {
          emit("reorder-checklist-items", evt.oldIndex, evt.newIndex);
        }
      },
    });
  }
  if (currentSectionId.value === "resources" && linksListRef.value) {
    linksSortable.value = Sortable.create(linksListRef.value, {
      animation: 200,
      handle: ".link-drag-handle",
      ghostClass: "sortable-ghost",
      onEnd: (evt: SortableEvent) => {
        if (
          evt.oldIndex !== undefined &&
          evt.newIndex !== undefined &&
          evt.oldIndex !== evt.newIndex
        ) {
          emit("reorder-links", evt.oldIndex, evt.newIndex);
        }
      },
    });
  }
};

const handleSectionEntered = () => {
  initSortableForCurrentSection();
  nextTick(focusPendingSectionHeading);
};

const handleViewportResize = () => revealWaypoint(currentSectionIndex.value);

onMounted(() => {
  window.addEventListener("keydown", handleKeydown, true);
  window.addEventListener("resize", handleViewportResize);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown, true);
  window.removeEventListener("resize", handleViewportResize);
  destroySortables();
  if (ceremonySettleTimeout) clearTimeout(ceremonySettleTimeout);
  for (const timeout of justFilledTimeouts.values()) clearTimeout(timeout);
  justFilledTimeouts.clear();
});
</script>

<style scoped>
.sortable-ghost {
  opacity: 0.5;
  background-color: var(--ui-bg-muted);
}

.dark .sortable-ghost {
  background-color: rgba(30, 41, 59, 0.5);
}

/* Room entry — fast fade + scale, per DESIGN.md motion recipes. Leave is
   the ceremony's "paper filed" settle: a quick downward drift, distinct
   from — and slower-feeling than — the crisp entrance. */
.room-fade-scale-enter-active {
  transition:
    opacity 200ms ease-out,
    transform 250ms cubic-bezier(0.22, 1, 0.36, 1);
}
.room-fade-scale-leave-active {
  transition:
    opacity 200ms ease-in,
    transform 200ms ease-in;
}
.room-fade-scale-enter-from {
  opacity: 0;
  transform: scale(0.985);
}
.room-fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.99) translateY(5px);
}

/* Section switch — quiet crossfade of the canvas content only. */
.section-fade-enter-active,
.section-fade-leave-active {
  transition: opacity 150ms ease;
}
.section-fade-enter-from,
.section-fade-leave-to {
  opacity: 0;
}

/* ---------------------------------------------------------------------
 * Cutting-mat table — a quiet dot grid under the sheet, the room's own
 * signature surface (chart-paper is the plate's, this is the room's).
 * Barely-there at arm's length; the sheet's own background paints over it.
 * --------------------------------------------------------------------- */
.drafting-table {
  background-image: radial-gradient(circle, #e4e7eb 1px, transparent 1px);
  background-size: 24px 24px;
}
.dark .drafting-table {
  background-image: radial-gradient(
    circle,
    rgba(51, 65, 85, 0.5) 1px,
    transparent 1px
  );
}

/* ---------------------------------------------------------------------
 * Registration marks — hairline L-marks in the sheet's corners, the
 * drafted touch you only notice when you lean in. Purely decorative.
 * --------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------
 * Drafting Room Ceremony — the one-time entrance choreography, plus the
 * standing rail-hover and section-earns-green reward that stay live after
 * it settles. See DESIGN.md.
 * ------------------------------------------------------------------- */

/* Full entrance — paper laid down, waypoints placed, current waypoint pulsed,
   section inked in. Gated on `.ceremony-full`, set once when the room
   opens (see `armCeremony()`); it self-clears on a timer once every
   animation below has reached its held end state. */
.ceremony-full .sheet {
  animation: sheet-in 420ms cubic-bezier(0.22, 1, 0.36, 1) 80ms both;
}
.ceremony-full .route-waypoint {
  animation: wp-in 300ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.ceremony-full li:nth-child(2) .route-waypoint {
  animation-delay: 140ms;
}
.ceremony-full li:nth-child(3) .route-waypoint {
  animation-delay: 210ms;
}
.ceremony-full li:nth-child(4) .route-waypoint {
  animation-delay: 280ms;
}
.ceremony-full li:nth-child(5) .route-waypoint {
  animation-delay: 350ms;
}
.ceremony-full li:nth-child(6) .route-waypoint {
  animation-delay: 420ms;
}
.ceremony-full li:nth-child(7) .route-waypoint {
  animation-delay: 490ms;
}
/* "You are here" — one halo pulse on the section the room lands on.
   `:not(.has-navigated)` stops it from re-arming if the reader jumps to a
   different waypoint (and so becomes ".is-current") before the ceremony
   settles. */
.ceremony-full:not(.has-navigated) .is-current .halo {
  animation: halo-pulse 600ms ease-out 640ms both;
}

/* The keyed section content re-mounts on every switch; `.ink-armed` only
   ever lands on the very first one shown after opening (see
   `hasNavigatedSinceOpen`), so ink-in never replays on ordinary
   navigation — the 150ms section-fade crossfade is the only motion there. */
.ceremony-full .ink-armed .ink-1 {
  animation: ink-in 700ms cubic-bezier(0.22, 1, 0.36, 1) 200ms both;
}
.ceremony-full .ink-armed .ink-2 {
  animation: ink-in 700ms cubic-bezier(0.22, 1, 0.36, 1) 270ms both;
}
.ceremony-full .ink-armed .ink-3 {
  animation: ink-in 700ms cubic-bezier(0.22, 1, 0.36, 1) 340ms both;
}

/* Chevron hand-off — abbreviated: rail, sheet and room chrome hold still,
   only the section's own content inks in, faster. */
.ceremony-handoff .ink-armed .ink-1 {
  animation: ink-in 450ms cubic-bezier(0.22, 1, 0.36, 1) 0ms both;
}
.ceremony-handoff .ink-armed .ink-2 {
  animation: ink-in 450ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both;
}
.ceremony-handoff .ink-armed .ink-3 {
  animation: ink-in 450ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both;
}

@keyframes sheet-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes wp-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes ink-in {
  from {
    opacity: 0;
    transform: translateY(12px);
    filter: blur(5px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}
@keyframes halo-pulse {
  0% {
    opacity: 0.9;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(2.1);
  }
}
@keyframes fill-pop {
  0% {
    transform: scale(0.4);
  }
  55% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
  }
}

/* Standing rail details — live for the whole time the room is open, not
   just during the entrance. */
.dot {
  transition: transform 150ms;
}
.route-waypoint:hover .dot {
  transform: scale(1.15);
}
.halo {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  border: 2px solid rgba(2, 132, 199, 0.45);
  opacity: 0;
  pointer-events: none;
}
.dark .halo {
  border-color: rgba(56, 189, 248, 0.5);
}

/* Section-earns-green reward — a section's waypoint pops + pulses green
   the instant its content goes from empty to non-empty. `!important` lets
   this win over the entrance's own halo pulse above (higher specificity,
   sky) when a reader types into the room's landing section right away —
   the reward should always be the one that shows. */
.just-filled .dot {
  animation: fill-pop 450ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.just-filled .halo {
  border-color: rgba(21, 128, 61, 0.2) !important;
  animation: halo-pulse 650ms ease-out 120ms both !important;
}
.dark .just-filled .halo {
  border-color: rgba(74, 222, 128, 0.25) !important;
}

@media (prefers-reduced-motion: reduce) {
  .room-fade-scale-enter-active,
  .room-fade-scale-leave-active,
  .section-fade-enter-active,
  .section-fade-leave-active {
    transition: none !important;
  }
  .room-fade-scale-enter-from,
  .room-fade-scale-leave-to {
    opacity: 1;
    transform: none;
  }
  .section-fade-enter-from,
  .section-fade-leave-to {
    opacity: 1;
  }

  .ceremony-full .sheet,
  .ceremony-full .route-waypoint,
  .ceremony-full:not(.has-navigated) .is-current .halo,
  .ceremony-full .ink-armed .ink-1,
  .ceremony-full .ink-armed .ink-2,
  .ceremony-full .ink-armed .ink-3,
  .ceremony-handoff .ink-armed .ink-1,
  .ceremony-handoff .ink-armed .ink-2,
  .ceremony-handoff .ink-armed .ink-3,
  .just-filled .dot,
  .just-filled .halo {
    animation: none !important;
    opacity: 1;
    transform: none;
    filter: none;
    clip-path: none;
  }
}
</style>
