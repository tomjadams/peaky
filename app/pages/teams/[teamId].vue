<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from "vue-router";

definePageMeta({
  breadcrumb: {
    label: (route: RouteLocationNormalizedLoaded) => {
      const teamId = String(route.params.teamId ?? "");

      return teamId
        .replace(/^team-/, "")
        .split("-")
        .map((segment) =>
          segment.length > 0
            ? `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`
            : ""
        )
        .join(" ");
    },
  },
});
</script>
