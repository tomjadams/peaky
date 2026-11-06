<template>
  <div
    class="layout bg-default relative flex min-h-screen w-full"
    :class="{ 'layout--sidebar-open': isOpen }"
  >
    <NavigationSidebar v-if="!isOpen" class="layout__nav-sidebar" />

    <div class="layout__main flex min-w-0 flex-1 flex-col">
      <AppHeader class="layout__header" />
      <!-- No overflow on main: the window is the app's one scroller (the
           layout is min-h-screen, so main can never overflow on its own).
           An overflow value here would silently disable position: sticky
           for every descendant — e.g. the review wizard's pinned toolbar. -->
      <main class="layout__content relative min-w-0 flex-1">
        <div class="layout__content-container content-container min-w-0">
          <slot />
        </div>
      </main>
    </div>

    <MoreInfoPanel />
    <LazyAppCommandPalette />
  </div>
</template>

<script setup>
import { useMoreInfoPanel } from "~/ui/useMoreInfoPanel";
import { useSyncClient } from "~/composables/sync/useSyncClient";
import { useSseClient } from "~/composables/sync/useSseClient";

const { isOpen, closeMoreInfoPanel } = useMoreInfoPanel();

// Starts the push→pull sync loop immediately on mount, then every 30 s and on
// tab focus. The composable is a singleton — only the first mount registers the
// interval; subsequent layout remounts are no-ops.
useSyncClient();
useSseClient();

// Simple keyboard shortcut for Escape
const handleKeyDown = (e) => {
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

<style scoped>
.layout--sidebar-open .layout__content-container {
  margin-left: 0;
  transition: margin 300ms ease-in-out;
}

.layout__content-container {
  transition: margin 300ms ease-in-out;
}
</style>
