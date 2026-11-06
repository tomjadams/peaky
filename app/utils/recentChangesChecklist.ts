export interface ChecklistState {
  checked: string[];
  na?: string[];
}

export interface ChecklistDiff {
  total: number;
  addedIds: Set<string>;
  removedIds: Set<string>;
  addedNaIds: Set<string>;
  removedNaIds: Set<string>;
}

export interface ChecklistItemView {
  id: string;
  text: string;
  state: "checked" | "unchecked" | "na";
  change: "added" | "removed" | "added-na" | "removed-na" | null;
}

export interface ChecklistContext {
  prev: ChecklistState | null;
  curr: ChecklistState | null;
  items: { id: string; text: string }[];
  diff: ChecklistDiff;
  view: ChecklistItemView[];
  summary: {
    prevLabel: string | null;
    currLabel: string;
    direction: "up" | "down" | "same";
  };
}

export function isChecklist(raw: unknown): raw is ChecklistState {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "checked" in raw &&
    Array.isArray((raw as ChecklistState).checked)
  );
}

export function checklistDiff(
  prev: ChecklistState | null,
  curr: ChecklistState | null
): ChecklistDiff {
  const prevChecked = new Set(prev?.checked ?? []);
  const currChecked = new Set(curr?.checked ?? []);
  const prevNa = new Set(prev?.na ?? []);
  const currNa = new Set(curr?.na ?? []);
  const addedIds = new Set(
    [...currChecked].filter((id) => !prevChecked.has(id))
  );
  const removedIds = new Set(
    [...prevChecked].filter((id) => !currChecked.has(id))
  );
  const addedNaIds = new Set([...currNa].filter((id) => !prevNa.has(id)));
  const removedNaIds = new Set([...prevNa].filter((id) => !currNa.has(id)));
  return {
    addedIds,
    removedIds,
    addedNaIds,
    removedNaIds,
    total:
      addedIds.size + removedIds.size + addedNaIds.size + removedNaIds.size,
  };
}

export function buildChecklistView(
  prev: ChecklistState | null,
  curr: ChecklistState | null,
  items: { id: string; text: string }[],
  diff: ChecklistDiff
): ChecklistItemView[] {
  const currChecked = new Set(curr?.checked ?? []);
  const currNa = new Set(curr?.na ?? []);
  return items.map((item) => {
    const state: ChecklistItemView["state"] = currChecked.has(item.id)
      ? "checked"
      : currNa.has(item.id)
        ? "na"
        : "unchecked";
    const change: ChecklistItemView["change"] = diff.addedIds.has(item.id)
      ? "added"
      : diff.removedIds.has(item.id)
        ? "removed"
        : diff.addedNaIds.has(item.id)
          ? "added-na"
          : diff.removedNaIds.has(item.id)
            ? "removed-na"
            : null;
    return { id: item.id, text: item.text, state, change };
  });
}

const fmtCheckCount = (n: number) => (n === 1 ? "1 check" : `${n} checks`);

export function checklistCountSummary(
  prev: ChecklistState | null,
  curr: ChecklistState | null
): ChecklistContext["summary"] {
  const prevN = prev ? prev.checked.length + (prev.na?.length ?? 0) : null;
  const currN = curr ? curr.checked.length + (curr.na?.length ?? 0) : 0;
  const prevChecked = prev?.checked.length ?? null;
  const currChecked = curr?.checked.length ?? 0;
  const prevLabel = prevChecked === null ? null : fmtCheckCount(prevChecked);
  const currLabel =
    currChecked === 0 && (curr?.na?.length ?? 0) > 0
      ? `${curr!.na!.length} N/A`
      : fmtCheckCount(currChecked);
  const direction =
    prevN === null || currN > prevN ? "up" : currN < prevN ? "down" : "same";
  return { prevLabel, currLabel, direction };
}
