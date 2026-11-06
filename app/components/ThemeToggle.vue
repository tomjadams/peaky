<template>
  <UButton
    variant="ghost"
    color="neutral"
    :icon="effectiveColorMode === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
    :size="compact ? 'xs' : 'md'"
    :title="
      effectiveColorMode === 'dark'
        ? 'Switch to light mode'
        : 'Switch to dark mode'
    "
    @click="toggleColorMode"
  />
</template>

<script setup lang="ts">
import { useMounted } from "@vueuse/core";
import { nextColorMode, resolveColorMode } from "~/utils/colorMode";

defineProps<{
  compact?: boolean;
}>();

const isMounted = useMounted();
const colorMode = useColorMode();
const effectiveColorMode = computed(() =>
  isMounted.value ? resolveColorMode(colorMode.value) : "light"
);

const toggleColorMode = () => {
  colorMode.preference = nextColorMode(effectiveColorMode.value);
};
</script>
