import {
  computed,
  ref,
  toValue,
  watchEffect,
  type MaybeRef,
  type Ref,
} from "vue";
import { refDebounced } from "@vueuse/core";
import type { Pillar } from "~/models/pillar";
import type { RecentChangeEntry } from "~/composables/sync/useFieldVersions";
import { LOCAL_TTL_DAYS } from "~/services/sync/LocalTTL";

const answerOptions = [
  { label: "All answers", value: "all" },
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
  { label: "N/A", value: "na" },
];

const makeMenuItems = (
  options: { label: string; value: string }[],
  current: Ref<string>
) =>
  options.map((opt) => ({
    label: opt.label,
    icon: opt.value === current.value ? "i-lucide-check" : undefined,
    onSelect: () => {
      current.value = opt.value;
    },
  }));

export function useRecentChangesFilters(
  entries: MaybeRef<RecentChangeEntry[]>,
  pillars: MaybeRef<Pillar[]>,
  isLoading: Ref<boolean>
) {
  const searchQuery = ref("");
  const debouncedSearch = refDebounced(searchQuery, 200);
  const answerFilter = ref("all");
  const pillarFilter = ref("all");
  const templateFilter = ref("all");

  const pillarFallbackMap = computed(() =>
    Object.fromEntries(toValue(pillars).map((p) => [p.slug, p.name]))
  );

  const resolvePillarName = (entry: RecentChangeEntry): string =>
    entry.pillarName ??
    pillarFallbackMap.value[entry.pillarSlug] ??
    entry.pillarSlug;

  const pillarOptions = computed(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const e of toValue(entries)) {
      const name = resolvePillarName(e);
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
    if (names.length <= 1) return [];
    return [
      { label: "All pillars", value: "all" },
      ...names.map((n) => ({ label: n, value: n })),
    ];
  });

  const templateOptions = computed(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const e of toValue(entries)) {
      if (e.templateName && !seen.has(e.templateName)) {
        seen.add(e.templateName);
        names.push(e.templateName);
      }
    }
    if (names.length <= 1) return [];
    return [
      { label: "All templates", value: "all" },
      ...names.map((n) => ({ label: n, value: n })),
    ];
  });

  const answerMenuItems = computed(() =>
    makeMenuItems(answerOptions, answerFilter)
  );
  const pillarMenuItems = computed(() =>
    makeMenuItems(pillarOptions.value, pillarFilter)
  );
  const templateMenuItems = computed(() =>
    makeMenuItems(templateOptions.value, templateFilter)
  );

  watchEffect(() => {
    if (
      pillarFilter.value !== "all" &&
      !pillarOptions.value.some((o) => o.value === pillarFilter.value)
    ) {
      pillarFilter.value = "all";
    }
    if (
      templateFilter.value !== "all" &&
      !templateOptions.value.some((o) => o.value === templateFilter.value)
    ) {
      templateFilter.value = "all";
    }
  });

  const answerFilterLabel = computed(
    () =>
      answerOptions.find((o) => o.value === answerFilter.value)?.label ??
      "All answers"
  );
  const pillarFilterLabel = computed(
    () =>
      pillarOptions.value.find((o) => o.value === pillarFilter.value)?.label ??
      "All pillars"
  );
  const templateFilterLabel = computed(
    () =>
      templateOptions.value.find((o) => o.value === templateFilter.value)
        ?.label ?? "All templates"
  );

  const isFiltered = computed(
    () =>
      searchQuery.value.trim() !== "" ||
      answerFilter.value !== "all" ||
      pillarFilter.value !== "all" ||
      templateFilter.value !== "all"
  );

  const filteredEntries = computed(() => {
    let result = toValue(entries);
    const q = debouncedSearch.value.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          e.questionId.toLowerCase().includes(q) ||
          (e.questionReference ?? "").toLowerCase().includes(q) ||
          (e.questionText ?? "").toLowerCase().includes(q) ||
          resolvePillarName(e).toLowerCase().includes(q) ||
          (e.templateName ?? "").toLowerCase().includes(q)
      );
    }
    if (answerFilter.value !== "all") {
      result = result.filter((e) => e.answer === answerFilter.value);
    }
    if (pillarFilter.value !== "all") {
      result = result.filter(
        (e) => resolvePillarName(e) === pillarFilter.value
      );
    }
    if (templateFilter.value !== "all") {
      result = result.filter((e) => e.templateName === templateFilter.value);
    }
    return result;
  });

  const showTtlNotice = computed(() => {
    const allEntries = toValue(entries);
    const oldest = allEntries[allEntries.length - 1];
    if (!oldest || isLoading.value) return false;
    const diffDays =
      (Date.now() - new Date(oldest.updatedAt).getTime()) /
      (1000 * 60 * 60 * 24);
    return diffDays >= LOCAL_TTL_DAYS - 1;
  });

  return {
    searchQuery,
    answerMenuItems,
    pillarMenuItems,
    templateMenuItems,
    answerFilterLabel,
    pillarFilterLabel,
    templateFilterLabel,
    pillarOptions,
    templateOptions,
    isFiltered,
    filteredEntries,
    showTtlNotice,
    resolvePillarName,
  };
}
