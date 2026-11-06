import type { LifecycleActor, LifecycleRole } from "~/lifecycle/management";

// Pure resolution logic for the dev-only actor picker (issue #89), kept out
// of `DevActorPickerBody.vue` so it's unit-testable without mounting Vue.

export interface DevActorCandidate {
  id: string;
  displayName: string;
}

// A raw, possibly-partial autocomplete keystroke must never be confirmed as
// the identity — only an unchanged selection or a real catalog match is.
export function isConfirmedDevSelection(
  selectedId: string,
  currentActorId: string,
  candidates: readonly DevActorCandidate[]
): boolean {
  const trimmed = selectedId.trim();
  if (!trimmed || trimmed === currentActorId) return true;
  return candidates.some((candidate) => candidate.id === trimmed);
}

// Falls back to the current actor's name (not the raw id) when the id is
// unchanged and unmatched — e.g. the catalog mirror hasn't loaded yet — so
// a save never corrupts the display name. Falling back to the raw id only
// happens when genuinely switching to an id the catalog doesn't recognise.
export function resolveDevActor(params: {
  selectedId: string;
  currentActor: LifecycleActor;
  candidates: readonly DevActorCandidate[];
  isAdmin: boolean;
}): LifecycleActor {
  const trimmed = params.selectedId.trim();
  const nextId = trimmed || params.currentActor.id;
  const match = params.candidates.find((candidate) => candidate.id === nextId);
  const name =
    match?.displayName ??
    (nextId === params.currentActor.id ? params.currentActor.name : nextId);
  const roles: LifecycleRole[] = params.isAdmin ? ["admin"] : ["member"];
  return { id: nextId, name, roles };
}
