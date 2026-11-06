import type { Ref } from "vue";
import { scheduleWhenBrowserIdle } from "~/utils/schedule";

export interface Application {
  id: string;
  name: string;
  status: "ready" | "in_progress" | "action_needed";
  owner: string;
  teamId: string;
  orgId: string;
  orgName: string;
  productId: string;
  productName: string;
  lastUpdated: string;
  progress: number;
  [key: string]: unknown; // Explicit index signature
}

interface UseApplicationsOptions {
  initialRemoteApplications?: Ref<Application[] | null>;
  remotePending?: Ref<boolean>;
  remoteError?: Ref<Error | null | undefined>;
  refreshRemote?: () => Promise<unknown>;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function fetchLocalApplications(): Promise<Application[]> {
  return [];
}

export async function fetchRemoteApplications(): Promise<Application[]> {
  return $fetch<Application[]>("/api/applications");
}

function mergeApplications(
  remoteApplications: Application[],
  localApplications: Application[]
): Application[] {
  const mergedApplications = new Map<string, Application>();

  for (const application of remoteApplications) {
    mergedApplications.set(application.id, application);
  }

  for (const application of localApplications) {
    mergedApplications.set(application.id, application);
  }

  return [...mergedApplications.values()];
}

export const useApplications = (options: UseApplicationsOptions = {}) => {
  const remoteApplications =
    options.initialRemoteApplications ?? ref<Application[] | null>(null);
  const remotePending = options.remotePending ?? ref(false);
  const remoteError = options.remoteError ?? ref<Error | null>(null);
  const applications = ref<Application[]>(remoteApplications.value ?? []);
  const localApplications = ref<Application[]>([]);
  const localPending = ref(false);

  const syncApplications = () => {
    applications.value = mergeApplications(
      remoteApplications.value ?? [],
      localApplications.value
    );
  };

  const hydrateLocalApplications = async (): Promise<void> => {
    if (!import.meta.client) {
      return;
    }

    localPending.value = true;

    try {
      localApplications.value = await fetchLocalApplications();
      syncApplications();
    } catch (localError) {
      console.warn(
        "[useApplications] Failed to load local applications:",
        localError
      );
    } finally {
      localPending.value = false;
    }
  };

  const refreshRemoteApplications =
    options.refreshRemote ??
    (async () => {
      remotePending.value = true;
      remoteError.value = null;

      try {
        remoteApplications.value = await fetchRemoteApplications();
      } catch (error) {
        remoteError.value = toError(error);
      } finally {
        remotePending.value = false;
      }
    });

  const refresh = async (): Promise<void> => {
    await Promise.allSettled([
      refreshRemoteApplications(),
      hydrateLocalApplications(),
    ]);
    syncApplications();
  };

  watch(
    remoteApplications,
    () => {
      syncApplications();
    },
    { immediate: true }
  );

  if (!options.initialRemoteApplications) {
    void refreshRemoteApplications();
  }

  if (import.meta.client) {
    scheduleWhenBrowserIdle(() => hydrateLocalApplications(), {
      timeoutMs: 3000,
    });
  }

  const pending = computed(() => {
    return (
      (remotePending.value || localPending.value) &&
      applications.value.length === 0
    );
  });

  const error = computed(() => {
    if (pending.value || localApplications.value.length > 0) {
      return null;
    }

    return remoteError.value ?? null;
  });

  return {
    applications,
    pending,
    error,
    refresh,
  };
};
