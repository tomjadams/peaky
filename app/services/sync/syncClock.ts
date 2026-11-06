/**
 * Module-level HLC clock singleton for mutation services.
 *
 * Initialized lazily on first call with the persisted actor ID.
 * A singleton ensures monotonicity across mutations within a session.
 */
import { readPersistedActor } from "~/composables/auth/useCurrentActor";
import { HLCClock } from "./HLCClock";

let _clock: HLCClock | null = null;

export function getHLCClock(): HLCClock {
  if (!_clock) {
    const actor = readPersistedActor();
    _clock = new HLCClock(actor.id);
  }
  return _clock;
}

/** Reset the singleton — used in tests to ensure isolation. */
export function resetHLCClock(): void {
  _clock = null;
}
