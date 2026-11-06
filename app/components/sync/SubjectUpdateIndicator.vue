<template>
  <Transition
    enter-active-class="transition-opacity duration-150"
    leave-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <span
      v-if="isReceivingUpdate"
      class="text-muted inline-flex items-center gap-1.5 text-[13px]"
      data-testid="subject-update-indicator"
    >
      <span class="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
      Receiving updates…
    </span>
  </Transition>
</template>

<script setup lang="ts">
// TODO(GAP-8): the family-catalog contract made the SSE doorbell family-level,
// so this cue is now family-grained. Its final UX and placement (family-level
// vs per-subject vs dropped) and a possible rename are an open UX decision;
// the component is currently mounted nowhere. See formal_verification/sync/sse_gap_register.md.
import { computed } from "vue";
import { useSubjectUpdate } from "~/composables/sync/useSubjectUpdate";

const props = defineProps<{
  family: string | undefined;
}>();

const { isReceivingUpdate } = useSubjectUpdate(computed(() => props.family));
</script>
