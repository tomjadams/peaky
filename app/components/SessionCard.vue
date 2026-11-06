<template>
  <div
    class="session-card group overflow-hidden rounded-lg border transition-colors duration-150"
    :class="cardClasses"
  >
    <!-- Collapsed header (always visible) -->
    <div class="flex w-full items-center">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center justify-between px-4 py-3 text-left"
        @click="emit('toggle')"
      >
        <div class="flex items-center gap-3">
          <!-- Progress ring icon -->
          <div class="relative">
            <svg class="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
              <!-- Background circle -->
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="text-[#DDE6EE] dark:text-slate-700"
              />
              <!-- Progress arc -->
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                :stroke-dasharray="`${progressCircle} 100`"
                class="text-primary transition-all duration-500"
              />
            </svg>
            <!-- Icon in center -->
            <div
              class="text-primary absolute inset-0 flex items-center justify-center"
            >
              <Icon name="lucide:users" class="h-4 w-4" />
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-default text-sm font-semibold">
                Team updated
              </span>
              <span
                v-if="
                  session.delta.questionsAnswered > 0 ||
                  session.delta.questionsChanged > 0
                "
                class="bg-success/10 text-success inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-medium"
              >
                <Icon name="lucide:trending-up" class="h-3 w-3" />
                +{{ session.delta.progressDelta }}%
              </span>
            </div>
            <div class="text-muted flex items-center gap-2 text-[13px]">
              <ClientOnly>
                <span>{{ formatRelativeDate(session.createdAt) }}</span>
                <template #fallback>
                  <span>{{ formatAbsoluteDate(session.createdAt) }}</span>
                </template>
              </ClientOnly>
              <span class="text-dimmed" aria-hidden="true">·</span>
              <span>{{ session.snapshot.overallProgress }}% complete</span>
            </div>
          </div>
        </div>

        <!-- Expand/collapse -->
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        >
          <Icon
            :name="expanded ? 'lucide:chevron-up' : 'lucide:chevron-down'"
            class="text-dimmed h-5 w-5 transition-transform duration-200"
            :class="{ 'rotate-180': expanded }"
          />
        </div>
      </button>
      <!-- Compare button -->
      <button
        v-if="!isComparing && !isFirst"
        type="button"
        class="text-muted hover:text-default mr-4 flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        @click="emit('compare', session)"
      >
        <Icon name="lucide:git-compare" class="h-3.5 w-3.5" />
        Compare
      </button>
    </div>

    <!-- Expanded content -->
    <UCollapsible :open="expanded">
      <template #content>
        <div class="border-default border-t px-4 py-4">
          <!-- Author attribution -->
          <div class="text-muted mb-4 flex items-center gap-2 text-[13px]">
            <Icon name="lucide:user" class="h-3.5 w-3.5" />
            <span
              >Updated by
              <span class="text-default font-medium">{{
                session.createdBy.name
              }}</span></span
            >
          </div>

          <!-- Changes summary - only show pillars that changed -->
          <div v-if="changedPillars.length > 0" class="space-y-2">
            <div
              v-for="pillar in changedPillars"
              :key="pillar.slug"
              class="border-default flex items-center gap-3 rounded-lg border p-3"
            >
              <!-- Change indicator -->
              <div
                class="bg-success/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
              >
                <Icon name="lucide:trending-up" class="text-success h-4 w-4" />
              </div>

              <!-- Pillar info -->
              <div class="min-w-0 flex-1">
                <div class="text-default text-sm font-medium">
                  {{ pillar.name }}
                </div>
                <div class="text-muted text-[13px]">
                  {{ pillar.questionsAdded }} question{{
                    pillar.questionsAdded !== 1 ? "s" : ""
                  }}
                  answered
                </div>
              </div>

              <!-- Progress change -->
              <div class="flex items-center gap-2 text-right">
                <span class="text-dimmed text-sm">
                  {{ pillar.previousProgress }}%
                </span>
                <Icon name="lucide:arrow-right" class="text-dimmed h-4 w-4" />
                <span
                  class="text-sm font-semibold"
                  :class="
                    pillar.progress === 100 ? 'text-success' : 'text-primary'
                  "
                >
                  {{ pillar.progress }}%
                </span>
              </div>
            </div>
          </div>

          <!-- No changes message -->
          <div
            v-else
            class="border-default text-muted rounded-lg border border-dashed p-3 text-center text-sm"
          >
            <Icon
              name="lucide:check-circle"
              class="mr-1.5 inline-block h-4 w-4"
            />
            {{
              isFirst
                ? "Initial review created"
                : "No pillar changes in this session"
            }}
          </div>

          <!-- Session note -->
          <div
            v-if="session.note"
            class="border-default mt-3 flex items-start gap-2 rounded-lg border p-3"
          >
            <Icon
              name="lucide:quote"
              class="text-dimmed mt-0.5 h-4 w-4 flex-shrink-0"
            />
            <p class="text-muted text-sm">"{{ session.note }}"</p>
          </div>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>

<script setup lang="ts">
import type { AssessmentSession } from "~/models";

const props = defineProps<{
  session: AssessmentSession;
  previousSession?: AssessmentSession;
  expanded?: boolean;
  isSelected?: boolean;
  isComparing?: boolean;
  isFirst?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  compare: [session: AssessmentSession];
}>();

const cardClasses = computed(() => {
  if (props.isSelected) {
    return "border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10";
  }
  return "border-default bg-default hover:border-accented";
});

const progressCircle = computed(() => {
  return (props.session.snapshot.overallProgress / 100) * 100;
});

const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatAbsoluteDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const changedPillars = computed(() => {
  if (!props.previousSession) {
    // First session - show all pillars with answers as "new"
    return props.session.snapshot.pillars
      .filter((p) => p.answeredQuestions > 0)
      .map((pillar) => ({
        slug: pillar.slug,
        name: pillar.name,
        progress: pillar.progress,
        previousProgress: 0,
        questionsAdded: pillar.answeredQuestions,
      }));
  }

  return props.session.snapshot.pillars
    .map((pillar) => {
      const prevPillar = props.previousSession!.snapshot.pillars.find(
        (p) => p.slug === pillar.slug
      );
      const prevProgress = prevPillar?.progress ?? 0;
      const prevAnswered = prevPillar?.answeredQuestions ?? 0;
      const questionsAdded = pillar.answeredQuestions - prevAnswered;

      return {
        slug: pillar.slug,
        name: pillar.name,
        progress: pillar.progress,
        previousProgress: prevProgress,
        questionsAdded,
        changed: questionsAdded > 0,
      };
    })
    .filter((p) => p.changed);
});
</script>
