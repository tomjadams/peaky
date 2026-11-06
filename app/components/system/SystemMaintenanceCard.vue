<script setup lang="ts">
/**
 * The single Maintenance action on /system: Recreate local DB.
 *
 * Reuses the existing LOCAL_STORAGE_CLEAR_FLAG flow so the plugin clears
 * OPFS on the next reload. We do NOT clear OPFS inline — the plugin owns
 * that pre-init step. Setting the flag and reloading is enough.
 *
 * The confirmation modal surfaces the unsynced outbox count so the user
 * can choose to sync first (today: just close the modal — push happens on
 * the next visibility tick anyway).
 *
 * Reassuring copy is non-negotiable: "this affects only your browser, your
 * server data is safe and re-downloads automatically".
 */
import { withDatabase, localOutbox, eq } from "~/local-db";

const LOCAL_STORAGE_CLEAR_FLAG = "peaky-clear-db-on-reload";
const LOCAL_STORAGE_ERROR_KEY = "peaky-db-bootstrap-error";

const isOpen = ref(false);
const pendingCount = ref(0);
const isCounting = ref(false);

async function openModal() {
  isOpen.value = true;
  isCounting.value = true;
  try {
    const rows = await withDatabase(async (db) => {
      return db
        .select({ id: localOutbox.id })
        .from(localOutbox)
        .where(eq(localOutbox.status, "pending"));
    });
    pendingCount.value = rows.length;
  } catch {
    pendingCount.value = 0;
  } finally {
    isCounting.value = false;
  }
}

// SSR safety: this handler runs from a UModal action button which only
// renders client-side. No `typeof window` guard needed.
function confirmRecreate() {
  localStorage.setItem(LOCAL_STORAGE_CLEAR_FLAG, "1");
  localStorage.removeItem(LOCAL_STORAGE_ERROR_KEY);
  window.location.reload();
}
</script>

<template>
  <UCard :ui="{ body: 'p-6 space-y-3' }">
    <div class="flex items-start gap-3">
      <Icon
        name="lucide:alert-triangle"
        class="text-warning mt-0.5 h-5 w-5 shrink-0"
      />
      <div class="space-y-1">
        <h3 class="text-default font-semibold">Recreate local database</h3>
        <p class="text-muted text-sm leading-relaxed">
          Use this if Peaky feels stuck, slow, or out of date on this device.
          This affects only your browser — your data on the server is safe and
          re-downloads automatically the next time you sign in.
        </p>
      </div>
    </div>

    <div class="pt-1">
      <UButton color="warning" variant="solid" @click="openModal">
        Recreate local DB
      </UButton>
    </div>

    <UModal v-model:open="isOpen" title="Recreate local database?">
      <template #body>
        <div class="space-y-4">
          <p class="text-default text-sm">
            This clears your local copy of the database and reloads Peaky. Your
            data on the server is safe — it will re-download on the next sync.
          </p>

          <UAlert
            v-if="pendingCount > 0"
            color="warning"
            variant="subtle"
            icon="i-lucide-cloud-off"
            :title="`${pendingCount} unsynced ${pendingCount === 1 ? 'change' : 'changes'} will be lost`"
            description="Recreating now will discard work that hasn't reached the server yet. You can wait for the next sync (every 30 seconds) and try again."
          />

          <p v-else-if="!isCounting" class="text-muted text-sm">
            All your local changes have synced. Safe to recreate.
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="isOpen = false">
            Cancel
          </UButton>
          <UButton color="warning" variant="solid" @click="confirmRecreate">
            Recreate anyway
          </UButton>
        </div>
      </template>
    </UModal>
  </UCard>
</template>
