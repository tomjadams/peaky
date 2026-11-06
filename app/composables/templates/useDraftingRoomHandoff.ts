/**
 * Cross-question hand-off flag for the Guided Drafting Room's entrance
 * ceremony.
 *
 * Each question row mounts its own `GuidedDraftingRoom` instance (see
 * `QuestionCard.vue`), so a chevron hand-off — the header's Previous/Next
 * question buttons — actually closes ONE room instance and opens a DIFFERENT
 * sibling instance a beat later (the page reassigns `expandedQuestionId` to
 * the neighbouring question). There is no shared component state between
 * those two instances, so this module-level ref is the only channel: the
 * room being left marks the moment it forwarded the navigation, and the
 * room opening next checks how recently that happened to decide whether it
 * should play the full entrance choreography or the abbreviated hand-off
 * variant. See GuidedDraftingRoom.vue's `open` watcher.
 */
const lastHandoffAt = ref<number | null>(null);

export const useDraftingRoomHandoff = () => {
  const markHandoff = () => {
    lastHandoffAt.value = Date.now();
  };

  return {
    lastHandoffAt,
    markHandoff,
  };
};
