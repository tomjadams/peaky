<script setup lang="ts">
/**
 * Recent activity table on /system. Reads `peaky.system` events from the
 * local events table directly (no HTTP call) via useSystemRecentActivity,
 * which scopes the feed to the current browser session.
 *
 * Limited to the latest 10 rows so the page stays glanceable.
 */
import { useSystemRecentActivity } from "~/composables/system/useSystemRecentActivity";
import { formatEventTime } from "~/admin/formatters";

const {
  rows,
  isLoading,
  isLoadingMore,
  error,
  hasMore,
  init,
  refresh,
  loadMore,
} = useSystemRecentActivity();

defineExpose({ refresh });

onMounted(init);
</script>

<template>
  <UCard :ui="{ body: 'p-0' }">
    <div
      class="border-default flex items-start justify-between gap-3 border-b px-4 py-3"
    >
      <div>
        <h3 class="text-default font-semibold">Recent system activity</h3>
        <p class="text-muted mt-0.5 text-xs">
          This browser session only — older events live in the full feed.
        </p>
      </div>
      <NuxtLink
        to="/events?source=peaky.system"
        class="text-primary hover:text-primary-hover shrink-0 text-xs font-medium"
      >
        See full history in Events →
      </NuxtLink>
    </div>

    <div v-if="isLoading" class="text-muted px-4 py-6 text-sm">
      Loading recent activity…
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      title="Could not load recent activity"
      :description="error.message"
      class="m-4"
    />

    <div v-else-if="rows.length === 0" class="text-muted px-4 py-6 text-sm">
      No activity in this session yet. Bootstrap, sync, and storage events from
      the current browser session will appear here.
    </div>

    <table v-else class="w-full">
      <thead class="bg-elevated text-dimmed">
        <tr>
          <th class="px-4 py-2 text-left text-[13px] font-semibold">When</th>
          <th class="px-4 py-2 text-left text-[13px] font-semibold">Event</th>
          <th class="px-4 py-2 text-left text-[13px] font-semibold">Detail</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" class="border-default border-t">
          <td class="text-muted px-4 py-2 font-mono text-xs">
            {{ formatEventTime(row.time) }}
          </td>
          <td class="text-default px-4 py-2 text-sm font-medium">
            {{ row.actionLabel }}
          </td>
          <td class="text-muted px-4 py-2 text-sm">{{ row.detail }}</td>
        </tr>
      </tbody>
    </table>

    <div
      v-if="hasMore && !isLoading"
      class="border-default border-t px-4 py-3 text-center"
    >
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        :loading="isLoadingMore"
        @click="loadMore"
      >
        Load more
      </UButton>
    </div>
  </UCard>
</template>
