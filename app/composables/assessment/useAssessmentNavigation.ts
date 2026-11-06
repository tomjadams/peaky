import type { Pillar } from "~/models";

/** Pillar navigation state for assessment flow. Tracks current position and provides next/prev/goto. */
export function useAssessmentNavigation(pillars: Ref<Pillar[]>) {
  const currentPillarIndex = ref(0);

  const currentPillar = computed(() => {
    return pillars.value[currentPillarIndex.value] ?? null;
  });

  const nextPillar = () => {
    if (currentPillarIndex.value < pillars.value.length - 1) {
      currentPillarIndex.value++;
    }
  };

  const prevPillar = () => {
    if (currentPillarIndex.value > 0) {
      currentPillarIndex.value--;
    }
  };

  const goToPillar = (index: number) => {
    if (index >= 0 && index < pillars.value.length) {
      currentPillarIndex.value = index;
    }
  };

  const goToPillarBySlug = (slug: string) => {
    const index = pillars.value.findIndex((p) => p.slug === slug);
    if (index >= 0) {
      currentPillarIndex.value = index;
    }
  };

  return {
    currentPillarIndex: readonly(currentPillarIndex),
    currentPillar,
    nextPillar,
    prevPillar,
    goToPillar,
    goToPillarBySlug,
  };
}
