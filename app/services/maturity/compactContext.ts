/**
 * Compact per-Review maturity context for team and product Improvement Plans
 * (maturity-score/REQ-014; AC-039, AC-062).
 *
 * Projects one compact chip per pinned Revision from the workspace's
 * derived maturity entries — effective stage, whole percentage, provisional
 * and Advisor-reviewed markers, or the explicit non-result state. No
 * cross-Revision or combined value is ever produced (AC-025).
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import type { ReviewWorkspace } from "~/models/workspace";
import type { Coverage } from "~/services/maturity/calculate";

export interface CompactMaturityEntry {
  readonly templateRevisionId: string;
  /** User-facing identity: template name plus revision number (AC-027). */
  readonly label: string;
  readonly kind:
    | "result"
    | "no-result"
    | "configuration-error"
    | "no-definition";
  readonly stage: number | null;
  readonly stageName: string | null;
  readonly displayPercent: number | null;
  /**
   * AC-068: rollup surfaces show coverage beside the stage. Present for
   * result and no-result entries; null when no calculation ran.
   */
  readonly coverage: Coverage | null;
  /** AC-056: below full coverage the stage is qualified provisional. */
  readonly provisional: boolean;
  /** AC-030: an Advisor-reviewed value carries a persistent indicator. */
  readonly advisorReviewed: boolean;
}

/** Explicit non-result state labels shared by every compact surface. */
export const COMPACT_STATE_LABEL: Record<
  Exclude<CompactMaturityEntry["kind"], "result">,
  string
> = {
  "no-result": "No applicable result",
  "configuration-error": "Configuration error",
  "no-definition": "No maturity definition",
};

/**
 * One-line stage context with coverage (AC-068) — e.g.
 * `Stage 2 · Ad-hoc · 45% (provisional) · 3/4 answered`. Returns null when
 * the review has no entry for the Revision at all.
 */
export function compactEntryContextLabel(
  entry: CompactMaturityEntry | null | undefined
): string | null {
  if (!entry) return null;
  const coverage = entry.coverage
    ? ` · ${entry.coverage.answered}/${entry.coverage.total} answered`
    : "";
  if (entry.kind !== "result") {
    return `${COMPACT_STATE_LABEL[entry.kind]}${coverage}`;
  }
  const provisional = entry.provisional ? " (provisional)" : "";
  return `Stage ${entry.stage} · ${entry.stageName} · ${entry.displayPercent}%${provisional}${coverage}`;
}

export function compactMaturityEntries(
  workspace: ReviewWorkspace
): CompactMaturityEntry[] {
  return workspace.maturity.map((entry) => {
    const revision = workspace.templateRevisions.find(
      (candidate) => candidate.id === entry.templateRevisionId
    );
    const label = `${revision?.name ?? entry.templateRevisionId} · Revision ${revision?.revisionNumber ?? "?"}`;
    const base = {
      templateRevisionId: entry.templateRevisionId,
      label,
      kind: entry.kind,
      stage: null,
      stageName: null,
      displayPercent: null,
      coverage:
        entry.kind === "result" || entry.kind === "no-result"
          ? entry.coverage
          : null,
      provisional: false,
      advisorReviewed: false,
    };
    if (entry.kind !== "result") {
      return base;
    }
    return {
      ...base,
      stage: entry.effectiveResult.stage.stage,
      stageName: entry.effectiveResult.stage.name,
      displayPercent: entry.effectiveResult.displayPercent,
      provisional: entry.coverage.unanswered > 0,
      advisorReviewed: entry.effectiveResult.source === "override",
    };
  });
}
