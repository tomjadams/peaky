<template>
  <UPopover
    :content="{ side: 'bottom', align: 'end', sideOffset: 8 }"
    :ui="{ content: 'bg-transparent shadow-none ring-0 rounded-none p-0' }"
  >
    <button
      class="hover:bg-muted flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
      :aria-label="statusLabel"
      type="button"
    >
      <!-- Syncing: spinning sky dot -->
      <span
        v-if="status === 'syncing'"
        class="border-primary inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-t-transparent"
        data-testid="sync-indicator-syncing"
      />
      <!-- Online / synced: solid green dot -->
      <span
        v-else-if="status === 'online'"
        class="bg-success inline-block h-2.5 w-2.5 rounded-full"
        data-testid="sync-indicator-online"
      />
      <!-- Degraded: amber dot — push works, pull failing -->
      <span
        v-else-if="status === 'degraded'"
        class="bg-warning inline-block h-2.5 w-2.5 rounded-full"
        data-testid="sync-indicator-degraded"
      />
      <!-- Offline / error: dimmed dot -->
      <span
        v-else
        class="bg-muted inline-block h-2.5 w-2.5 rounded-full"
        data-testid="sync-indicator-offline"
      />
    </button>

    <template #content>
      <div
        class="bg-elevated border-default w-72 overflow-hidden rounded-lg border p-4 shadow-[0_8px_24px_rgba(15,23,42,.10)]"
      >
        <!-- Header -->
        <div class="flex items-center gap-2">
          <span :class="dotClass" class="inline-block h-2 w-2 rounded-full" />
          <span class="text-highlighted text-sm font-semibold">{{
            statusLabel
          }}</span>
        </div>

        <!-- What works / what doesn't -->
        <div class="mt-3 space-y-1.5">
          <div
            v-for="item in breakdownItems"
            :key="item.label"
            class="flex items-start gap-2 text-[13px]"
          >
            <UIcon
              :name="item.ok ? 'i-lucide-check' : 'i-lucide-x'"
              :class="item.ok ? 'text-success' : 'text-dimmed'"
              class="mt-0.5 h-3.5 w-3.5 shrink-0"
            />
            <span :class="item.ok ? 'text-default' : 'text-dimmed'">
              {{ item.label }}
            </span>
          </div>
        </div>

        <!-- Footer: pending count + last sync -->
        <div
          v-if="pendingCount > 0 || lastSyncAt"
          class="border-default text-dimmed mt-3 border-t pt-2.5 text-[13px]"
        >
          <div v-if="pendingCount > 0">
            {{ pendingCount }} change{{ pendingCount === 1 ? "" : "s" }} queued
          </div>
          <div v-if="lastSyncAt">
            Last synced {{ formatRelativeTime(new Date(lastSyncAt)) }}
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useSyncStatus } from "~/composables/sync/useSyncStatus";
import { formatRelativeTime } from "~/utils/date";

const { status, pendingCount, lastSyncAt } = useSyncStatus();

const statusLabel = computed(() => {
  if (status.value === "syncing") return "Syncing";
  if (status.value === "offline") return "Sync server unreachable";
  if (status.value === "degraded") return "Partially connected";
  return "All synced";
});

const dotClass = computed(() => {
  if (status.value === "online") return "bg-success";
  if (status.value === "syncing") return "bg-primary";
  if (status.value === "degraded") return "bg-warning";
  return "bg-muted";
});

const breakdownItems = computed(() => {
  if (status.value === "online" || status.value === "syncing") {
    return [
      { label: "Local saves working", ok: true },
      { label: "Changes synced to server", ok: true },
      { label: "Receiving live updates", ok: true },
      { label: "Recent changes feed", ok: true },
    ];
  }
  if (status.value === "degraded") {
    return [
      { label: "Local saves working", ok: true },
      { label: "Changes queued for sync", ok: true },
      { label: "Server can't receive changes", ok: false },
      { label: "Receiving live updates paused", ok: false },
      { label: "Recent changes feed paused", ok: false },
    ];
  }
  // offline
  return [
    { label: "Local saves working — nothing is lost", ok: true },
    { label: "Changes queued — will sync when server is back", ok: true },
    { label: "Server unreachable", ok: false },
    { label: "Live updates unavailable", ok: false },
    { label: "Recent changes feed unavailable", ok: false },
  ];
});
</script>
