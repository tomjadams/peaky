/**
 * Degraded-sync handoff gating (local-first/REQ-012; AC-019, AC-020; design
 * Decision 6).
 *
 * Local draft editing — selection, removal, rationale editing, reordering —
 * writes locally and enqueues sync events, so it never depends on sync
 * health. Association and replacement confirmation claim shared uniqueness
 * across clients, so they require a current shared association view: while
 * sync is degraded or offline, confirmation is disabled and the stated
 * reason explains that duplicate prevention is unavailable.
 *
 * The input is the client's existing sync-health signal
 * (useSyncStatus' SyncConnectionStatus). UI wiring lives in group 10; this
 * gate is the domain/store-level enforcement they consume.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */

/** Sync health as detected by the client's sync status composable. */
export type HandoffSyncHealth = "online" | "syncing" | "degraded" | "offline";

/**
 * The stated reason confirmation is disabled while sync is degraded
 * (AC-020): duplicate prevention needs a current shared association view.
 */
export const CONFIRMATION_UNAVAILABLE_REASON =
  "Sync is degraded, so duplicate prevention is unavailable: existing-ticket association and replacement confirmation are disabled until the shared association view is current again. Draft edits stay local and synchronize when sync recovers.";

export interface HandoffSyncGate {
  /** Whether the client's view of shared association state is current. */
  readonly sharedViewCurrent: boolean;
  /** Local draft operations — always available (AC-019). */
  readonly draftEditing: { readonly available: true };
  /** Association and replacement confirmation (AC-020). */
  readonly confirmation: {
    readonly available: boolean;
    readonly reason: string | null;
  };
}

/**
 * Derives the handoff operation gate from sync health. Draft editing stays
 * available in every state; confirmation requires an online (or actively
 * syncing) connection so the pre-confirmation re-read of current
 * associations reflects every client.
 */
export function handoffSyncGate(status: HandoffSyncHealth): HandoffSyncGate {
  const sharedViewCurrent = status === "online" || status === "syncing";
  return {
    sharedViewCurrent,
    draftEditing: { available: true },
    confirmation: sharedViewCurrent
      ? { available: true, reason: null }
      : { available: false, reason: CONFIRMATION_UNAVAILABLE_REASON },
  };
}

/**
 * Throws the gate's stated reason when confirmation is unavailable — the
 * store-level guard a confirmation mutation calls before planning any
 * transition.
 */
export function assertConfirmationAvailable(gate: HandoffSyncGate): void {
  if (!gate.confirmation.available) {
    throw new Error(
      gate.confirmation.reason ?? CONFIRMATION_UNAVAILABLE_REASON
    );
  }
}
