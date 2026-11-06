<script setup lang="ts">
import { computed } from "vue";
import type { TableColumn } from "~/components/DataTable.vue";
import type { Pillar } from "~/models/pillar";
import type { ReviewWorkspace } from "~/models/workspace";
import { LOCAL_TTL_DAYS } from "~/services/sync/LocalTTL";
import { useFieldVersions } from "~/composables/sync/useFieldVersions";
import { useRecentChangesFilters } from "~/composables/sync/useRecentChangesFilters";
import { useCatalogUserSearch } from "~/composables/catalog/useCatalogUserSearch";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { formatRelativeTime } from "~/utils/date";
import {
  buildChecklistView,
  checklistCountSummary,
  checklistDiff,
  isChecklist,
  type ChecklistContext,
  type ChecklistState,
} from "~/utils/recentChangesChecklist";
import {
  resolveActorDisplayName,
  toRecentChangeEntry,
  toTableRow,
} from "~/utils/recentChangesRows";

interface Props {
  reviewId: string;
  pillars?: Pillar[];
  workspace?: ReviewWorkspace | null;
}

const props = withDefaults(defineProps<Props>(), {
  pillars: () => [],
  workspace: null,
});

const { entries, isLoading, isLoadingMore, hasMore, loadMore } =
  useFieldVersions(
    computed(() => props.reviewId),
    computed(() => props.workspace)
  );
const { actor } = useCurrentActor();
const { allUsers } = useCatalogUserSearch();
const actorNameById = computed(
  () => new Map(allUsers.value.map((user) => [user.id, user.displayName]))
);
const resolveActorName = (actorId: string) =>
  resolveActorDisplayName(
    actorId,
    actor.value,
    actorNameById.value.get(actorId)
  );

// ── Filters ───────────────────────────────────────────────────────────────────

const {
  searchQuery,
  answerMenuItems,
  pillarMenuItems,
  templateMenuItems,
  answerFilterLabel,
  pillarFilterLabel,
  templateFilterLabel,
  pillarOptions,
  templateOptions,
  filteredEntries,
  showTtlNotice,
  resolvePillarName,
} = useRecentChangesFilters(
  entries,
  computed(() => props.pillars),
  isLoading
);

// ── Table columns ─────────────────────────────────────────────────────────────

const columns: TableColumn[] = [
  { key: "when", label: "When", width: "w-24" },
  { key: "question", label: "Question" },
  { key: "answer", label: "Answer", width: "w-48" },
  { key: "who", label: "Who", width: "w-32" },
];

// Pre-computed checklist context per entry.
const checklistCache = computed(() => {
  const map = new Map<string, ChecklistContext>();
  for (const e of filteredEntries.value) {
    if (!isChecklist(e.rawAnswer) && !isChecklist(e.rawPreviousAnswer))
      continue;
    const prev = isChecklist(e.rawPreviousAnswer)
      ? (e.rawPreviousAnswer as ChecklistState)
      : null;
    const curr = isChecklist(e.rawAnswer)
      ? (e.rawAnswer as ChecklistState)
      : null;
    const items = e.checklistItems ?? [];
    const diff = checklistDiff(prev, curr);
    map.set(e.id, {
      prev,
      curr,
      items,
      diff,
      view: buildChecklistView(prev, curr, items, diff),
      summary: checklistCountSummary(prev, curr),
    });
  }
  return map;
});

const tableRows = computed<Record<string, unknown>[]>(() =>
  filteredEntries.value.map(toTableRow)
);
</script>

<template>
  <div class="space-y-3">
    <!-- Loading -->
    <div v-if="isLoading" class="border-default rounded-lg border">
      <div
        v-for="n in 4"
        :key="n"
        class="border-default flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
      >
        <div class="bg-muted h-3 w-16 animate-pulse rounded" />
        <div class="flex-1 space-y-1.5">
          <div class="bg-muted h-3 w-40 animate-pulse rounded" />
          <div class="bg-muted h-3 w-3/4 animate-pulse rounded" />
        </div>
        <div class="bg-muted h-5 w-14 animate-pulse rounded-full" />
        <div class="bg-muted h-5 w-20 animate-pulse rounded-full" />
      </div>
    </div>

    <!-- Sheet -->
    <DataTable
      v-else
      :columns="columns"
      :data="tableRows"
      row-key="_key"
      data-testid="recent-changes-table"
      title="Recent changes"
      item-noun="changes"
      :total-count="entries.length"
      :filtered-count="filteredEntries.length"
      aria-label="Recent changes"
    >
      <template #console>
        <SearchInput
          v-model="searchQuery"
          placeholder="Search questions..."
          aria-label="Search recent changes"
          class="w-56"
        />

        <UDropdownMenu
          :items="answerMenuItems"
          :modal="false"
          :portal="false"
          :content="{ align: 'start', sideOffset: 4 }"
        >
          <UButton
            color="neutral"
            variant="outline"
            trailing-icon="i-lucide-chevron-down"
            aria-label="Filter by answer"
            size="md"
            class="w-36 justify-between text-[15px] font-semibold"
            :class="{
              'border-primary/40 text-primary':
                answerFilterLabel !== 'All answers',
            }"
          >
            {{ answerFilterLabel }}
          </UButton>
        </UDropdownMenu>

        <UDropdownMenu
          v-if="pillarOptions.length > 1"
          :items="pillarMenuItems"
          :modal="false"
          :portal="false"
          :content="{ align: 'start', sideOffset: 4 }"
        >
          <UButton
            color="neutral"
            variant="outline"
            trailing-icon="i-lucide-chevron-down"
            aria-label="Filter by pillar"
            size="md"
            class="w-40 justify-between text-[15px] font-semibold"
            :class="{
              'border-primary/40 text-primary':
                pillarFilterLabel !== 'All pillars',
            }"
          >
            {{ pillarFilterLabel }}
          </UButton>
        </UDropdownMenu>

        <UDropdownMenu
          v-if="templateOptions.length > 1"
          :items="templateMenuItems"
          :modal="false"
          :portal="false"
          :content="{ align: 'start', sideOffset: 4 }"
        >
          <UButton
            color="neutral"
            variant="outline"
            trailing-icon="i-lucide-chevron-down"
            aria-label="Filter by template"
            size="md"
            class="w-44 justify-between text-[15px] font-semibold"
            :class="{
              'border-primary/40 text-primary':
                templateFilterLabel !== 'All templates',
            }"
          >
            {{ templateFilterLabel }}
          </UButton>
        </UDropdownMenu>
      </template>

      <template #footer-note>
        <p
          v-if="showTtlNotice"
          class="text-muted text-[13px]"
          data-testid="ttl-notice"
        >
          Last {{ LOCAL_TTL_DAYS }} days
        </p>
      </template>

      <template #empty>
        <div class="flex flex-col items-center gap-2 py-8">
          <Icon
            :name="
              entries.length === 0
                ? 'lucide:git-commit-horizontal'
                : 'lucide:search-x'
            "
            class="text-dimmed h-8 w-8"
          />
          <p class="text-muted text-sm">
            {{
              entries.length === 0
                ? "No changes yet."
                : "No matches for your filters."
            }}
          </p>
          <p v-if="entries.length === 0" class="text-muted text-[13px]">
            Answer questions to see activity here.
          </p>
        </div>
      </template>

      <!-- WHEN -->
      <template #cell-when="{ row }">
        <div
          v-for="entry in [toRecentChangeEntry(row)]"
          :key="entry.id"
          class="text-muted text-[15px] tabular-nums"
        >
          {{ formatRelativeTime(entry.updatedAt) }}
        </div>
      </template>

      <!-- QUESTION -->
      <template #cell-question="{ row }">
        <SyncRecentChangesQuestionCell
          v-for="entry in [toRecentChangeEntry(row)]"
          :key="entry.id"
          :entry="entry"
          :pillar-name="resolvePillarName(entry)"
        />
      </template>

      <!-- ANSWER -->
      <template #cell-answer="{ row }">
        <SyncRecentChangesAnswerCell
          v-for="entry in [toRecentChangeEntry(row)]"
          :key="entry.id"
          :entry="entry"
          :checklist-context="checklistCache.get(entry.id)"
        />
      </template>

      <!-- WHO -->
      <template #cell-who="{ row }">
        <SyncRecentChangesWhoCell
          v-for="entry in [toRecentChangeEntry(row)]"
          :key="entry.id"
          :entry="entry"
          :actor-name="resolveActorName(entry.actorId)"
        />
      </template>
    </DataTable>

    <!-- Load more row -->
    <button
      v-if="hasMore && !isLoadingMore"
      type="button"
      class="text-primary hover:text-primary/80 group flex w-full items-center justify-center gap-2 rounded-lg py-4 text-[15px] font-semibold transition-colors"
      @click="loadMore"
    >
      <Icon
        name="lucide:chevron-down"
        class="h-4 w-4 transition-transform group-hover:translate-y-0.5"
      />
      Load more changes
    </button>
    <div
      v-else-if="isLoadingMore"
      class="border-default flex items-center justify-center gap-2 rounded-lg border py-4"
    >
      <Icon
        name="lucide:loader-circle"
        class="text-muted h-4 w-4 animate-spin"
      />
      <span class="text-muted text-sm">Loading…</span>
    </div>
  </div>
</template>
