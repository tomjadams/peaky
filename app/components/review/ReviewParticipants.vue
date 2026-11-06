<script setup lang="ts">
import { getInitials, getAvatarColor } from "~/utils/avatar";
import type { ReviewParticipant } from "~/models";
import { catalogUserUrl } from "~/utils/catalog";

interface Props {
  assessors: ReviewParticipant[];
  advisors: ReviewParticipant[];
}

defineProps<Props>();
</script>

<template>
  <div
    v-if="assessors.length > 0 || advisors.length > 0"
    class="mb-6 flex flex-wrap items-center gap-6"
  >
    <div v-if="assessors.length > 0" class="flex items-center gap-2">
      <div class="text-muted flex items-center gap-1.5 text-[15px] font-medium">
        <Icon name="lucide:users" class="h-4 w-4" />
        <span>Team</span>
      </div>
      <div class="flex -space-x-2">
        <a
          v-for="member in assessors.slice(0, 4)"
          :key="member.id"
          :href="catalogUserUrl(member.id)"
          target="_blank"
          rel="noreferrer"
          :title="`${member.name} (${member.id})`"
          class="border-primary/30 relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-[13px] font-bold"
          :class="getAvatarColor(member.name)"
        >
          {{ getInitials(member.name) }}
        </a>
        <div
          v-if="assessors.length > 4"
          class="bg-muted text-muted border-muted relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-[13px] font-medium"
        >
          +{{ assessors.length - 4 }}
        </div>
      </div>
    </div>

    <div v-if="advisors.length > 0" class="flex items-center gap-2">
      <div class="text-muted flex items-center gap-1.5 text-[15px] font-medium">
        <Icon name="lucide:graduation-cap" class="h-4 w-4" />
        <span>Advisors</span>
      </div>
      <div class="flex -space-x-2">
        <div
          v-for="advisor in advisors.slice(0, 2)"
          :key="advisor.id"
          class="border-primary relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-[13px] font-bold"
          :class="getAvatarColor(advisor.name)"
        >
          {{ getInitials(advisor.name) }}
        </div>
      </div>
    </div>
  </div>
</template>
