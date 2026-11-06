import { computed, ref, type Ref } from "vue";
import type { ReviewWorkspace } from "~/models/workspace";
import { indexStagePathQuestions } from "~/services/maturity/stagePath";
import { calculatePillarEvidenceProgress } from "~/services/review/pillarEvidenceProgress";

export function useReviewPillarBreakdown(
  workspace: Ref<ReviewWorkspace | null>,
  templateRevisionId: Ref<string | null | undefined>
) {
  const selectedMaturityEntry = computed(() => {
    const entry = workspace.value?.maturity.find(
      (candidate) => candidate.templateRevisionId === templateRevisionId.value
    );
    return entry?.kind === "result" ? entry : null;
  });
  const selectedWorkspacePillars = computed(() =>
    (workspace.value?.pillars ?? []).filter(
      (pillar) => pillar.templateRevisionId === templateRevisionId.value
    )
  );
  const pillarQuestionIndex = computed(() =>
    indexStagePathQuestions(selectedWorkspacePillars.value)
  );
  const pillarProgressBySlug = computed(
    () =>
      new Map(
        selectedWorkspacePillars.value.map((pillar) => [
          pillar.slug,
          calculatePillarEvidenceProgress(
            pillar,
            workspace.value?.answers ?? []
          ).percent,
        ])
      )
  );
  const selectedPillarBreakdown = ref<{ id: string; name: string } | null>(
    null
  );
  const pillarBreakdownOpen = ref(false);

  const handlePillarClick = (row: Record<string, unknown>) => {
    if (!selectedMaturityEntry.value) return;
    selectedPillarBreakdown.value = {
      id: String(row.id),
      name: String(row.name),
    };
    pillarBreakdownOpen.value = true;
  };

  return {
    selectedMaturityEntry,
    selectedWorkspacePillars,
    pillarQuestionIndex,
    pillarProgressBySlug,
    selectedPillarBreakdown,
    pillarBreakdownOpen,
    handlePillarClick,
  };
}
