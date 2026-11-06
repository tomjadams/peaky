import type { Ref, ComputedRef } from "vue";
import type { PlanItem } from "~/models/improvement-plan";
import type { RiskLevel } from "~/models/template";
import { SEVERITY_DISPLAY } from "~/constants/planDisplay";

export const severityOrder = ["critical", "high", "medium"] as const;

/**
 * Map any severity string to a valid display-tier `RiskLevel`.
 *
 * Falls back to `"medium"` for unknown or removed values (e.g. the
 * deprecated `"low"` tier) so the plan UI never encounters an
 * unrecognised severity at render time.
 */
export const normalizeSeverity = (severity: string): RiskLevel =>
  severity in SEVERITY_DISPLAY ? (severity as RiskLevel) : "medium";

/** Human-readable subtitle shown under each severity section header. */
export const sectionDescription = (severity: string) => {
  switch (severity) {
    case "critical":
      return "Start here for the highest operational risk.";
    case "high":
      return "Plan these follow-ups before readiness sign-off.";
    default:
      return "Learn more about them and validate whether they are applicable.";
  }
};

/** Tailwind class for the coloured dot indicator beside each severity section header. */
export const severityAccentClass = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-error";
    case "high":
      return "bg-warning";
    default:
      return "dark:bg-white ring-2 ring-default bg-black";
  }
};

/**
 * Stable composite key for `v-for` and deduplication.
 *
 * Includes checklist item IDs so two checklist-gap items for the same
 * question but different missing items produce distinct keys.
 */
export const itemKey = (item: PlanItem) =>
  [
    item.identity.reviewId,
    item.identity.templateRevisionId,
    item.identity.questionId,
    item.identity.checklistItemIds?.join(",") ?? "",
  ].join("::");

/**
 * Returns `true` when an item has enough learning content to open the
 * MoreInfoPanel ("Learn why" action). Guards against showing the button
 * for items whose template question had no importance text or practices.
 */
export const canLearnWhy = (item: PlanItem) =>
  Boolean(
    item.importance ||
    item.leadingPractices?.length ||
    item.helpfulLinks?.length
  );

/**
 * Groups a flat `PlanItem[]` into severity sections for the plan table view.
 *
 * Sections follow `severityOrder` (critical → high → medium) and empty
 * sections are omitted. The returned computed re-derives whenever `items` changes.
 */
export const usePlanItemSections = (items: Ref<PlanItem[]>) =>
  computed(() =>
    severityOrder
      .map((severity) => ({
        severity,
        items: items.value.filter(
          (item) => normalizeSeverity(item.severity) === severity
        ),
      }))
      .filter((section) => section.items.length > 0)
  );

/**
 * Manage collapsible severity sections.
 *
 * The first section with content is expanded by default; all others start collapsed.
 * Pass any array of objects that have a `severity` string field.
 */
export function useCollapsibleSections<T extends { severity: string }>(
  sections: Ref<T[]> | ComputedRef<T[]>
) {
  const collapsedSections = ref<Set<string>>(
    new Set(
      toValue(sections)
        .slice(1)
        .map((s) => s.severity)
    )
  );

  const isExpanded = (severity: string) =>
    !collapsedSections.value.has(severity);

  const toggleSection = (severity: string) => {
    const next = new Set(collapsedSections.value);
    if (next.has(severity)) {
      next.delete(severity);
    } else {
      next.add(severity);
    }
    collapsedSections.value = next;
  };

  return { isExpanded, toggleSection };
}
