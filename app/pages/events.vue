<template>
  <div class="events-page ml-20 flex flex-1 flex-col lg:mx-32">
    <main class="events-page__main w-full px-8 py-6">
      <div class="events-page__container max-w-8xl mx-auto space-y-6">
        <SectionHeader
          title="Events"
          description="CloudTrail-style visibility for lifecycle decisions and review activity."
          class="events-page__header mb-6"
        >
          <div class="events-page__actions flex flex-wrap items-center gap-3">
            <UButton
              to="/schemas"
              color="neutral"
              variant="ghost"
              icon="i-lucide-file-json"
              size="sm"
            >
              Event schemas
            </UButton>

            <button
              type="button"
              class="events-page__live-tail border-default bg-elevated inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
              :class="
                isLiveTailEnabled
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'text-default hover:bg-accented'
              "
              :aria-pressed="isLiveTailEnabled"
              @click="isLiveTailEnabled = !isLiveTailEnabled"
            >
              <Icon name="lucide:radio" class="h-4 w-4" aria-hidden="true" />
              Live tail
              <span
                v-if="isLiveTailEnabled"
                class="bg-primary inline-block h-2 w-2 rounded-full"
                aria-hidden="true"
              />
            </button>

            <UButton
              color="primary"
              icon="i-lucide-refresh-cw"
              :loading="pending"
              @click="refreshEvents()"
            >
              Refresh feed
            </UButton>
          </div>
        </SectionHeader>

        <UAlert
          v-if="isLiveTailEnabled"
          :color="liveTailStatusColor"
          variant="subtle"
          title="Live tail is enabled"
          :description="liveTailStatusDescription"
        />

        <StatStrip layout="quad" class="events-page__stats mb-6">
          <StatBlock
            label="Total events"
            :value="totalEvents"
            :reveal-index="0"
          />
          <StatBlock
            label="Lifecycle events"
            :value="lifecycleCount"
            :reveal-index="1"
          />
          <StatBlock
            label="Destructive events"
            :value="destructiveCount"
            :tone="destructiveCount > 0 ? 'attention' : 'default'"
            :reveal-index="2"
          />
          <StatBlock
            label="Pending sync"
            :value="pendingCount"
            :reveal-index="3"
          />
        </StatStrip>

        <UAlert
          v-if="isBlockingError"
          color="error"
          variant="subtle"
          title="Could not load events"
          description="Please refresh the feed and try again."
        />

        <div v-else-if="pending" class="flex items-center justify-center py-16">
          <span class="text-muted text-sm">Loading events...</span>
        </div>

        <section v-else aria-label="Events list">
          <DataTable
            :columns="columns"
            :data="filteredEvents as unknown as Record<string, unknown>[]"
            :sort-by="sortBy"
            :sort-direction="sortDirection"
            :clickable-rows="true"
            title="Event feed"
            item-noun="events"
            :total-count="totalEvents"
            :filtered-count="filteredEvents.length"
            empty-message="No events yet."
            filtered-empty-message="No matches for your filters."
            aria-label="Events"
            @sort="handleSort"
            @row-click="handleRowClick"
            @action="handleAction"
          >
            <template #console>
              <SearchInput
                v-model="searchQuery"
                placeholder="Search actors, resources, or event summaries..."
                class="w-80"
              />
              <USelect
                v-model="categoryFilter"
                :items="categoryOptions"
                size="md"
                icon="i-lucide-layers-3"
                class="w-44"
              />
              <USelect
                v-model="subjectTypeFilter"
                :items="subjectTypeOptions"
                size="md"
                icon="i-lucide-tag"
                class="w-44"
              />
              <USelect
                v-model="actionFilter"
                :items="actionOptions"
                size="md"
                icon="i-lucide-filter"
                class="w-44"
              />
              <USelect
                v-model="statusFilter"
                :items="statusOptions"
                size="md"
                icon="i-lucide-signal"
                class="w-44"
              />
            </template>

            <template #cell-time="{ row }">
              <div class="text-muted text-sm leading-5">
                {{ formatEventTime(toEvent(row).time) }}
              </div>
            </template>

            <template #cell-actionLabel="{ row }">
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge
                    :color="getCategoryColor(toEvent(row).category)"
                    variant="subtle"
                    size="sm"
                  >
                    {{ formatCategoryLabel(toEvent(row).category) }}
                  </UBadge>
                  <span class="text-default font-medium">
                    {{ toEvent(row).actionLabel }}
                  </span>
                </div>
                <p class="text-muted text-sm">
                  {{ toEvent(row).summary }}
                </p>
              </div>
            </template>

            <template #cell-subjectName="{ row }">
              <div class="space-y-1">
                <NuxtLink
                  v-if="toEvent(row).subjectUrl"
                  :to="toEvent(row).subjectUrl"
                  class="text-default hover:text-primary font-medium"
                  @click.stop
                >
                  {{ toEvent(row).subjectName }}
                </NuxtLink>
                <span v-else class="text-default font-medium">
                  {{ toEvent(row).subjectName }}
                </span>
                <p class="text-muted text-sm">
                  {{ toEvent(row).subjectTypeLabel }} ·
                  {{ toEvent(row).subjectId }}
                </p>
              </div>
            </template>

            <template #cell-actorName="{ row }">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-default font-medium">
                    {{ toEvent(row).actorName }}
                  </span>
                  <UBadge
                    :color="getActorTypeColor(toEvent(row).actorType)"
                    variant="subtle"
                    size="sm"
                  >
                    {{ toEvent(row).actorType }}
                  </UBadge>
                  <UTooltip
                    v-if="toEvent(row).piiRedactedAt"
                    text="GDPR erasure applied"
                  >
                    <Icon
                      name="lucide:shield-check"
                      class="text-muted h-3.5 w-3.5"
                      aria-label="PII redacted"
                    />
                  </UTooltip>
                </div>
                <p class="text-muted text-sm">
                  {{ toEvent(row).actorId }}
                  <template v-if="toEvent(row).actorRoles.length > 0">
                    · {{ toEvent(row).actorRoles.join(", ") }}
                  </template>
                </p>
              </div>
            </template>

            <template #cell-status="{ row }">
              <div class="flex flex-col items-start gap-2">
                <UBadge
                  :color="getStatusColor(toEvent(row).status)"
                  variant="subtle"
                  size="md"
                >
                  {{ toEvent(row).status }}
                </UBadge>
                <span class="text-dimmed text-[13px] font-medium">
                  {{ formatSourceLabel(toEvent(row).source) }}
                </span>
              </div>
            </template>
          </DataTable>
        </section>
      </div>
    </main>

    <AdminEventDetailsSlideover
      :open="isDetailsOpen"
      :event="selectedEvent"
      :details="selectedEventDetails"
      @update:open="isDetailsOpen = $event"
      @redacted="refreshEvents()"
    />
  </div>
</template>

<script setup lang="ts">
import type { DataTableColumn } from "~/components/DataTable.vue";
import type { AdminEventRecord } from "~/admin/events";
import {
  formatCategoryLabel,
  formatEventTime,
  formatSourceLabel,
  getActorTypeColor,
  getCategoryColor,
  getStatusColor,
} from "~/admin/formatters";
import { useAdminEventsFeed } from "~/composables/admin/useAdminEventsFeed";
import { useAdminEventsLiveTail } from "~/composables/admin/useAdminEventsLiveTail";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { buildLifecycleActorHeaders } from "~/lifecycle/management";

definePageMeta({
  breadcrumb: {
    label: "Events",
  },
  pageHeader: {
    title: "Events",
    showSurveyMode: false,
  },
});

const { actor } = useCurrentActor();

const { data, pending, error, refresh } = await useFetch<AdminEventRecord[]>(
  "/api/admin/events",
  {
    default: () => [],
    headers: computed(() => buildLifecycleActorHeaders(actor.value)),
    watch: [actor],
  }
);

// 403 means the current user lacks admin access — fall back to local events
// rather than blocking the entire UI with an error banner.
const isBlockingError = computed(
  () => !!error.value && error.value.statusCode !== 403
);

const {
  actionFilter,
  actionOptions,
  categoryFilter,
  categoryOptions,
  destructiveCount,
  filteredEvents,
  handleSort,
  isDetailsOpen,
  lifecycleCount,
  openEventDetails,
  pendingCount,
  refreshLocalEvents,
  searchQuery,
  selectedEvent,
  selectedEventDetails,
  sortBy,
  sortDirection,
  statusFilter,
  statusOptions,
  subjectTypeFilter,
  subjectTypeOptions,
  totalEvents,
} = useAdminEventsFeed(data);

const columns: DataTableColumn[] = [
  {
    key: "time",
    label: "When",
    sortable: true,
    type: "date",
    width: "w-40",
  },
  {
    key: "actionLabel",
    label: "Event",
    sortable: true,
    width: "w-[32%]",
  },
  {
    key: "subjectName",
    label: "Resource",
    sortable: true,
    width: "w-[24%]",
  },
  {
    key: "actorName",
    label: "Actor",
    sortable: true,
    width: "w-[20%]",
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    width: "w-[12%]",
  },
  {
    key: "actions",
    label: "",
    type: "actions",
    width: "w-16",
    actions: [{ id: "view", icon: "lucide:eye", label: "View details" }],
  },
];

const refreshEvents = async () => {
  await Promise.all([refresh(), refreshLocalEvents()]);
};

const {
  isEnabled: isLiveTailEnabled,
  statusColor: liveTailStatusColor,
  statusDescription: liveTailStatusDescription,
} = useAdminEventsLiveTail(actor, refreshEvents);

const handleRowClick = (row: Record<string, unknown>) => {
  openEventDetails(String(row.id));
};

const handleAction = (action: string, row: Record<string, unknown>) => {
  if (action !== "view") {
    return;
  }

  openEventDetails(String(row.id));
};

onMounted(() => {
  void refreshLocalEvents();
});

function toEvent(row: Record<string, unknown>): AdminEventRecord {
  return row as unknown as AdminEventRecord;
}
</script>
