<template>
  <header
    ref="headerElement"
    class="header border-default bg-default sticky top-0 z-30 flex flex-col gap-4 border-b px-4 py-4 sm:px-6 xl:px-8"
  >
    <div
      class="header__content flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="header__branding flex min-w-0 flex-col">
        <nav
          class="header__breadcrumbs mb-1 hidden xl:block"
          aria-label="Breadcrumb"
        >
          <ol class="flex items-center gap-2 text-sm">
            <li
              v-for="(crumb, index) in breadcrumbs"
              :key="index"
              class="flex items-center gap-2"
            >
              <NuxtLink
                v-if="crumb.to"
                :to="crumb.to"
                class="text-muted hover:text-highlighted"
              >
                {{ crumb.label }}
              </NuxtLink>
              <span
                v-else
                class="text-highlighted"
                :aria-current="
                  index === breadcrumbs.length - 1 ? 'page' : undefined
                "
              >
                {{ crumb.label }}
              </span>
              <Icon
                v-if="index < breadcrumbs.length - 1"
                name="lucide:chevron-right"
                class="text-dimmed h-3 w-3"
                aria-hidden="true"
              />
            </li>
          </ol>
        </nav>
        <h1 class="header__title text-highlighted truncate text-xl font-bold">
          {{ title || "Peaky" }}
        </h1>
      </div>
      <div
        class="header__actions flex shrink-0 items-center gap-2 self-end sm:self-auto xl:gap-4"
      >
        <UButton
          v-if="headerCTA"
          class="header__cta shrink-0"
          color="primary"
          variant="solid"
          :icon="headerCTA.icon"
          :loading="headerCTA.loading"
          data-testid="assessment-save"
          @click="headerCTA.onClick()"
        >
          {{ headerCTA.label }}
        </UButton>
        <UButton
          class="header__command-trigger shrink-0"
          variant="outline"
          color="neutral"
          aria-label="Open command palette"
          icon="i-lucide-sparkles"
          @click="openCommandPalette"
        >
          <span class="hidden font-medium xl:inline">Quick actions</span>
          <kbd
            class="border-default bg-default hidden rounded border px-1.5 py-0.5 text-[13px] font-medium xl:inline"
          >
            {{ isMac ? "⌘" : "Ctrl" }}K
          </kbd>
        </UButton>
        <SyncStatusIndicator class="header__sync-status !h-11 !w-11 shrink-0" />
        <UButton
          v-if="showSurveyMode"
          class="header__mode-toggle shrink-0"
          :variant="currentMode === 'survey' ? 'solid' : 'outline'"
          :color="currentMode === 'survey' ? 'neutral' : 'neutral'"
          icon="i-lucide-clipboard-list"
          aria-label="Survey mode"
          @click="toggleSurveyMode"
        >
          <span class="hidden xl:inline">Survey mode</span>
        </UButton>
        <ThemeToggle class="header__theme-toggle shrink-0" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { usePageHeader } from "~/composables/nav/usePageHeader";
import { useBreadcrumbs } from "~/composables/nav/useBreadcrumbs";
import { useCommandPalette } from "~/composables/nav/useCommandPalette";

const route = useRoute();

const { title, showSurveyMode, headerCTA } = usePageHeader();
const { breadcrumbs } = useBreadcrumbs();
const { open: openCommandPalette } = useCommandPalette();

const headerElement = ref<HTMLElement | null>(null);
let headerResizeObserver: ResizeObserver | null = null;

const isMac = computed(() => {
  if (import.meta.server) return true;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
});

const isSurveyPage = computed(() => {
  return route.path.endsWith("/survey");
});

const currentMode = computed(() => {
  return isSurveyPage.value ? "survey" : "default";
});

const publishHeaderHeight = () => {
  const height = headerElement.value?.getBoundingClientRect().height ?? 0;
  if (height <= 0) return;
  document.documentElement.style.setProperty(
    "--app-header-height",
    `${Math.ceil(height)}px`
  );
};

const toggleSurveyMode = () => {
  const appId = route.params.appId;
  const teamId = route.params.teamId;
  const productId = route.params.productId;
  const reviewId = route.params.reviewId;
  const isTeamRoute = route.path.startsWith("/teams/");
  const isAppRoute = route.path.startsWith("/applications/");

  if (isSurveyPage.value) {
    // Navigate from survey back to assessment
    if (isTeamRoute) {
      navigateTo({
        name: "team-review-assessment",
        params: { teamId, reviewId },
      });
    } else if (isAppRoute) {
      navigateTo({
        name: "app-review-assessment",
        params: { appId, reviewId },
      });
    } else {
      navigateTo({
        name: "product-review-assessment",
        params: { productId, reviewId },
      });
    }
  } else {
    // Navigate from assessment to survey
    if (isTeamRoute) {
      navigateTo({ name: "team-review-survey", params: { teamId, reviewId } });
    } else if (isAppRoute) {
      navigateTo({ name: "app-review-survey", params: { appId, reviewId } });
    } else {
      navigateTo({
        name: "product-review-survey",
        params: { productId, reviewId },
      });
    }
  }
};

onMounted(() => {
  publishHeaderHeight();
  if (typeof ResizeObserver === "undefined" || !headerElement.value) return;
  headerResizeObserver = new ResizeObserver(publishHeaderHeight);
  headerResizeObserver.observe(headerElement.value);
});

onUnmounted(() => {
  headerResizeObserver?.disconnect();
  document.documentElement.style.removeProperty("--app-header-height");
});
</script>
