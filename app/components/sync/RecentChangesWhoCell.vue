<script setup lang="ts">
import type { RecentChangeEntry } from "~/composables/sync/useFieldVersions";
import { getAvatarColor, getInitials } from "~/utils/avatar";

defineProps<{ entry: RecentChangeEntry; actorName: string }>();
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      :class="[
        getAvatarColor(entry.actorId),
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
      ]"
      aria-hidden="true"
    >
      {{ getInitials(actorName) }}
    </div>
    <span class="text-default text-[15px]">
      {{ actorName }}
    </span>
  </div>
</template>
