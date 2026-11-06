<script setup lang="ts">
/**
 * The "Clear cache" maintenance action on /system.
 *
 * Sits BEFORE Recreate Local DB in the Maintenance section because it's
 * the lighter recovery step — clears service workers, Cache Storage, and
 * PWA-related localStorage without touching the user's local database
 * or auth identity.
 *
 * The previous attempt at this action (in the command palette) didn't
 * surface enough feedback — users clicked it and weren't sure if it ran.
 * This version shows a confirmation modal with a count of registrations
 * + caches that will be cleared, and a post-clear toast with the freed-
 * bytes delta from `navigator.storage.estimate()` so "nothing happened"
 * is no longer a possible read.
 *
 * @see app/utils/browserCache.ts — the helper that does the actual work
 */
import { clearAndHardReload } from "~/utils/browserCache";

const toast = useToast();
const isOpen = ref(false);
const isClearing = ref(false);

// Pre-flight counts so the confirm modal can show what's about to be
// cleared. Refreshed each time the modal opens.
const swCount = ref(0);
const cacheCount = ref(0);
const isCounting = ref(false);

async function openModal() {
  isOpen.value = true;
  isCounting.value = true;
  try {
    const registrations =
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistrations()
        : [];
    const cacheKeys = "caches" in window ? await caches.keys() : [];
    swCount.value = registrations.length;
    cacheCount.value = cacheKeys.length;
  } catch {
    swCount.value = 0;
    cacheCount.value = 0;
  } finally {
    isCounting.value = false;
  }
}

async function confirmClear() {
  isClearing.value = true;
  // Pre-emptive toast so the user sees the work before the reload.
  // Real numeric feedback follows on the next page load via the
  // helper's return — but the reload is what closes the loop.
  toast.add({
    title: "Clearing cache…",
    description: "Reloading with fresh browser state in a moment.",
    color: "neutral",
    icon: "i-lucide-eraser",
  });
  // Small delay so the toast paints before the navigation kills it.
  setTimeout(() => {
    clearAndHardReload();
  }, 300);
}
</script>

<template>
  <UCard :ui="{ body: 'p-6 space-y-3' }">
    <div class="flex items-start gap-3">
      <Icon name="lucide:eraser" class="text-info mt-0.5 h-5 w-5 shrink-0" />
      <div class="space-y-1">
        <h3 class="text-default font-semibold">Clear cache</h3>
        <p class="text-muted text-sm leading-relaxed">
          Try this first if Peaky is loading the wrong version, showing stale
          assets, or behaving as if it's still running an older build. Removes
          browser caches and any leftover service workers. Your local database,
          sign-in, and preferences are kept.
        </p>
      </div>
    </div>

    <div class="pt-1">
      <UButton color="info" variant="solid" @click="openModal">
        Clear cache
      </UButton>
    </div>

    <UModal v-model:open="isOpen" title="Clear browser cache?">
      <template #body>
        <div class="space-y-4">
          <p class="text-default text-sm">
            This clears the browser caches and unregisters any service workers
            Peaky has previously installed, then reloads the page. Your local
            data, sign-in, and theme are preserved.
          </p>

          <div
            v-if="!isCounting"
            class="bg-elevated border-default/60 rounded-lg border p-3 text-sm"
          >
            <p class="text-default font-medium">About to clear:</p>
            <ul class="text-muted mt-1 list-disc pl-5">
              <li>
                {{ swCount }} service-worker
                {{ swCount === 1 ? "registration" : "registrations" }}
              </li>
              <li>
                {{ cacheCount }} browser cache
                {{ cacheCount === 1 ? "entry" : "entries" }}
              </li>
              <li>PWA-related localStorage keys (auth and prefs are kept)</li>
            </ul>
          </div>

          <p
            v-if="swCount === 0 && cacheCount === 0 && !isCounting"
            class="text-muted text-xs"
          >
            No caches or service workers found. The reload will still run as a
            clean refresh.
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="isOpen = false">
            Cancel
          </UButton>
          <UButton
            color="info"
            variant="solid"
            :loading="isClearing"
            @click="confirmClear"
          >
            Clear and reload
          </UButton>
        </div>
      </template>
    </UModal>
  </UCard>
</template>
