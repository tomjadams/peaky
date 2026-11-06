<script setup lang="ts">
/**
 * /system — member-facing engine status surface.
 *
 * Available to all authenticated members (not admin-only). Follows the
 * /events shell conventions (header, refresh, ml-20/lg:mx-32 outer,
 * max-w-8xl mx-auto inner, space-y-6).
 *
 * Layout:
 * - title + subtitle + Refresh
 * - conditional emergency banner (when local-db-error is set)
 * - 4 status tiles (Database, Schema, Storage, Sync)
 * - recent system activity table
 * - maintenance card (Recreate local DB — single action by design)
 */
import { useSystemStatus } from "~/composables/system/useSystemStatus";
import { formatEventTime } from "~/admin/formatters";

definePageMeta({
  breadcrumb: { label: "System" },
  pageHeader: {
    title: "System",
    showSurveyMode: false,
  },
});

const status = useSystemStatus();
const recentActivity = ref<{ refresh: () => Promise<void> } | null>(null);

async function handleRefresh() {
  await status.refresh();
  await recentActivity.value?.refresh();
}

onMounted(() => {
  status.refresh();
});

// ─── Tile derivations ───────────────────────────────────────────

const databaseTile = computed(() => {
  const db = status.database.value;
  if (db.health === "error") {
    return {
      tone: "error" as const,
      headline: "Error",
      support:
        db.failedMigrationId !== null
          ? `Migration ${db.failedMigrationId}`
          : (db.errorMessage ?? "Failed to start"),
    };
  }
  if (db.health === "initializing") {
    return {
      tone: "neutral" as const,
      headline: "Initializing",
      support: "Bootstrapping local storage…",
    };
  }
  const support =
    db.readyAt !== null
      ? `Ready · ${formatEventTime(db.readyAt)}${
          db.coldStartMs !== null ? ` · ${db.coldStartMs} ms` : ""
        }`
      : "Ready";
  return { tone: "ok" as const, headline: "Healthy", support };
});

const schemaTile = computed(() => {
  const s = status.schema.value;
  if (s.state === "stuck") {
    const pending = s.expectedVersion - s.version;
    return {
      tone: "warn" as const,
      headline: "Stuck",
      support: `${pending} update${pending === 1 ? "" : "s"} pending`,
    };
  }
  // Show the build ID so support / debugging can identify exactly which
  // deployment is running (especially useful on Vercel before we have a
  // formal release-tag system).
  const config = useRuntimeConfig();
  const buildId = (config.app as { buildId?: string }).buildId ?? "dev";
  return {
    tone: "ok" as const,
    headline: "Up to date",
    support: `Build ${buildId}`,
  };
});

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const storageTile = computed(() => {
  const s = status.storage.value;
  if (s.state === "unsupported") {
    return {
      tone: "neutral" as const,
      headline: "Unknown",
      support: "Browser storage API unavailable",
    };
  }
  const usedFmt = formatBytes(s.usageBytes);
  const quotaFmt = formatBytes(s.quotaBytes);
  if (s.state === "warning") {
    return {
      tone: "warn" as const,
      headline: `${s.usagePct ?? 0}% used`,
      support: `${usedFmt} of ~${quotaFmt} quota`,
    };
  }
  return {
    tone: "ok" as const,
    headline: usedFmt,
    support: s.quotaBytes !== null ? `of ~${quotaFmt} quota` : "",
  };
});

const syncTile = computed(() => {
  const s = status.sync.value;
  if (s.state === "paused") {
    return {
      tone: "neutral" as const,
      headline: "Paused",
      support: "Will retry when database is healthy",
    };
  }
  if (s.state === "failed") {
    return {
      tone: "error" as const,
      headline: "Failed",
      support: s.errorMessage ?? "Last sync did not complete",
    };
  }
  if (s.state === "stale") {
    return {
      tone: "warn" as const,
      headline: "Stale",
      support:
        s.lastSyncAt !== null
          ? `Last sync ${formatEventTime(s.lastSyncAt)}`
          : "No recent sync",
    };
  }
  if (s.state === "not-yet-synced") {
    return {
      tone: "neutral" as const,
      headline: "Not synced yet",
      support: `${s.pendingCount} pending · waiting for first sync`,
    };
  }
  return {
    tone: "ok" as const,
    headline: "In sync",
    support:
      s.lastSyncAt !== null
        ? `${s.pendingCount} pending · last ${formatEventTime(s.lastSyncAt)}`
        : `${s.pendingCount} pending`,
  };
});
</script>

<template>
  <div class="system-page ml-20 flex flex-1 flex-col lg:mx-32">
    <main class="system-page__main w-full px-8 py-6">
      <div class="system-page__container max-w-8xl mx-auto space-y-6">
        <SectionHeader
          title="System"
          description="How Peaky is running on this device."
          class="system-page__header mb-6"
        >
          <div class="flex items-center gap-3">
            <p
              v-if="status.lastRefreshedAt.value"
              class="text-dimmed text-[13px]"
              aria-live="polite"
            >
              Updated {{ formatEventTime(status.lastRefreshedAt.value) }}
            </p>
            <UButton
              color="primary"
              icon="i-lucide-refresh-cw"
              :loading="status.isRefreshing.value"
              @click="handleRefresh"
            >
              Refresh
            </UButton>
          </div>
        </SectionHeader>

        <SystemEmergencyBanner />

        <section
          aria-label="Engine status"
          class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <SystemStatusTile
            icon="lucide:database"
            label="Database"
            :tone="databaseTile.tone"
            :headline="databaseTile.headline"
            :support="databaseTile.support"
            what-is-this="Peaky stores a copy of your work in your browser so you can keep working when offline. We use SQLite, the same engine that powers your phone's contacts and messages apps."
          />
          <SystemStatusTile
            icon="lucide:refresh-cw"
            label="Sync"
            :tone="syncTile.tone"
            :headline="syncTile.headline"
            :support="syncTile.support"
            what-is-this="Your work is saved locally first, then sent to the server in the background. 'In sync' means the server has everything this browser has."
          />
          <SystemStatusTile
            icon="lucide:hard-drive"
            label="Storage"
            :tone="storageTile.tone"
            :headline="storageTile.headline"
            :support="storageTile.support"
            what-is-this="Your browser gives Peaky a small amount of private storage that no other site can see. This number is how much of that allowance Peaky is currently using."
          />
          <SystemStatusTile
            icon="lucide:layers"
            label="Schema"
            :tone="schemaTile.tone"
            :headline="schemaTile.headline"
            :support="schemaTile.support"
            what-is-this="The shape of your local data. When we ship updates that need new fields or tables, you'll see a small migration run on your next visit."
          />
        </section>

        <section aria-label="Recent system activity">
          <SystemRecentActivity ref="recentActivity" />
        </section>

        <section aria-label="Actions" class="space-y-4">
          <h2 class="text-default mb-3 text-sm font-semibold">Actions</h2>
          <SystemClearCacheCard />
          <SystemMaintenanceCard />
        </section>
      </div>
    </main>
  </div>
</template>
