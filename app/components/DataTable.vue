<template>
  <div class="data-table-surface overflow-hidden rounded-lg border">
    <div
      v-if="title || $slots.console"
      class="border-muted flex flex-wrap items-center justify-between gap-4 border-b px-6 pt-5 pb-4 min-[1920px]:px-8 min-[1920px]:pt-6 min-[1920px]:pb-5"
    >
      <h2
        v-if="title"
        class="text-highlighted text-base font-semibold min-[1920px]:text-lg"
      >
        {{ title }}
      </h2>
      <div v-if="$slots.console" class="flex flex-wrap items-center gap-3">
        <slot name="console" />
      </div>
    </div>
    <table class="divide-default min-w-full divide-y" :aria-label="ariaLabel">
      <thead class="border-accented dark:border-default border-b">
        <tr>
          <th v-if="selectable" scope="col" class="w-12 px-4 py-3 first:pl-6">
            <UCheckbox
              :model-value="
                allSelected ? true : someSelected ? 'indeterminate' : false
              "
              aria-label="Select all rows"
              :ui="{
                base: 'dark:border-slate-400',
              }"
              @update:model-value="emit('toggle-all')"
            />
          </th>
          <th
            v-for="col in columns"
            :key="col.key"
            scope="col"
            class="text-muted dark:text-dimmed px-4 py-3 text-sm font-semibold first:pl-6 last:pr-6 min-[1920px]:px-5 min-[1920px]:py-4 min-[1920px]:text-base min-[1920px]:first:pl-8 min-[1920px]:last:pr-8"
            :class="[
              col.width,
              col.headerClass,
              col.align === 'right' || col.key === 'actions'
                ? 'text-right'
                : col.align === 'center'
                  ? 'text-center'
                  : 'text-left',
            ]"
          >
            <button
              v-if="col.sortable"
              type="button"
              class="group inline-flex items-center gap-1.5"
              @click="emit('sort', col.key)"
            >
              {{ col.label }}
              <Icon
                v-if="sortBy === col.key"
                :name="
                  sortDirection === 'desc'
                    ? 'lucide:arrow-down'
                    : 'lucide:arrow-up'
                "
                class="text-primary h-3.5 w-3.5"
              />
              <Icon
                v-else
                name="lucide:arrow-up-down"
                class="text-dimmed h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            </button>
            <span
              v-else-if="col.key === 'actions' && !col.showLabel"
              class="sr-only"
            >
              {{ col.label }}
            </span>
            <span v-else>{{ col.label }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-muted dark:divide-default divide-y">
        <template v-if="data.length === 0">
          <tr>
            <td :colspan="totalColumns" class="px-4 py-8">
              <slot name="empty">
                <div class="flex flex-col items-center gap-2">
                  <Icon name="lucide:inbox" class="text-dimmed h-10 w-10" />
                  <p class="text-muted text-sm">{{ resolvedEmptyMessage }}</p>
                </div>
              </slot>
            </td>
          </tr>
        </template>
        <TransitionGroup v-else name="dt-row">
          <tr
            v-for="row in data"
            :key="String(row[rowKey])"
            class="hover:bg-muted transition-colors dark:hover:bg-white/[0.04]"
            :class="{ 'cursor-pointer': clickableRows }"
            :tabindex="clickableRows ? 0 : undefined"
            @click="handleRowClick($event, row)"
            @keydown.enter="handleRowClick($event, row)"
          >
            <td
              v-if="selectable"
              class="w-12 px-4 py-4.5 first:pl-6"
              @click.stop
            >
              <UCheckbox
                :model-value="selectedIds.has(String(row[rowKey]))"
                aria-label="Select row"
                :ui="{
                  base: 'dark:border-slate-400',
                }"
                @update:model-value="
                  emit('toggle-selection', String(row[rowKey]))
                "
              />
            </td>
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-4.5 first:pl-6 last:pr-6 min-[1920px]:px-5 min-[1920px]:py-5 min-[1920px]:first:pl-8 min-[1920px]:last:pr-8"
              :data-column="col.key"
              :class="[
                col.width,
                (col.align === 'right' || col.key === 'actions') &&
                  'text-right',
                col.align === 'center' && 'text-center',
              ]"
            >
              <slot
                v-if="$slots[`cell-${col.key}`]"
                :name="`cell-${col.key}`"
                :row="row"
                :value="row[col.key]"
                :column="col"
              />
              <template v-else>
                <!-- Status cell -->
                <UBadge
                  v-if="col.type === 'status'"
                  :color="getStatusColor(row[col.key], col.statusColors)"
                  variant="subtle"
                  size="sm"
                  class="whitespace-nowrap min-[1920px]:px-2.5 min-[1920px]:py-1.5 min-[1920px]:text-sm"
                >
                  {{ getStatusDisplay(row[col.key]) }}
                </UBadge>

                <!-- Progress cell -->
                <div
                  v-else-if="col.type === 'progress'"
                  class="flex items-center gap-2"
                >
                  <div class="bg-border h-1 w-20 overflow-hidden rounded-full">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="
                        getProgressValue(row[col.key]) === 100
                          ? 'bg-success'
                          : 'bg-primary-600 dark:bg-primary-400'
                      "
                      :style="{ width: `${getProgressValue(row[col.key])}%` }"
                      role="progressbar"
                      :aria-valuenow="getProgressValue(row[col.key])"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      :aria-label="`${getProgressValue(row[col.key])}% complete`"
                    />
                  </div>
                  <span
                    class="text-muted text-sm tabular-nums min-[1920px]:text-base"
                  >
                    {{ getProgressValue(row[col.key]) }}%
                  </span>
                </div>

                <!-- Date cell -->
                <ClientOnly v-else-if="col.type === 'date'">
                  <div
                    class="text-muted text-base min-[1920px]:text-[17px]"
                    :title="formatRelativeDate(row[col.key]).full"
                  >
                    {{ formatRelativeDate(row[col.key]).relative }}
                  </div>
                  <template #fallback>
                    <div class="text-muted text-base">
                      {{ formatRelativeDate(row[col.key]).fallback }}
                    </div>
                  </template>
                </ClientOnly>

                <!-- Avatar group cell -->
                <template v-else-if="col.type === 'avatar-group'">
                  <span
                    v-if="
                      !Array.isArray(row[col.key]) ||
                      (row[col.key] as unknown[]).length === 0
                    "
                    class="text-dimmed text-base"
                  >
                    —
                  </span>
                  <UTooltip
                    v-else
                    :text="getAvatarNames(row[col.key]).join(', ')"
                  >
                    <div class="flex items-center -space-x-2">
                      <div
                        v-for="(name, idx) in getAvatarNames(
                          row[col.key]
                        ).slice(0, 3)"
                        :key="idx"
                        class="border-default relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium"
                        :class="getAvatarColor(name)"
                      >
                        {{ getInitials(name) }}
                      </div>
                      <div
                        v-if="getAvatarNames(row[col.key]).length > 3"
                        class="bg-muted text-muted border-muted relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium"
                      >
                        +{{ getAvatarNames(row[col.key]).length - 3 }}
                      </div>
                    </div>
                  </UTooltip>
                </template>

                <!-- Actions cell -->
                <div
                  v-else-if="col.type === 'actions'"
                  class="flex items-center justify-end gap-1"
                >
                  <UTooltip
                    v-for="action in col.actions ?? [
                      { id: 'view', icon: 'lucide:eye', label: 'View' },
                    ]"
                    :key="action.id"
                    :text="action.label"
                  >
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      :icon="action.icon.replace('lucide:', 'i-lucide-')"
                      :aria-label="action.label"
                      @click.stop="emit('action', action.id, row)"
                    />
                  </UTooltip>
                </div>

                <!-- Default text cell -->
                <div
                  v-else
                  class="text-default text-base min-[1920px]:text-[17px]"
                >
                  {{
                    row[col.key] === null || row[col.key] === undefined
                      ? "-"
                      : row[col.key]
                  }}
                </div>
              </template>
            </td>
          </tr>
        </TransitionGroup>
      </tbody>
    </table>
    <div
      v-if="totalCount !== undefined"
      class="border-muted flex min-h-14 items-center justify-between gap-4 border-t px-6 py-3"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p class="text-muted text-sm tabular-nums">{{ countLabel }}</p>
        <slot name="footer-note" />
      </div>
      <div class="flex items-center gap-3">
        <slot name="footer-trailing" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getInitials, getAvatarColor } from "~/utils/avatar";

export type CellType =
  | "text"
  | "status"
  | "progress"
  | "date"
  | "avatar-group"
  | "actions";

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  type?: CellType;
  width?: string;
  headerClass?: string;
  align?: "left" | "center" | "right";
  statusColors?: Record<string, string>;
  showLabel?: boolean;
  actions?: Array<{ id: string; icon: string; label: string }>;
}

export type TableColumn = DataTableColumn;

interface Props {
  columns: DataTableColumn[];
  data: Record<string, unknown>[];
  rowKey?: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  clickableRows?: boolean;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  emptyMessage?: string;
  /** Shown instead of `emptyMessage` when filters/search zero out a non-empty dataset. */
  filteredEmptyMessage?: string;
  ariaLabel?: string;
  /** Sheet title, rendered in the title block above the table. */
  title?: string;
  /** Noun used in the footer count, e.g. "teams". Defaults to "items". */
  itemNoun?: string;
  /** Unfiltered row count. Presence of this prop renders the footer rail. */
  totalCount?: number;
  /** Row count after search/filters — enables the "K of N" footer phrasing. */
  filteredCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  rowKey: "id",
  selectable: false,
  selectedIds: () => new Set(),
  clickableRows: false,
  sortBy: "",
  sortDirection: "asc",
  emptyMessage: "No data available",
  filteredEmptyMessage: undefined,
  ariaLabel: "Data table",
  title: undefined,
  itemNoun: "items",
  totalCount: undefined,
  filteredCount: undefined,
});

const emit = defineEmits<{
  "toggle-all": [];
  "toggle-selection": [id: string];
  sort: [key: string];
  "row-click": [row: Record<string, unknown>];
  action: [action: string, row: Record<string, unknown>];
}>();

const totalColumns = computed(
  () => props.columns.length + (props.selectable ? 1 : 0)
);

const allSelected = computed(
  () =>
    props.data.length > 0 &&
    props.data.every((row) => props.selectedIds.has(String(row[props.rowKey])))
);

const someSelected = computed(
  () =>
    props.data.some((row) =>
      props.selectedIds.has(String(row[props.rowKey]))
    ) && !allSelected.value
);

const resolvedEmptyMessage = computed(() => {
  if (
    props.filteredEmptyMessage &&
    props.filteredCount === 0 &&
    (props.totalCount ?? 0) > 0
  ) {
    return props.filteredEmptyMessage;
  }
  return props.emptyMessage;
});

const countLabel = computed(() => {
  const total = props.totalCount ?? 0;
  // itemNoun arrives plural ("teams"); strip the s for a count of one.
  const noun = (n: number) =>
    n === 1 ? props.itemNoun.replace(/s$/, "") : props.itemNoun;
  if (props.filteredCount !== undefined && props.filteredCount < total) {
    return `${props.filteredCount} of ${total} ${noun(total)}`;
  }
  return `${total} ${noun(total)}`;
});

function handleRowClick(
  event: MouseEvent | KeyboardEvent,
  row: Record<string, unknown>
) {
  if (!props.clickableRows) return;

  const target = event.target;
  if (
    target instanceof Element &&
    target.closest(
      "button, a, input, select, textarea, [role='button'], [data-column='actions']"
    )
  ) {
    return;
  }

  emit("row-click", row);
}

function getStatusDisplay(value: unknown): string {
  if (value === null || value === undefined) return "-";
  return String(value)
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type BadgeColor =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

function getStatusColor(
  value: unknown,
  statusColors?: Record<string, string>
): BadgeColor {
  const status = String(value ?? "").toLowerCase();
  if (statusColors?.[status]) return statusColors[status]! as BadgeColor;

  switch (status) {
    case "completed":
    case "ready":
    case "active":
      return "success";
    case "in-progress":
    case "in_progress":
    case "pending":
      return "primary";
    case "draft":
    case "inactive":
      return "neutral";
    case "action_needed":
    case "error":
    case "failed":
      return "error";
    default:
      return "neutral";
  }
}

function getProgressValue(value: unknown): number {
  const raw = Number(value);
  return Number.isNaN(raw) ? 0 : Math.min(100, Math.max(0, Math.round(raw)));
}

function getAvatarNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

function formatRelativeDate(value: unknown): {
  relative: string;
  full: string;
  fallback: string;
} {
  if (!value) return { relative: "-", full: "", fallback: "-" };
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime()))
    return { relative: "-", full: "", fallback: "-" };

  const full = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  const fallback = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  let relative: string;
  if (diffMins < 1) relative = "Just now";
  else if (diffMins < 60)
    relative = `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
  else if (diffHours < 24)
    relative = `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  else if (diffDays < 7)
    relative = `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  else if (diffWeeks < 4)
    relative = `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  else if (diffMonths < 12)
    relative = `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  else relative = fallback;

  return { relative, full, fallback };
}
</script>

<style scoped>
.dt-row-enter-active {
  transition: opacity 200ms ease;
}
.dt-row-enter-from {
  opacity: 0;
}
</style>
