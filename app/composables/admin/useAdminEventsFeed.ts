import { computed, ref, type Ref } from "vue";
import type { AdminEventRecord } from "~/admin/events";
import { fetchLocalAdminEvents } from "~/admin/localEvents";
import {
  compareAdminEvents,
  formatCategoryLabel,
  matchesAdminEventQuery,
} from "~/admin/formatters";

type FilterValue = "all" | string;
type EventSortDirection = "asc" | "desc";
type EventSortKey =
  | "time"
  | "actionLabel"
  | "subjectName"
  | "actorName"
  | "status";

const SUBJECT_TYPE_LABELS: Record<string, string> = {
  product: "Product",
  template: "Template",
  team: "Team",
  "product-review": "Product Review",
  "team-review": "Team Review",
  review: "Review",
};

const EVENT_SORT_KEYS = [
  "time",
  "actionLabel",
  "subjectName",
  "actorName",
  "status",
] as const satisfies readonly EventSortKey[];

interface SelectOption {
  label: string;
  value: string;
}

function isEventSortKey(value: string): value is EventSortKey {
  return EVENT_SORT_KEYS.includes(value as EventSortKey);
}

export function useAdminEventsFeed(
  remoteEvents: Ref<AdminEventRecord[] | null | undefined>
) {
  const searchQuery = ref("");
  const categoryFilter = ref<FilterValue>("all");
  const actionFilter = ref<FilterValue>("all");
  const statusFilter = ref<FilterValue>("all");
  const subjectTypeFilter = ref<FilterValue>("all");
  const sortBy = ref<EventSortKey>("time");
  const sortDirection = ref<EventSortDirection>("desc");
  const isDetailsOpen = ref(false);
  const selectedEventId = ref<string | null>(null);
  const localEvents = ref<AdminEventRecord[]>([]);

  const events = computed(() => {
    return [...localEvents.value, ...(remoteEvents.value ?? [])].toSorted(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );
  });

  const totalEvents = computed(() => events.value.length);
  const lifecycleCount = computed(
    () =>
      events.value.filter((event) =>
        ["lifecycle", "product", "template", "system"].includes(event.category)
      ).length
  );
  const destructiveCount = computed(
    () =>
      events.value.filter((event) => {
        return (
          event.action === "delete" ||
          event.action.endsWith(".deleted") ||
          event.action.includes("DeletedSynced")
        );
      }).length
  );
  const pendingCount = computed(
    () => events.value.filter((event) => event.status === "pending").length
  );

  const categoryOptions = computed<SelectOption[]>(() => {
    const categories = new Set(events.value.map((event) => event.category));

    return [
      { label: "All categories", value: "all" },
      ...[...categories].map((category) => ({
        label: formatCategoryLabel(category),
        value: category,
      })),
    ];
  });

  const actionOptions = computed<SelectOption[]>(() => {
    const actions = new Map(
      events.value.map((event) => [event.action, event.actionLabel])
    );

    return [
      { label: "All actions", value: "all" },
      ...[...actions.entries()].map(([value, label]) => ({ label, value })),
    ];
  });

  const subjectTypeOptions = computed<SelectOption[]>(() => {
    const types = new Map(
      events.value.map((event) => [event.subjectType, event.subjectTypeLabel])
    );

    return [
      { label: "All areas", value: "all" },
      ...[...types.entries()].map(([value, label]) => ({
        label: SUBJECT_TYPE_LABELS[value] ?? label,
        value,
      })),
    ];
  });

  const statusOptions = computed<SelectOption[]>(() => {
    const statuses = new Set(events.value.map((event) => event.status));

    return [
      { label: "All statuses", value: "all" },
      ...[...statuses].map((status) => ({
        label: status.charAt(0).toUpperCase() + status.slice(1),
        value: status,
      })),
    ];
  });

  const filteredEvents = computed(() => {
    return events.value
      .filter((event) => {
        if (
          categoryFilter.value !== "all" &&
          event.category !== categoryFilter.value
        ) {
          return false;
        }

        if (
          actionFilter.value !== "all" &&
          event.action !== actionFilter.value
        ) {
          return false;
        }

        if (
          statusFilter.value !== "all" &&
          event.status !== statusFilter.value
        ) {
          return false;
        }

        if (
          subjectTypeFilter.value !== "all" &&
          event.subjectType !== subjectTypeFilter.value
        ) {
          return false;
        }

        return matchesAdminEventQuery(event, searchQuery.value);
      })
      .toSorted((a, b) =>
        compareAdminEvents(a, b, sortBy.value, sortDirection.value)
      );
  });

  const selectedEvent = computed(() => {
    if (!selectedEventId.value) {
      return null;
    }

    return (
      events.value.find((event) => event.id === selectedEventId.value) ?? null
    );
  });

  const selectedEventDetails = computed(() => {
    if (!selectedEvent.value) {
      return "";
    }

    return JSON.stringify(selectedEvent.value.details, null, 2);
  });

  async function refreshLocalEvents(): Promise<void> {
    if (!import.meta.client) {
      return;
    }

    try {
      localEvents.value = await fetchLocalAdminEvents();
    } catch {
      localEvents.value = [];
    }
  }

  function handleSort(column: string): void {
    if (!isEventSortKey(column)) {
      return;
    }

    if (sortBy.value === column) {
      sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
      return;
    }

    sortBy.value = column;
    sortDirection.value = column === "time" ? "desc" : "asc";
  }

  function openEventDetails(eventId: string): void {
    selectedEventId.value = eventId;
    isDetailsOpen.value = true;
  }

  return {
    actionFilter,
    actionOptions,
    categoryFilter,
    categoryOptions,
    destructiveCount,
    events,
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
  };
}
