<template>
  <div class="bg-default min-h-screen w-full">
    <slot />

    <!-- Below the xl breakpoint the survey has no inline info rail; its
         "Why this matters" button opens this overlay panel instead. -->
    <MoreInfoPanel />
  </div>
</template>

<script setup lang="ts">
import { useMoreInfoPanel } from "~/ui/useMoreInfoPanel";
import { useSyncClient } from "~/composables/sync/useSyncClient";
import { useSseClient } from "~/composables/sync/useSseClient";

const { isOpen, closeMoreInfoPanel } = useMoreInfoPanel();

// Starts the push→pull sync loop immediately on mount, then every 30 s and on
// tab focus. The composable is a singleton — only the first mount registers the
// interval; subsequent layout remounts are no-ops.
useSyncClient();
useSseClient();

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && isOpen.value) {
    closeMoreInfoPanel();
  }
};

onMounted(() => {
  document.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown);
});
</script>
