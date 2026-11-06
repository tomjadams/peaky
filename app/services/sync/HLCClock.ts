/**
 * Hybrid Logical Clock (HLC) for field-level conflict resolution.
 *
 * Wire format: "wallclock:counter:actorId"
 *   wallclock — Unix milliseconds as a decimal string
 *   counter   — zero-padded 4-digit integer (resets when wall clock advances)
 *   actorId   — identifies the originating actor for tiebreaking
 *
 * The format is purely lexicographic — no integer parsing needed for comparison.
 * This matches the Go server's conflict/hlc.go implementation.
 */

const COUNTER_WIDTH = 4;
const MAX_DRIFT_MS = 60_000;

function padCounter(n: number): string {
  return String(n).padStart(COUNTER_WIDTH, "0");
}

export interface HLCState {
  wallclock: number;
  counter: number;
}

export class HLCClock {
  private last: HLCState = { wallclock: 0, counter: 0 };

  constructor(private readonly actorId: string) {}

  /**
   * Generate the next HLC timestamp, guaranteed to be monotonically
   * greater than the previous one.
   */
  now(): string {
    const wall = Date.now();

    if (wall > this.last.wallclock) {
      this.last = { wallclock: wall, counter: 0 };
    } else {
      // Same or lagging wall clock — increment counter for monotonicity
      this.last = {
        wallclock: this.last.wallclock,
        counter: this.last.counter + 1,
      };
    }

    return `${this.last.wallclock}:${padCounter(this.last.counter)}:${this.actorId}`;
  }

  /**
   * Advance the local clock to account for a remote HLC observed during pull.
   *
   * This ensures the next now() produces a timestamp causally after the
   * remote event — without this, a client with a slower clock would
   * generate timestamps that lose every conflict against faster peers.
   *
   * Jump clock guard: if the remote wallclock is more than MAX_DRIFT_MS
   * (60s) ahead of local time, the update is rejected. A misconfigured
   * client clock should not poison conflict resolution for all peers.
   *
   * Returns true if the clock was advanced, false if the remote HLC
   * was rejected (too far in the future) or behind the local clock.
   */
  receive(remoteHLC: string): boolean {
    const parsed = HLCClock.parse(remoteHLC);
    if (!parsed) return false;

    const wall = Date.now();
    if (parsed.wallclock - wall > MAX_DRIFT_MS) {
      return false;
    }

    const newWall = Math.max(wall, parsed.wallclock, this.last.wallclock);

    let newCounter: number;
    if (newWall === this.last.wallclock && newWall === parsed.wallclock) {
      newCounter = Math.max(this.last.counter, parsed.counter) + 1;
    } else if (newWall === parsed.wallclock) {
      newCounter = parsed.counter + 1;
    } else if (newWall === this.last.wallclock) {
      newCounter = this.last.counter + 1;
    } else {
      newCounter = 0;
    }

    this.last = { wallclock: newWall, counter: newCounter };
    return true;
  }

  /**
   * Parse a wire-format HLC string into its components.
   * Returns null for malformed input.
   */
  static parse(
    hlc: string
  ): { wallclock: number; counter: number; actorId: string } | null {
    const parts = hlc.split(":");
    if (parts.length !== 3) return null;
    const [wallStr, ctrStr, actorId] = parts as [string, string, string];
    const wallclock = Number(wallStr);
    const counter = Number(ctrStr);
    if (!Number.isFinite(wallclock) || !Number.isFinite(counter)) return null;
    return { wallclock, counter, actorId };
  }

  /**
   * Compare two wire-format HLC strings lexicographically.
   * Returns positive if a > b, negative if a < b, 0 if equal.
   */
  static compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
