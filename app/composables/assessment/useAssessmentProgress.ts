import type { Pillar } from "~/models";

type PillarInput = Pillar[] | { pillars?: Pillar[] };

const resolvePillars = (input: PillarInput): Pillar[] => {
  if (Array.isArray(input)) return input;
  return input.pillars ?? [];
};

const calculateOverallProgress = (pillars: Pillar[]): number => {
  if (!pillars || pillars.length === 0) return 0;
  const total = pillars.reduce(
    (sum, pillar) => sum + (pillar.progress ?? 0),
    0
  );
  return Math.round(total / pillars.length);
};

const getPillarProgress = (pillar: Pillar): number => {
  return pillar.progress ?? 0;
};

/** Pure progress calculations for assessment reviews. No side effects or API calls. */
export function useAssessmentProgress() {
  const isComplete = (input: PillarInput): boolean => {
    const pillars = resolvePillars(input);
    if (!pillars || pillars.length === 0) return false;
    return pillars.every((pillar) => pillar.progress === 100);
  };

  const getTotalQuestions = (input: PillarInput): number => {
    const pillars = resolvePillars(input);
    if (!pillars) return 0;
    return pillars.reduce(
      (total, pillar) => total + (pillar.totalQuestions ?? 0),
      0
    );
  };

  return {
    calculateOverallProgress,
    getPillarProgress,
    isComplete,
    getTotalQuestions,
  };
}
