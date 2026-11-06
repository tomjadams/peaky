<script setup lang="ts">
import type { PlanItem } from "~/models/improvement-plan";
import { assessmentDeepLink } from "~/services/review/ImprovementPlanProjection";
import { useMoreInfoPanel } from "~/ui/useMoreInfoPanel";
import { SEVERITY_DISPLAY } from "~/constants/planDisplay";
import {
  canLearnWhy,
  itemKey,
  sectionDescription,
  severityAccentClass,
  useCollapsibleSections,
  usePlanItemSections,
} from "~/composables/review/usePlanItemSections";

interface Props {
  items: PlanItem[];
}

const props = defineProps<Props>();

const STATE_DISPLAY: Record<
  string,
  {
    label: string;
    icon: string;
    color: "error" | "warning" | "neutral" | "primary";
    tooltip: string;
  }
> = {
  "follow-up": {
    label: "Follow-up",
    icon: "lucide:alert-circle",
    color: "error",
    tooltip: "Answered No — plan to address before readiness sign-off",
  },
  "checklist-gap": {
    label: "Checklist gap",
    icon: "lucide:list-checks",
    color: "warning",
    tooltip:
      "One or more leading practices in this question were not confirmed",
  },
  "not-assessed": {
    label: "Not assessed",
    icon: "lucide:circle-dashed",
    color: "neutral",
    tooltip: "This question hasn't been answered yet",
  },
  "documented-exception": {
    label: "Exception",
    icon: "lucide:info",
    color: "primary",
    tooltip: "A documented exception has been recorded for this question",
  },
};

const { openMoreInfoPanel } = useMoreInfoPanel();

const severitySections = usePlanItemSections(toRef(props, "items"));
const { isExpanded, toggleSection } = useCollapsibleSections(severitySections);

const openLearnWhy = (item: PlanItem) => {
  openMoreInfoPanel({
    title: item.questionText,
    whyImportant: item.importance ?? "",
    leadingPractices: item.leadingPractices ?? [],
    helpfulLinks: item.helpfulLinks ?? [],
  });
};
</script>

<template>
  <div
    class="review-plan-issue-list plan-section-card-list space-y-6"
    data-testid="review-plan-issue-list"
  >
    <section
      v-for="section in severitySections"
      :key="section.severity"
      class="plan-section-card border-default bg-default overflow-hidden rounded-lg border"
    >
      <div class="plan-section-card__frame">
        <button
          type="button"
          class="plan-section-card__header bg-elevated/95 border-default/80 hover:bg-elevated flex w-full items-center justify-between gap-3 border-b px-5 py-4 text-left transition-colors"
          :aria-expanded="isExpanded(section.severity)"
          @click="toggleSection(section.severity)"
        >
          <div class="plan-section-card__title-row flex items-start gap-3">
            <span
              aria-hidden="true"
              class="plan-section-card__severity-dot mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              :class="severityAccentClass(section.severity)"
            />
            <div class="plan-section-card__title-copy">
              <h4
                class="plan-section-card__title text-default text-base font-semibold"
              >
                {{ SEVERITY_DISPLAY[section.severity]!.label }}
              </h4>
              <p
                class="plan-section-card__description text-muted mt-0.5 text-[13px]"
              >
                {{ sectionDescription(section.severity) }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <span
              class="plan-section-card__count text-muted bg-elevated rounded-full px-2.5 py-1 text-[13px] font-medium tabular-nums"
            >
              {{ section.items.length }} item{{
                section.items.length === 1 ? "" : "s"
              }}
            </span>
            <Icon
              :name="
                isExpanded(section.severity)
                  ? 'lucide:chevron-up'
                  : 'lucide:chevron-down'
              "
              class="text-muted h-4 w-4 shrink-0"
              aria-hidden="true"
            />
          </div>
        </button>

        <div
          v-show="isExpanded(section.severity)"
          class="plan-section-card__body"
        >
          <article
            v-for="item in section.items"
            :key="itemKey(item)"
            class="plan-section-card__item border-default grid gap-4 border-b px-5 py-4.5 transition-colors last:border-b-0 hover:bg-black/[0.03] lg:grid-cols-[minmax(0,1fr)_14rem_13rem] lg:items-center dark:border-white/10 dark:hover:bg-white/[0.04]"
          >
            <div class="plan-section-card__item-main min-w-0">
              <div
                class="plan-section-card__item-meta flex flex-wrap items-center gap-2"
              >
                <UTooltip
                  v-if="STATE_DISPLAY[item.state]"
                  :text="STATE_DISPLAY[item.state]!.tooltip"
                  :content="{ side: 'right' }"
                >
                  <span class="inline-flex cursor-default">
                    <UBadge
                      :color="STATE_DISPLAY[item.state]?.color"
                      variant="subtle"
                      size="sm"
                      class="text-[13px]"
                    >
                      <Icon
                        :name="STATE_DISPLAY[item.state]!.icon"
                        class="mr-1 h-3 w-3"
                      />
                      {{ STATE_DISPLAY[item.state]?.label }}
                    </UBadge>
                  </span>
                </UTooltip>

                <UTooltip
                  v-if="canLearnWhy(item)"
                  text="Why this question matters"
                  :content="{ side: 'right' }"
                >
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-book-open"
                    class="cursor-pointer"
                    @click="openLearnWhy(item)"
                  />
                </UTooltip>
              </div>

              <p
                class="plan-section-card__question text-default mt-2 line-clamp-2 text-base leading-6"
              >
                <InlineMarkdown :text="item.questionText" />
              </p>

              <p
                v-if="item.state === 'checklist-gap' && item.checklistCounts"
                class="plan-section-card__supporting text-muted mt-1 text-[13px]"
              >
                {{ item.checklistCounts.remaining }} practice{{
                  item.checklistCounts.remaining === 1 ? "" : "s"
                }}
                not confirmed
              </p>
            </div>

            <!-- overflow-hidden pins the source column to its grid track:
                 long content ellipsizes here instead of sliding under the
                 "Open question" control in the next column. -->
            <div class="plan-section-card__source min-w-0 overflow-hidden">
              <div class="flex min-w-0 items-center gap-2">
                <p
                  class="plan-section-card__source-name text-muted min-w-0 truncate text-sm"
                >
                  {{ item.templateName }} · v{{ item.revisionNumber ?? "?" }}
                </p>
                <span
                  v-if="item.questionReference"
                  class="plan-section-card__question-id border-default bg-elevated text-muted inline-block max-w-full min-w-0 truncate rounded-md border px-1.5 py-0.5 font-mono text-[13px] font-medium"
                >
                  {{ item.questionReference }}
                </span>
              </div>
              <p
                class="plan-section-card__source-subtitle text-muted mt-0.5 truncate text-[13px]"
              >
                {{ item.pillarName }}
              </p>
            </div>

            <div
              class="plan-section-card__actions flex flex-wrap items-center gap-2 lg:justify-end"
            >
              <UButton
                :to="assessmentDeepLink(item.identity)"
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                color="primary"
                variant="soft"
                icon="i-lucide-arrow-up-right"
              >
                Open question
              </UButton>
            </div>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
