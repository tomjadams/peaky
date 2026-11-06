import {
  computed,
  toValue,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import type { LifecycleActor } from "~/lifecycle/management";

type LiveTailStatus = "idle" | "connecting" | "live" | "error";
type LiveTailStatusColor = "primary" | "secondary" | "error";

const LIVE_TAIL_STATUS_META = {
  connecting: {
    color: "primary",
    description:
      "Connecting to the server event stream so new admin events can appear without manual refresh.",
  },
  error: {
    color: "error",
    description:
      "The stream disconnected. EventSource will keep retrying while live tail stays enabled.",
  },
  idle: {
    color: "primary",
    description: "",
  },
  live: {
    color: "secondary",
    description:
      "New server-side audit events will refresh this page as they arrive. This complements local-first reads; it does not replace browser-local state.",
  },
} satisfies Record<
  LiveTailStatus,
  { color: LiveTailStatusColor; description: string }
>;

export function useAdminEventsLiveTail(
  actor: MaybeRefOrGetter<LifecycleActor>,
  onEvent: () => void | Promise<void>
) {
  const isEnabled = ref(false);
  const status = ref<LiveTailStatus>("idle");
  const connection = shallowRef<EventSource | null>(null);

  const statusColor = computed(() => LIVE_TAIL_STATUS_META[status.value].color);
  const statusDescription = computed(
    () => LIVE_TAIL_STATUS_META[status.value].description
  );

  const refreshEvents = () => {
    void onEvent();
  };

  const stop = () => {
    connection.value?.close();
    connection.value = null;
    status.value = "idle";
  };

  const start = () => {
    if (!import.meta.client || connection.value) {
      return;
    }

    status.value = "connecting";

    const currentActor = toValue(actor);
    const params = new URLSearchParams({
      actorId: currentActor.id,
      actorName: currentActor.name,
      actorRoles: currentActor.roles.join(","),
    });
    const eventSource = new EventSource(`/api/admin/events/stream?${params}`);

    eventSource.addEventListener("connected", () => {
      status.value = "live";
    });

    eventSource.addEventListener("admin-events", () => {
      status.value = "live";
      refreshEvents();
    });

    eventSource.addEventListener("error", () => {
      status.value = "error";
    });

    connection.value = eventSource;
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      refreshEvents();
    }
  };

  watch(isEnabled, (enabled) => {
    if (enabled) {
      start();
      return;
    }

    stop();
  });

  onMounted(() => {
    window.addEventListener("focus", refreshEvents);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  });

  onBeforeUnmount(() => {
    stop();
    window.removeEventListener("focus", refreshEvents);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  return {
    isEnabled,
    status,
    statusColor,
    statusDescription,
  };
}
