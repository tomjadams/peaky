<script setup lang="ts">
import type {
  PlanContributor,
  PlanItem,
  PlanRollup,
} from "~/models/improvement-plan";
import { assessmentDeepLink } from "~/services/review/ImprovementPlanProjection";
import { SEVERITY_DISPLAY } from "~/constants/planDisplay";
import {
  canLearnWhy,
  normalizeSeverity,
  sectionDescription,
  severityAccentClass,
  severityOrder,
  useCollapsibleSections,
} from "~/composables/review/usePlanItemSections";
import { useMoreInfoPanel } from "~/ui/useMoreInfoPanel";

interface Props {
  rollups: PlanRollup[];
  contributors: PlanContributor[];
}

const props = defineProps<Props>();

const { openMoreInfoPanel } = useMoreInfoPanel();

const contributorByReviewId = computed(
  () =>
    new Map(
      props.contributors.map((contributor) => [
        contributor.reviewId,
        contributor,
      ])
    )
);

const shortIdentifier = (identifier: string): string =>
  identifier.length > 18
    ? `${identifier.slice(0, 8)}…${identifier.slice(-4)}`
    : identifier;

const reviewPlanRoute = (
  item: PlanItem,
  contributor: PlanContributor | undefined
) => {
  const reviewId = item.identity.reviewId;
  const sourceId = contributor?.sourceId ?? item.identity.subjectId;
  const contributorType =
    contributor?.contributorType ??
    (item.identity.subjectType === "product"
      ? "product-review"
      : item.identity.subjectType);

  if (contributorType === "team") {
    return {
      name: "team-review-plan",
      params: { teamId: sourceId, reviewId },
    };
  }
  if (contributorType === "application") {
    return {
      name: "app-review-plan",
      params: { appId: sourceId, reviewId },
    };
  }
  return {
    name: "product-review-plan",
    params: { productId: sourceId, reviewId },
  };
};

/**
 * Rollups grouped by normalised severity and sorted by frequency. Each repeated
 * item carries one flat source row per Review. The row uses only the maturity
 * entry for the Revision that owns the repeated item.
 */
const rollupSections = computed(() =>
  severityOrder
    .map((severity) => ({
      severity,
      rollups: props.rollups
        .filter((rollup) => normalizeSeverity(rollup.severity) === severity)
        .slice()
        .toSorted((a, b) => b.items.length - a.items.length)
        .map((rollup) => {
          const rollupContributorByReviewId = new Map(
            rollup.contributors.map((contributor) => [
              contributor.reviewId,
              contributor,
            ])
          );
          const sourcesByReviewId = new Map<
            string,
            {
              reviewId: string;
              reviewName: string;
              sourceName: string;
              assessmentTo: ReturnType<typeof assessmentDeepLink>;
              planTo: ReturnType<typeof reviewPlanRoute>;
              maturity: NonNullable<PlanContributor["maturity"]>;
            }
          >();

          for (const item of rollup.items) {
            const reviewId = item.identity.reviewId;
            if (sourcesByReviewId.has(reviewId)) continue;

            const contributor = contributorByReviewId.value.get(reviewId);
            const rollupContributor = rollupContributorByReviewId.get(reviewId);
            sourcesByReviewId.set(reviewId, {
              reviewId,
              reviewName:
                rollupContributor?.reviewName ??
                `Review ${shortIdentifier(reviewId)}`,
              sourceName:
                rollupContributor?.sourceName ??
                `Source ${shortIdentifier(item.identity.subjectId)}`,
              assessmentTo: assessmentDeepLink(item.identity),
              planTo: reviewPlanRoute(item, contributor),
              maturity:
                contributor?.maturity?.filter(
                  (entry) =>
                    entry.templateRevisionId === rollup.templateRevisionId
                ) ?? [],
            });
          }

          return Object.assign({}, rollup, {
            sources: [...sourcesByReviewId.values()],
          });
        }),
    }))
    .filter((section) => section.rollups.length > 0)
);

const { isExpanded, toggleSection } = useCollapsibleSections(
  computed(() => rollupSections.value)
);

/**
 * Stable `v-for` key that incorporates the contributing review IDs.
 * Prevents key collisions when the same question appears across different
 * sets of contributing reviews between renders.
 */
const rollupKey = (rollup: PlanRollup) =>
  [
    rollup.rollupKey,
    rollup.items.map((item) => item.identity.reviewId).join(","),
  ].join("::");

/** Template display name for a rollup, falling back to the raw template ID when no item carries a name. */
const templateName = (rollup: PlanRollup) =>
  `${rollup.items[0]?.templateName ?? rollup.templateId} · v${rollup.revisionNumber ?? "?"}`;

/** First item in the rollup that has learning content (importance / practices / links) for the MoreInfoPanel. */
const explainerItem = (rollup: PlanRollup) => rollup.items.find(canLearnWhy);

const openLearnWhy = (rollup: PlanRollup) => {
  const item = explainerItem(rollup);
  if (!item) return;

  openMoreInfoPanel({
    title: rollup.questionText,
    whyImportant: item.importance ?? "",
    leadingPractices: item.leadingPractices ?? [],
    helpfulLinks: item.helpfulLinks ?? [],
  });
};
</script>

<template>
  <section class="mt-8" data-testid="product-plan-rollups">
    <h3 class="text-default text-lg font-semibold">Repeated follow-ups</h3>
    <p class="text-muted mt-1 mb-5 text-sm">
      These recur across reviews and may be cheaper to solve once.
    </p>

    <div class="product-plan-rollups__list space-y-10">
      <section
        v-for="section in rollupSections"
        :key="section.severity"
        class="product-plan-rollups__section min-w-0"
      >
        <div class="plan-section-card__frame">
          <button
            type="button"
            class="plan-section-card__header border-accented hover:bg-muted flex w-full flex-col items-stretch justify-between gap-3 border-b py-3 text-left transition-colors sm:flex-row sm:items-center"
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
            <div class="flex shrink-0 items-center justify-between gap-3">
              <span
                class="plan-section-card__count text-muted text-[13px] font-medium tabular-nums"
              >
                {{ section.rollups.length }} repeated item{{
                  section.rollups.length === 1 ? "" : "s"
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
            <div
              v-for="rollup in section.rollups"
              :key="rollupKey(rollup)"
              class="plan-section-card__item grid gap-4 border-b border-[#EEF3F8] py-5 transition-colors last:border-b-0 hover:bg-black/[0.03] lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:items-start dark:border-white/10 dark:hover:bg-white/[0.04]"
            >
              <div class="plan-section-card__item-main min-w-0">
                <div
                  v-if="explainerItem(rollup)"
                  class="plan-section-card__item-meta mb-1"
                >
                  <UTooltip
                    text="Why this question matters"
                    :content="{ side: 'right' }"
                  >
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      icon="i-lucide-book-open"
                      aria-label="Why this question matters"
                      class="cursor-pointer"
                      @click="openLearnWhy(rollup)"
                    />
                  </UTooltip>
                </div>

                <p
                  class="plan-section-card__question text-default line-clamp-2 text-sm leading-6 font-medium"
                >
                  <InlineMarkdown :text="rollup.questionText" />
                </p>
              </div>

              <div class="plan-section-card__source min-w-0">
                <p
                  class="plan-section-card__source-name text-muted truncate text-sm"
                >
                  {{ templateName(rollup) }}
                </p>
                <p
                  class="plan-section-card__source-subtitle text-muted mt-0.5 truncate text-[13px]"
                >
                  {{ rollup.pillarName }}
                </p>
                <span
                  v-if="rollup.questionReference"
                  class="plan-section-card__question-id border-default bg-elevated text-muted mt-2 inline-block max-w-full truncate rounded-md border px-1.5 py-0.5 font-mono text-[13px] font-medium"
                >
                  {{ rollup.questionReference }}
                </span>
              </div>

              <div class="plan-section-card__actions min-w-0 lg:col-span-2">
                <span class="text-muted text-[13px] font-medium tabular-nums">
                  Repeated in {{ rollup.items.length }} review{{
                    rollup.items.length === 1 ? "" : "s"
                  }}
                </span>
              </div>

              <div class="product-plan-rollups__sources min-w-0 lg:col-span-2">
                <p class="text-muted text-[13px] font-semibold">
                  Revision context by review
                </p>
                <ul
                  class="border-default mt-1 border-y"
                  aria-label="Source reviews"
                >
                  <li
                    v-for="source in rollup.sources"
                    :key="source.reviewId"
                    :aria-label="`${source.reviewName} source`"
                    class="border-default grid min-w-0 gap-2 border-t py-2.5 first:border-t-0 md:grid-cols-[minmax(10rem,0.7fr)_minmax(0,1.3fr)] md:gap-4"
                  >
                    <div class="min-w-0">
                      <NuxtLink
                        :to="source.assessmentTo"
                        target="_blank"
                        rel="noopener noreferrer"
                        :aria-label="`Open ${source.reviewName} source question`"
                        class="text-primary focus-visible:ring-primary inline-flex min-h-8 max-w-full items-center rounded-[7px] text-[13px] font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      >
                        {{ source.reviewName }}
                      </NuxtLink>
                      <p class="text-muted truncate text-[13px]">
                        {{ source.sourceName }}
                      </p>
                    </div>
                    <MaturityCompactContext
                      v-if="source.maturity.length"
                      :entries="source.maturity"
                      :to="source.planTo"
                      :review-name="source.reviewName"
                    />
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>
