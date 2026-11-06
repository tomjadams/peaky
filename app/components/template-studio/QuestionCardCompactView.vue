<template>
  <div data-testid="compact-editor">
    <!-- Both question types read as two bands. The identity band up top is
         two columns of one sheet, not two panels: a single vertical hairline
         divides them and nothing is washed or boxed. The split is semantic,
         not visual balance — Type, Question, and Why this matters are the
         question's own words and sit together on the left; Resources is the
         one section that points off the sheet, so it sits alone on the
         right as a link rail. On wide screens it takes two-fifths of the
         identity band with a 24rem floor. That keeps long resource titles
         readable without giving Question and Why this matters most of the
         sheet. The rail's own padding clears the dividing hairline. Below
         the band, Leading practices takes the card's full width.

         The practices ARE the answer surface for both types: a checklist
         question has the reviewer check them off one by one, a yes/no
         question asks for one call over the whole list. Template authors are
         not practised writers and a practice line runs to two sentences, so
         the rows get the whole sheet in either case, and nothing on the card
         moves when the type flips.

         The two bands are two materials, not two paint jobs: the identity
         band keeps the sheet's white paper, the answer band sits on the well.
         That is what stops the card reading as white-on-white, and it spends
         no hue doing it — severity (on the frame's rule and the collapsed
         rows' leading edge, see QuestionCard.vue) and sky are the only
         colours the card carries.

         Each content section opens with the sheet-header index tick, the
         Guided Drafting Room's grammar at field scale. Type is the one
         exception: it is a control row, not a section of the question's
         content, so its label sits inline with its buttons and carries no
         tick. -->
    <div class="grid xl:grid-cols-[minmax(0,3fr)_minmax(24rem,2fr)]">
      <!-- The question's own words: what it is, what it asks, why it's asked -->
      <div
        class="xl:border-muted flex flex-col gap-7 p-6 xl:border-r xl:dark:border-slate-700/30"
      >
        <!-- Type is a control row, not a prose section: the label sits on the
             same line as the two buttons it labels, and it is the one section
             that carries no index tick — a tick announces a section of the
             question's content, and this announces a setting. Inline, the band
             starts ~40px tighter and Question moves up with it. -->
        <section class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h4 class="text-highlighted text-sm font-semibold">Type</h4>
          <div class="flex flex-wrap gap-2.5">
            <button
              v-for="option in TYPE_OPTIONS"
              :key="option.value"
              type="button"
              :aria-pressed="questionType === option.value"
              :disabled="readonly"
              :title="readonly ? readonlyReason : undefined"
              class="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors"
              :class="
                questionType === option.value
                  ? 'border-sky-600 bg-[#EAF3FA] text-sky-700 dark:border-sky-400 dark:bg-sky-400/10 dark:text-sky-300'
                  : 'border-default bg-default text-muted hover:border-primary/60 hover:text-default'
              "
              @click="$emit('update:type', option.value)"
            >
              <Icon
                v-if="questionType === option.value"
                name="lucide:check"
                class="h-3.5 w-3.5"
              />
              {{ option.label }}
            </button>
          </div>
          <span
            class="text-muted ml-auto text-[13px] font-semibold tabular-nums"
          >
            {{ severityLabel }} · weight {{ scoreWeight }}
          </span>
        </section>

        <section>
          <span
            class="bg-primary-600 dark:bg-primary-400 mb-2 block h-[3px] w-6 rounded-full"
            aria-hidden="true"
          />
          <h4 class="text-highlighted text-sm font-semibold">Question</h4>
          <div class="mt-3">
            <TemplateStudioRichTextEditor
              :model-value="question.text || ''"
              :limit="CHAR_LIMITS.questionText"
              :show-lists="false"
              :show-italic="false"
              :readonly="readonly"
              placeholder="What question should they answer?"
              @update:model-value="$emit('update:text', $event)"
            />
          </div>
        </section>

        <section>
          <span
            class="bg-primary-600 dark:bg-primary-400 mb-2 block h-[3px] w-6 rounded-full"
            aria-hidden="true"
          />
          <h4 class="text-highlighted text-sm font-semibold">
            Why this matters
          </h4>
          <p class="text-dimmed mt-1 text-[13px]">
            Shown when a reviewer opens More info, with the resources beside it.
          </p>
          <div class="mt-3">
            <TemplateStudioRichTextEditor
              :model-value="question.importance || ''"
              :limit="CHAR_LIMITS.importance"
              :show-lists="true"
              :readonly="readonly"
              placeholder="Help reviewers understand why this question is important..."
              @update:model-value="$emit('update:importance', $event)"
            />
          </div>
        </section>
      </div>

      <!-- Resources — the one section that points off the sheet, so it sits
           alone as a dedicated rail of links. Left padding runs past the
           other bands' p-6 so the rail's own content clears the hairline
           with room to spare, rather than crowding the divider. -->
      <div class="flex flex-col gap-7 py-6 pr-6 pl-8">
        <section>
          <span
            class="bg-primary-600 dark:bg-primary-400 mb-2 block h-[3px] w-6 rounded-full"
            aria-hidden="true"
          />
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-highlighted text-sm font-semibold">Resources</h4>
            <span class="text-muted text-[13px] tabular-nums">
              {{ question.helpfulLinks.length }} link{{
                question.helpfulLinks.length === 1 ? "" : "s"
              }}
            </span>
          </div>

          <div ref="linksListRef" class="mt-3">
            <div
              v-for="(link, idx) in question.helpfulLinks"
              :key="link.id ?? idx"
              class="group/item border-muted flex items-center gap-2.5 border-b py-2.5 first:border-t dark:border-slate-700/40"
            >
              <!-- Edit mode -->
              <template v-if="editingLinkIndex === idx && !readonly">
                <div class="flex flex-1 flex-col gap-1.5">
                  <input
                    v-model="editingLinkTitle"
                    type="text"
                    class="focus:border-primary border-default bg-default w-full rounded-[7px] border px-2 py-1 text-base focus:outline-none dark:border-slate-600"
                    placeholder="Link title"
                    @keydown.enter="saveEditLink(idx)"
                    @keydown.escape="cancelEditLink"
                  />
                  <input
                    v-model="editingLinkUrl"
                    type="url"
                    class="focus:border-primary border-default bg-default w-full rounded-[7px] border px-2 py-1 text-base focus:outline-none dark:border-slate-600"
                    placeholder="https://..."
                    @keydown.enter="saveEditLink(idx)"
                    @keydown.escape="cancelEditLink"
                  />
                </div>
                <button
                  type="button"
                  class="text-success shrink-0 rounded p-1"
                  title="Save"
                  @click="saveEditLink(idx)"
                >
                  <Icon name="lucide:check" class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="text-dimmed hover:text-default shrink-0 rounded p-1"
                  title="Cancel"
                  @click="cancelEditLink"
                >
                  <Icon name="lucide:x" class="h-3.5 w-3.5" />
                </button>
              </template>
              <!-- View mode -->
              <template v-else>
                <span
                  v-if="!readonly"
                  class="link-drag-handle text-dimmed shrink-0 cursor-grab"
                >
                  <Icon name="lucide:grip-vertical" class="h-3.5 w-3.5" />
                </span>
                <a
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:text-primary/80 decoration-primary/35 hover:decoration-primary flex min-w-0 flex-1 items-center gap-2 text-base font-medium underline underline-offset-4"
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
                  v-if="!readonly"
                  type="button"
                  class="text-dimmed hover:text-default shrink-0 rounded p-1 opacity-0 transition-colors group-hover/item:opacity-100"
                  title="Edit resource"
                  @click="startEditLink(idx, link.title, link.url)"
                >
                  <Icon name="lucide:pencil" class="h-3.5 w-3.5" />
                </button>
                <button
                  v-if="!readonly"
                  type="button"
                  class="text-dimmed hover:text-error shrink-0 rounded p-1 opacity-0 transition-colors group-hover/item:opacity-100"
                  title="Delete resource"
                  @click="$emit('delete-link', idx)"
                >
                  <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                </button>
              </template>
            </div>
          </div>

          <!-- Add Link Form -->
          <div
            v-if="isAddingLink && !readonly"
            class="border-default mt-3 space-y-2 rounded-lg border border-dashed p-3"
          >
            <input
              ref="newLinkTitleRef"
              v-model="newLinkTitle"
              type="text"
              class="focus:border-primary border-default bg-default w-full rounded-[7px] border px-3 py-2 text-base focus:outline-none dark:border-slate-600"
              placeholder="Link title"
              @keydown.enter="addLinkAndNext"
              @keydown.escape="cancelAddLink"
            />
            <input
              ref="newLinkUrlRef"
              v-model="newLinkUrl"
              type="url"
              class="focus:border-primary border-default bg-default w-full rounded-[7px] border px-3 py-2 text-base focus:outline-none dark:border-slate-600"
              placeholder="https://..."
              @keydown.enter="addLink"
              @keydown.escape="cancelAddLink"
            />
            <div class="flex justify-end gap-2">
              <UButton
                size="sm"
                color="neutral"
                variant="ghost"
                @click="cancelAddLink"
              >
                Cancel
              </UButton>
              <UButton
                size="sm"
                color="primary"
                :disabled="!newLinkTitle || !newLinkUrl"
                @click="addLink"
              >
                Add
              </UButton>
            </div>
          </div>

          <button
            v-else
            type="button"
            :disabled="readonly"
            :title="readonly ? readonlyReason : undefined"
            class="text-primary hover:text-primary/80 mt-1 flex items-center gap-1.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            @click="startAddLink"
          >
            <Icon name="lucide:plus" class="h-3.5 w-3.5" />
            Add resource
          </button>
        </section>
      </div>
    </div>

    <!-- The answer band alone lies on the cutting mat. Painting the mat on
         this wrapper rather than on the section inside it is still the whole
         reason the wrapper exists — the dot grid must not restart at the
         Leading practices/Maturity stage seam — but the footer rail no
         longer shares it: Delete question and Done act on the whole
         question, not on the practices list, so they read wrong scoped to
         the mat that answers it. -->
    <div :class="ANSWER_MAT">
      <!-- Leading practices — the answer surface, at the card's full width
           for both question types. On a checklist question each row also
           carries the reserved stage slot at the end of the line it belongs
           to.

           The band sits on the mat rather than the sheet's white paper. Every
           row in it is a textarea, which is exactly what the well under the
           dots is for, and the material change does the work a second hue
           would have done: the identity band above reads as the paper the
           question is written on, and this reads as the working table it is
           filled in on. A hairline separates the two — full-width rules stay
           inside tables. -->
      <div class="flex flex-col gap-7 px-6 pt-5 pb-6" :class="WELL_BAND">
        <section data-testid="compact-leading-practices">
          <span
            class="bg-primary-600 dark:bg-primary-400 mb-2 block h-[3px] w-6 rounded-full"
            aria-hidden="true"
          />
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h4 class="text-highlighted text-sm font-semibold">
              Leading practices
            </h4>
            <!-- pr-8 clears the row's delete gutter, so the count and the bulk
                 slot line up with the stage column rather than with the hover
                 control past it. -->
            <div class="flex flex-wrap items-center justify-end gap-2 sm:pr-8">
              <span class="text-muted text-[13px] tabular-nums">
                {{ practiceCount }} practice{{ practiceCount === 1 ? "" : "s" }}
              </span>
              <TemplateStudioMaturityQuestionPanel
                v-if="questionType === 'checklist'"
                :question="question"
                mode="bulk"
                :readonly="readonly"
              />
            </div>
          </div>
          <p class="text-muted mt-1 text-[13px]">
            {{
              questionType === "checklist"
                ? "Reviewers check these off one by one."
                : "Shown as guidance when a reviewer opens More info, alongside Why this matters."
            }}
          </p>
          <p
            v-if="questionType === 'checklist'"
            class="text-muted mt-1 text-[13px]"
          >
            Choose the stage whose definition best fits this item. Placement is
            not priority or timing.
          </p>

          <!-- Table voice: 1px header rule, hairlines between rows. -->
          <div
            class="border-default text-muted mt-3 grid items-center gap-x-3 border-b pb-1.5 text-[13px] font-semibold"
            :class="rowGrid"
          >
            <span />
            <span>Practice</span>
            <span
              v-if="questionType === 'checklist'"
              class="hidden justify-self-end lg:block"
            >
              Follow-up placement
            </span>
            <span
              :class="questionType === 'checklist' ? 'hidden lg:block' : ''"
            />
          </div>

          <!-- Checklist question: the reviewer ticks each practice, so each row
               will carry its own stage. `items-start` on the row (rather than
               items-center) keeps a two- or three-line practice from dragging
               the handle, stage slot, and delete button down toward its own
               vertical middle — each companion instead centers on
               ROW_FIRST_LINE, the height of the textarea's own first line. -->
          <div v-if="questionType === 'checklist'" ref="checklistItemsListRef">
            <div
              v-for="(item, itemIndex) in question.checklistItems || []"
              :key="item.id"
              data-testid="compact-practice-row"
              class="group/item border-muted grid min-h-11 items-start gap-x-3 gap-y-1 border-b px-1 py-1.5 last:border-b-0 dark:border-slate-700/30"
              :class="rowGrid"
            >
              <span :class="ROW_FIRST_LINE">
                <span
                  v-if="!readonly"
                  class="checklist-item-drag-handle text-dimmed flex size-11 cursor-grab items-center justify-center"
                  title="Drag practice to reorder"
                >
                  <Icon name="lucide:grip-vertical" class="h-3.5 w-3.5" />
                </span>
              </span>
              <textarea
                v-auto-grow
                :value="item.text"
                :readonly="readonly"
                rows="1"
                class="text-default placeholder:text-dimmed focus-visible:ring-primary min-h-11 min-w-0 resize-none overflow-hidden rounded-sm bg-transparent py-2 text-base leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-inset dark:text-slate-300"
                placeholder="Add a leading practice..."
                @input="
                  growToContent($event.target as HTMLTextAreaElement);
                  $emit(
                    'update-checklist-item',
                    item.id,
                    ($event.target as HTMLTextAreaElement).value
                  );
                "
                @keydown.enter.prevent="handleAddChecklistItemOnEnter"
              />
              <span
                class="col-start-2 row-start-2 flex min-h-11 min-w-0 items-center justify-self-start lg:col-start-3 lg:row-start-1 lg:justify-self-end"
              >
                <TemplateStudioMaturityQuestionPanel
                  :question="question"
                  mode="practice"
                  :practice-id="item.id"
                  :practice-text="item.text"
                  :practice-index="itemIndex + 1"
                  :readonly="readonly"
                />
              </span>
              <span
                class="col-start-3 row-start-1 lg:col-start-4"
                :class="ROW_FIRST_LINE"
              >
                <button
                  v-if="!readonly"
                  type="button"
                  class="delete-checklist-item-btn text-dimmed hover:text-error focus-visible:ring-error flex size-11 items-center justify-center rounded-md opacity-0 transition-colors group-focus-within/item:opacity-100 group-hover/item:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                  title="Delete practice"
                  aria-label="Delete practice"
                  @click="$emit('delete-checklist-item', item.id)"
                >
                  <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          </div>

          <!-- Yes/no question: one call over the whole list, so the stage is
               asked once, in the Maturity stage block below. Same items-start +
               ROW_FIRST_LINE treatment as the checklist rows above, minus the
               stage slot this row type doesn't carry. -->
          <div v-else ref="practicesListRef">
            <div
              v-for="practice in question.leadingPractices"
              :key="practice.id"
              data-testid="compact-practice-row"
              class="group/item border-muted grid min-h-11 items-start gap-x-3 gap-y-1 border-b px-1 py-1.5 last:border-b-0 dark:border-slate-700/30"
              :class="rowGrid"
            >
              <span :class="ROW_FIRST_LINE">
                <span
                  v-if="!readonly"
                  class="practice-drag-handle text-dimmed flex size-11 cursor-grab items-center justify-center"
                  title="Drag practice to reorder"
                >
                  <Icon name="lucide:grip-vertical" class="h-3.5 w-3.5" />
                </span>
              </span>
              <textarea
                v-auto-grow
                :value="practice.text"
                :readonly="readonly"
                rows="1"
                class="text-default placeholder:text-dimmed focus-visible:ring-primary min-h-11 min-w-0 resize-none overflow-hidden rounded-sm bg-transparent py-2 text-base leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-inset dark:text-slate-300"
                placeholder="Add a leading practice..."
                @input="
                  growToContent($event.target as HTMLTextAreaElement);
                  $emit(
                    'update-practice',
                    practice.id,
                    ($event.target as HTMLTextAreaElement).value
                  );
                "
                @keydown.enter.prevent="handleAddPracticeOnEnter"
              />
              <span :class="ROW_FIRST_LINE">
                <button
                  v-if="!readonly"
                  type="button"
                  class="delete-practice-btn text-dimmed hover:text-error focus-visible:ring-error flex size-11 items-center justify-center rounded-md opacity-0 transition-colors group-focus-within/item:opacity-100 group-hover/item:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                  title="Delete practice"
                  aria-label="Delete practice"
                  @click="$emit('delete-practice', practice.id)"
                >
                  <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          </div>

          <button
            type="button"
            :disabled="readonly"
            :title="readonly ? readonlyReason : undefined"
            class="text-primary hover:text-primary/80 mt-1 flex items-center gap-1.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            @click="
              questionType === 'checklist'
                ? handleAddChecklistItemOnEnter()
                : handleAddPracticeOnEnter()
            "
          >
            <Icon name="lucide:plus" class="h-3.5 w-3.5" />
            Add practice
          </button>

          <div
            v-if="
              !readonly &&
              questionType === 'checklist' &&
              validChecklistItemCount < MIN_CHECKLIST_ITEMS
            "
            class="text-warning mt-2 flex items-center gap-1.5 text-[13px] font-medium"
          >
            <Icon name="lucide:alert-circle" class="h-3.5 w-3.5" />
            <span>
              Required: at least {{ MIN_CHECKLIST_ITEMS }} leading practices
            </span>
          </div>
        </section>

        <!-- Yes/no: one call over the list maps to one practice at one stage, so
             placement is asked once after the practices it represents. -->
        <section v-if="questionType !== 'checklist'">
          <span
            class="bg-primary-600 dark:bg-primary-400 mb-2 block h-[3px] w-6 rounded-full"
            aria-hidden="true"
          />
          <h4 class="text-highlighted text-sm font-semibold">
            Follow-up placement
          </h4>
          <p class="text-muted mt-1 max-w-2xl text-[13px]">
            Choose the stage whose definition best fits this item. Placement is
            not priority or timing.
          </p>
          <div class="mt-3">
            <TemplateStudioMaturityQuestionPanel
              :question="question"
              :readonly="readonly"
            />
          </div>
        </section>
      </div>
    </div>

    <!-- Footer rail — the card's own paper again, not the mat: Delete
         question and Done act on the whole question, not on the practices
         list the mat belongs to, so the footer differentiates from the
         answer band above rather than sharing its material. A hairline top
         edge is the only seam, the same grammar the mat itself opens with;
         no background class here at all, same as the identity band up top —
         both simply inherit the card's own white paper. -->
    <div
      class="border-muted flex items-center justify-between border-t px-6 py-3 dark:border-slate-700/30"
    >
      <button
        v-if="!readonly"
        type="button"
        class="text-dimmed hover:text-error -ml-2 flex items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors"
        @click="$emit('delete')"
      >
        <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
        Delete question
      </button>
      <div class="flex items-center gap-3">
        <div
          v-if="!readonly && hasValidationErrors"
          class="text-error flex items-center gap-1.5 text-[13px]"
        >
          <Icon name="lucide:alert-circle" class="h-3.5 w-3.5" />
          <span>
            {{ validationErrors.length }} error{{
              validationErrors.length === 1 ? "" : "s"
            }}
          </span>
        </div>
        <UButton
          size="sm"
          :color="!readonly && hasValidationErrors ? 'error' : 'primary'"
          :disabled="!readonly && hasValidationErrors"
          @click="$emit('collapse')"
        >
          {{
            !readonly && hasValidationErrors ? "Fix errors to continue" : "Done"
          }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Directive } from "vue";
import type { TemplateQuestion } from "~/models";
import {
  CHAR_LIMITS,
  MIN_CHECKLIST_ITEMS,
} from "~/services/template/TemplateValidation";
import { SEVERITY_WEIGHTS } from "~/services/maturity/definition";
import Sortable, { type SortableEvent } from "sortablejs";

const props = withDefaults(
  defineProps<{
    question: TemplateQuestion;
    readonly?: boolean;
    readonlyReason?: string;
  }>(),
  {
    readonly: false,
    readonlyReason: "You do not have permission to edit this template.",
  }
);

const emit = defineEmits<{
  collapse: [];
  delete: [];
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

/**
 * Row tracks. The placement track is wider than its select, which opens the
 * gutter between a wrapped practice line and the control. Yes/no rows carry no
 * placement track: one call over the whole list is placed once below the table.
 */
const CHECKLIST_ROW_GRID =
  "grid-cols-[0.875rem_minmax(0,1fr)_1.25rem] lg:grid-cols-[0.875rem_minmax(0,1fr)_15rem_1.25rem]";
const PRACTICE_ROW_GRID = "grid-cols-[0.875rem_minmax(0,1fr)_1.25rem]";

/**
 * A practice textarea auto-grows with its content (see `growToContent`
 * below), so its box can be one, two, or three lines tall. Its row companions
 * — drag handle, stage slot, delete button — should stay pinned to the FIRST
 * line of text rather than drift to the vertical middle of that box. Each
 * companion is wrapped in a span of exactly this height (the textarea's own
 * `text-base leading-relaxed` line box: 1rem * 1.625) and vertically centers
 * its content inside it, so the wrapper's center lands on line one's center
 * regardless of how many lines follow. Paired with `items-start` on the row
 * grid so the grid doesn't stretch these wrappers to the row's full height.
 */
const ROW_FIRST_LINE = "inline-flex h-[1.625rem] items-center justify-center";

/**
 * Grows a textarea to fit its content, no inner scrollbar. Reset to "auto"
 * first so a shrink (deleting a line) is picked up too, not just growth.
 * Applied both from the `v-auto-grow` directive below (mount, so seeded
 * multi-line content renders full-height on first paint, and every
 * re-render after) and inline from the `@input` handlers (so a keystroke
 * resizes the box immediately, without waiting on the prop round-trip).
 */
function growToContent(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

const autoGrowObservers = new WeakMap<HTMLTextAreaElement, ResizeObserver>();

const vAutoGrow: Directive<HTMLTextAreaElement> = {
  mounted(el) {
    growToContent(el);
    if (typeof ResizeObserver === "undefined") return;
    let width = el.getBoundingClientRect().width;
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = entry?.contentRect.width ?? width;
      if (Math.abs(nextWidth - width) < 0.5) return;
      width = nextWidth;
      growToContent(el);
    });
    observer.observe(el);
    autoGrowObservers.set(el, observer);
  },
  updated: growToContent,
  unmounted(el) {
    autoGrowObservers.get(el)?.disconnect();
    autoGrowObservers.delete(el);
  },
};

const TYPE_OPTIONS = [
  { value: "yes-no" as const, label: "Yes / no" },
  { value: "checklist" as const, label: "Checklist" },
];

const SEVERITY_LABEL = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
} as const;

const questionType = computed(() => props.question.type || "yes-no");
const severityLabel = computed(() => SEVERITY_LABEL[props.question.riskLevel]);
const scoreWeight = computed(() => SEVERITY_WEIGHTS[props.question.riskLevel]);

/**
 * The card's lower material: the studio's own cutting mat, at card scale. The
 * well is the app's one tinted surface for inputs and quiet zones, and this
 * half of the card is a table of textareas, so it earns the tint — but flat
 * well alone reads as a panel switched off, which is the opposite of what the
 * leading practices are. The page's dot grid over it (`.answer-mat` below —
 * the `.studio-table` recipe verbatim, same inks, same 1px dot on a 24px
 * grid) says the thing the studio already says everywhere else: the identity
 * band above is the paper the question is written on, and this is the mat
 * that paper lies on, where it gets filled in. No new pattern and no hue —
 * severity and sky stay the only colours the card spends.
 *
 * The mat is painted on the wrapper around the answer band's own section
 * (Leading practices and, on a yes/no question, the reserved Maturity stage
 * block) rather than inside it, so the grid keeps one rhythm through the
 * hairline between the two instead of restarting at that seam. The footer
 * rail sits outside this wrapper entirely: Delete question and Done act on
 * the whole question, not on the practices list, so they read wrong scoped
 * to the mat that answers it — the footer returns to the card's own paper
 * below its own hairline instead (see the template, just past this div).
 */
const ANSWER_MAT = "answer-mat bg-[#F4F5F7] dark:bg-slate-800/40";

/**
 * The hairline that opens the answer band against the identity band above.
 * It carries no background of its own: the mat behind it is the single
 * surface, which is what keeps the card reading as two materials (paper,
 * then mat) rather than three.
 */
const WELL_BAND = "border-muted border-t dark:border-slate-700/30";

const rowGrid = computed(() =>
  questionType.value === "checklist" ? CHECKLIST_ROW_GRID : PRACTICE_ROW_GRID
);

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

// Count only non-empty checklist items for validation
const validChecklistItemCount = computed(() => {
  return (props.question.checklistItems || []).filter((item) =>
    item.text?.trim()
  ).length;
});

/**
 * One count for one section. Both question types call the list "Leading
 * practices"; a checklist question stores it in `checklistItems`, a yes/no
 * question in `leadingPractices` — the split is storage, not vocabulary.
 */
const practiceCount = computed(() =>
  questionType.value === "checklist"
    ? validChecklistItemCount.value
    : props.question.leadingPractices.length
);

const validationErrors = computed(() => {
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
        `Leading practice exceeds ${CHAR_LIMITS.practice} characters (${practiceLength})`
      );
    }
  }

  if (questionType.value === "checklist") {
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

const hasValidationErrors = computed(() => validationErrors.value.length > 0);

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

/** Focus the row that was just appended to `list`. Rows are textareas. */
const focusLastRow = (list: HTMLElement | null) => {
  nextTick(() => {
    const fields = list?.querySelectorAll("textarea") ?? [];
    fields[fields.length - 1]?.focus();
  });
};

const handleAddChecklistItemOnEnter = () => {
  if (props.readonly) return;
  emit("add-checklist-item", "");
  focusLastRow(checklistItemsListRef.value);
};

// Practice rows wrap, so they are textareas like checklist rows. Enter has to
// add the next practice rather than open a second line inside this one.
const handleAddPracticeOnEnter = () => {
  if (props.readonly) return;
  emit("add-practice", "");
  focusLastRow(practicesListRef.value);
};

const destroySortables = () => {
  practicesSortable.value?.destroy();
  practicesSortable.value = null;
  checklistSortable.value?.destroy();
  checklistSortable.value = null;
  linksSortable.value?.destroy();
  linksSortable.value = null;
};

const initializeSortables = () => {
  if (practicesListRef.value) {
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
  if (checklistItemsListRef.value) {
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
  if (linksListRef.value) {
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

watch(
  [questionType, () => props.readonly],
  async () => {
    destroySortables();
    if (props.readonly) return;
    await nextTick();
    initializeSortables();
  },
  { immediate: true, flush: "post" }
);

onUnmounted(destroySortables);
</script>

<style scoped>
/* The answer band and the footer rail lie on the studio's cutting mat — the
   same recipe as the drafting table this card sits on (`.studio-table` in
   pages/templates/[id]/edit), unchanged in ink, opacity and 24px scale. The
   well underneath comes from ANSWER_MAT; the dots are what make it read as
   material under paper rather than as a disabled panel. */
.answer-mat {
  background-image: radial-gradient(circle, #e4e7eb 1px, transparent 1px);
  background-size: 24px 24px;
}
.dark .answer-mat {
  background-image: radial-gradient(
    circle,
    rgba(51, 65, 85, 0.5) 1px,
    transparent 1px
  );
}

.sortable-ghost {
  opacity: 0.5;
  background-color: var(--ui-bg-muted);
}

.dark .sortable-ghost {
  background-color: rgba(30, 41, 59, 0.5);
}
</style>
