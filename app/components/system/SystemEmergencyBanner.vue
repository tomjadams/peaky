<script setup lang="ts">
/**
 * Conditional emergency banner shown above the status tiles when the
 * local DB failed to bootstrap. Reuses the existing `local-db-error`
 * useState surface (set by the local-db plugin's onError callback).
 *
 * Two actions:
 * - "Recreate local DB" — sets the LOCAL_STORAGE_CLEAR_FLAG and reloads.
 * - "Try again" — clears the persisted error and reloads without
 *   destroying local data, in case the failure was transient.
 *
 * Reassuring copy is non-negotiable: server data is safe.
 */
const LOCAL_STORAGE_CLEAR_FLAG = "peaky-clear-db-on-reload";
const LOCAL_STORAGE_ERROR_KEY = "peaky-db-bootstrap-error";

const dbError = useState<{
  message: string;
  at: string;
  migrationId?: string;
} | null>("local-db-error", () => null);

// SSR safety: useState('local-db-error') is always null on the server,
// so v-if="dbError" hides the banner before these handlers can fire.
// No `typeof window` guard needed — the click cannot reach SSR.

function recreate() {
  localStorage.setItem(LOCAL_STORAGE_CLEAR_FLAG, "1");
  localStorage.removeItem(LOCAL_STORAGE_ERROR_KEY);
  window.location.reload();
}

function tryAgain() {
  localStorage.removeItem(LOCAL_STORAGE_ERROR_KEY);
  window.location.reload();
}
</script>

<template>
  <UAlert
    v-if="dbError"
    color="error"
    variant="subtle"
    icon="i-lucide-shield-alert"
    title="Local database is having trouble"
    role="alert"
  >
    <template #description>
      <div class="space-y-3">
        <p>
          Peaky couldn't open your local database.
          <strong>Your data on the server is safe.</strong>
          Most often this fixes itself by recreating the local copy.
        </p>
        <p class="text-muted font-mono text-xs">
          Error: {{ dbError.message
          }}<span v-if="dbError.migrationId"> · {{ dbError.migrationId }}</span>
          <span class="text-dimmed"> · {{ dbError.at }}</span>
        </p>
        <div class="flex flex-wrap gap-2 pt-1">
          <UButton color="error" variant="solid" size="sm" @click="recreate">
            Recreate local DB
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            @click="tryAgain"
          >
            Try again
          </UButton>
        </div>
      </div>
    </template>
  </UAlert>
</template>
