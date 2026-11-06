<template>
  <aside
    class="template-selector border-default bg-default sticky top-20 z-20 flex h-[calc(100vh-5rem)] w-full flex-col self-start border-r dark:border-slate-800 dark:shadow-lg"
    :class="
      isCollapsed
        ? 'template-selector--collapsed'
        : 'template-selector--expanded'
    "
    role="complementary"
    aria-label="Template navigation"
  >
    <header
      class="template-selector__header flex flex-shrink-0 justify-end p-2"
    >
      <button
        class="template-selector__toggle hover:bg-primary/10 hover:text-primary text-dimmed flex h-7 w-7 items-center justify-center rounded-md transition-colors dark:text-slate-500"
        :aria-label="
          isCollapsed
            ? 'Expand template selector'
            : 'Collapse template selector'
        "
        @click="isCollapsed = !isCollapsed"
      >
        <Icon
          :name="
            isCollapsed ? 'lucide:panel-left-open' : 'lucide:panel-left-close'
          "
          class="text-lg"
          aria-hidden="true"
        />
      </button>
    </header>
    <div class="flex h-full flex-col overflow-hidden">
      <div
        v-if="isCollapsed"
        class="template-selector__collapsed-view flex flex-col gap-2 p-2"
      >
        <div v-if="!review" class="flex items-center justify-center p-2">
          <Icon
            name="lucide:rotate-cw"
            class="text-dimmed animate-spin"
            aria-hidden="true"
          />
        </div>
        <div
          v-else-if="activeTemplate"
          class="template-selector__collapsed-content flex flex-col items-center gap-1.5"
          :title="activeTemplate.name"
        >
          <div
            class="template-selector__icon bg-primary/10 flex h-7 w-7 items-center justify-center rounded-lg"
          >
            <Icon
              name="lucide:file-text"
              class="text-primary text-sm"
              aria-hidden="true"
            />
          </div>
          <div
            class="template-selector__info hidden flex-col items-center gap-1 min-[1920px]:flex"
          >
            <span
              class="template-selector__name text-highlighted text-center text-[13px] leading-tight font-semibold min-[1920px]:text-sm"
            >
              {{ activeTemplate.name }}
            </span>
            <span
              class="template-selector__status-badge"
              :class="[
                'rounded px-1.5 py-0.5 text-[13px] font-semibold min-[1920px]:text-sm',
                statusBadgeClass(activeTemplate.status),
              ]"
            >
              {{ formatStatus(activeTemplate.status) }}
            </span>
          </div>
        </div>
        <div class="template-selector__divider bg-accented h-px w-full" />
      </div>
      <div
        v-else
        class="template-selector__expanded-view flex-1 overflow-y-auto px-4 pb-4 min-[1920px]:px-5 min-[1920px]:pb-5"
      >
        <div v-if="!review" class="flex items-center justify-center p-4">
          <span class="text-dimmed text-sm">Loading...</span>
        </div>
        <div v-else-if="activeTemplate" class="space-y-6">
          <div class="template-selector__active-template space-y-2">
            <button
              class="template-selector__template-header group flex w-full items-start justify-between gap-2 text-left"
              :aria-expanded="!templateCollapsed"
              @click="templateCollapsed = !templateCollapsed"
            >
              <div class="min-w-0 space-y-1.5">
                <!-- Index tick: this is the sheet currently on the table. -->
                <span
                  class="block h-[3px] w-6 rounded-full bg-[#0284C7] dark:bg-sky-400"
                  aria-hidden="true"
                />
                <span
                  class="template-selector__template-name text-highlighted block text-sm leading-snug font-semibold min-[1920px]:text-base"
                >
                  {{ activeTemplate.name }}
                </span>
                <span class="flex flex-wrap items-center gap-1.5">
                  <span
                    v-if="activeTemplate.version"
                    class="border-default bg-muted text-muted rounded-md border px-1.5 py-0.5 font-mono text-[13px] font-medium min-[1920px]:text-sm"
                  >
                    v{{ activeTemplate.version }}
                  </span>
                  <span
                    class="template-selector__status-badge"
                    :class="[
                      'w-fit rounded px-1.5 py-0.5 text-[13px] font-semibold min-[1920px]:text-sm',
                      statusBadgeClass(activeTemplate.status),
                    ]"
                  >
                    {{ formatStatus(activeTemplate.status) }}
                  </span>
                </span>
              </div>
              <Icon
                name="lucide:chevron-down"
                :class="[
                  'group-hover:text-primary text-dimmed mt-1 shrink-0 text-lg transition-transform',
                  !templateCollapsed ? 'rotate-180' : '',
                ]"
                aria-hidden="true"
              />
            </button>

            <!-- Pillars as a route rail: dotted connector, one waypoint per
                 pillar — hollow until started, sky when it's where you are,
                 confirm green once every question is answered. -->
            <div
              v-show="!templateCollapsed"
              class="template-selector__pillar-list relative mt-3"
            >
              <span
                class="border-default absolute top-4 bottom-4 left-[12px] w-px border-l border-dashed dark:border-slate-700"
                aria-hidden="true"
              />
              <button
                v-for="pillar in activeTemplate.pillars"
                :key="pillar.slug"
                type="button"
                class="template-selector__pillar-link relative grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2.5 rounded-lg py-2 pr-2 pl-2 text-left transition-colors min-[1920px]:py-2.5 min-[1920px]:pr-2.5 min-[1920px]:pl-2.5"
                :class="
                  activePillarSlug === pillar.slug
                    ? 'template-selector__pillar-link--active bg-[#EAF3FA] dark:bg-sky-400/10'
                    : 'hover:bg-muted dark:hover:bg-slate-800/50'
                "
                @click="handlePillarClick(pillar.slug)"
              >
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full border-2"
                  :class="waypointClass(pillar)"
                  aria-hidden="true"
                />
                <span
                  class="template-selector__pillar-name text-[13px] leading-snug font-medium min-[1920px]:text-sm"
                  :class="
                    activePillarSlug === pillar.slug
                      ? 'text-sky-700 dark:text-sky-300'
                      : 'text-default dark:text-slate-300'
                  "
                  >{{ pillar.name }}</span
                >
                <span
                  class="template-selector__pillar-progress"
                  :class="[
                    'text-[13px] tabular-nums min-[1920px]:text-sm',
                    activePillarSlug === pillar.slug
                      ? 'font-semibold text-sky-700 dark:text-sky-300'
                      : pillar.progress === 100
                        ? 'template-selector__pillar-progress--complete text-success font-semibold'
                        : 'text-dimmed',
                  ]"
                >
                  {{ pillar.progress }}%
                </span>
              </button>
            </div>
          </div>

          <div
            v-for="template in inactiveTemplates"
            :key="template.id"
            class="template-selector__inactive-template border-muted border-t pt-4 dark:border-slate-800"
          >
            <button
              class="template-selector__template-header template-selector__template-header--inactive group flex w-full items-start justify-between gap-2 text-left transition-opacity hover:opacity-100"
              @click="emit('selectTemplateRevision', template.revisionId)"
            >
              <div class="min-w-0 space-y-1">
                <span
                  class="text-toned block text-sm leading-snug font-semibold min-[1920px]:text-base dark:text-slate-300"
                >
                  {{ template.name }}
                </span>
                <span class="flex flex-wrap items-center gap-1.5">
                  <span
                    v-if="template.version"
                    class="border-default bg-muted text-muted rounded-md border px-1.5 py-0.5 font-mono text-[13px] font-medium min-[1920px]:text-sm"
                  >
                    v{{ template.version }}
                  </span>
                  <span
                    class="text-muted text-[13px] font-medium min-[1920px]:text-sm"
                  >
                    {{ formatStatus(template.status) }}
                  </span>
                </span>
              </div>
              <Icon
                name="lucide:arrow-right"
                class="text-dimmed group-hover:text-primary mt-1 shrink-0 text-base dark:group-hover:text-slate-300"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import type { Review } from "~/models";
import { useTemplateSelector } from "~/ui/useTemplateSelector";

interface PillarStat {
  slug: string;
  name: string;
  progress: number;
}

const props = defineProps<{
  review: Review | null;
  pillarStats: PillarStat[];
}>();

const emit = defineEmits<{
  selectTemplateRevision: [revisionId: string];
}>();

const {
  isCollapsed,
  activeTemplateRevisionId,
  activePillarSlug,
  setActivePillar,
} = useTemplateSelector();
const templateCollapsed = ref(false);

const activeTemplate = computed(() => {
  const currentReview = props.review;
  if (!currentReview) return null;

  const selectedTemplate =
    currentReview.templates.find(
      (template) =>
        template.templateRevisionId === activeTemplateRevisionId.value
    ) ?? currentReview.templates[0];

  if (!selectedTemplate) return null;

  const statsBySlug = new Map(
    props.pillarStats.map((pillar) => [pillar.slug, pillar])
  );
  return {
    id: selectedTemplate.templateId,
    revisionId: selectedTemplate.templateRevisionId,
    name: selectedTemplate.templateName,
    version: selectedTemplate.revisionNumber,
    status: currentReview.status.toUpperCase(),
    pillars: selectedTemplate.pillars.map((pillar) => ({
      ...pillar,
      progress: statsBySlug.get(pillar.slug)?.progress ?? pillar.progress,
    })),
  };
});

const inactiveTemplates = computed(() => {
  const currentReview = props.review;
  if (!currentReview?.templates || currentReview.templates.length === 0)
    return [];
  if (!activeTemplate.value) return [];

  return currentReview.templates
    .filter(
      (template) =>
        template.templateRevisionId !== activeTemplate.value?.revisionId
    )
    .map((template) => ({
      id: template.templateId,
      revisionId: template.templateRevisionId,
      name: template.templateName,
      version: template.revisionNumber,
      status: currentReview.status.toUpperCase(),
    }));
});

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "ACTIVE":
      return "bg-success/10 text-success dark:bg-green-900/30 dark:text-green-400";
    case "DRAFT":
      return "bg-muted text-muted dark:bg-slate-800 dark:text-slate-400";
    case "REVIEW":
      return "bg-primary/10 text-primary";
    default:
      return "bg-muted text-muted dark:bg-slate-800 dark:text-slate-400";
  }
};

// Status values are stored uppercase for the badge-class switch; render them
// sentence case (no uppercase micro-labels).
const formatStatus = (status: string) =>
  status.charAt(0) + status.slice(1).toLowerCase();

const handlePillarClick = (slug: string) => {
  setActivePillar(slug);
};

// Waypoint fill mirrors the drafting room's rail: green once the pillar is
// fully answered, sky where you are, an outlined sky ring once started,
// hollow until then.
const waypointClass = (pillar: { slug: string; progress: number }) => {
  if (pillar.progress === 100) return "border-success bg-success";
  if (activePillarSlug.value === pillar.slug)
    return "border-sky-600 bg-sky-600 dark:border-sky-400 dark:bg-sky-400";
  if (pillar.progress > 0)
    return "bg-default border-sky-600 dark:border-sky-400";
  return "border-accented bg-default dark:border-slate-600";
};

onMounted(() => {
  const stored = localStorage.getItem("peaky:template-selector-collapsed-v2");
  if (stored !== null) {
    isCollapsed.value = stored === "true";
  } else {
    isCollapsed.value = window.innerWidth < 1280;
  }
});

watch(isCollapsed, (newValue) => {
  localStorage.setItem(
    "peaky:template-selector-collapsed-v2",
    String(newValue)
  );
});
</script>
