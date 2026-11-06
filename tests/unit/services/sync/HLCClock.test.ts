import { describe, expect, it, vi, afterEach } from "vitest";
import { HLCClock } from "~/services/sync/HLCClock";

describe("HLCClock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("now()", () => {
    it("returns a wire-format string with three colon-separated parts", () => {
      const clock = new HLCClock("actor_test");
      const hlc = clock.now();
      const parts = hlc.split(":");
      expect(parts).toHaveLength(3);
    });

    it("includes the actorId as the third part", () => {
      const clock = new HLCClock("actor_alice");
      const hlc = clock.now();
      expect(hlc.split(":")[2]).toBe("actor_alice");
    });

    it("zero-pads the counter to 4 digits", () => {
      const clock = new HLCClock("actor_test");
      const hlc = clock.now();
      const counter = hlc.split(":")[1]!;
      expect(counter).toMatch(/^\d{4}$/);
    });

    it("increments counter on same wallclock", () => {
      // Freeze Date.now so all calls see the same wallclock
      const frozenMs = 1700000000000;
      vi.spyOn(Date, "now").mockReturnValue(frozenMs);

      const clock = new HLCClock("actor_test");
      const hlc1 = clock.now();
      const hlc2 = clock.now();
      const hlc3 = clock.now();

      const ctr1 = Number(hlc1.split(":")[1]);
      const ctr2 = Number(hlc2.split(":")[1]);
      const ctr3 = Number(hlc3.split(":")[1]);

      expect(ctr2).toBe(ctr1 + 1);
      expect(ctr3).toBe(ctr1 + 2);
    });

    it("resets counter when wall clock advances", () => {
      let ms = 1700000000000;
      vi.spyOn(Date, "now").mockImplementation(() => ms);

      const clock = new HLCClock("actor_test");
      clock.now(); // wallclock = ms, counter = 0
      clock.now(); // wallclock = ms, counter = 1

      ms += 1; // advance wall clock
      const hlc = clock.now();
      const counter = Number(hlc.split(":")[1]);
      expect(counter).toBe(0);
    });

    it("is monotonically increasing — each call produces a greater value", () => {
      const clock = new HLCClock("actor_test");
      let prev = "";
      for (let i = 0; i < 20; i++) {
        const curr = clock.now();
        if (prev) {
          expect(HLCClock.compare(curr, prev)).toBeGreaterThan(0);
        }
        prev = curr;
      }
    });
  });

  describe("parse()", () => {
    it("parses a valid wire-format HLC", () => {
      const parsed = HLCClock.parse("1716220800000:0001:actor_alice");
      expect(parsed).not.toBeNull();
      expect(parsed!.wallclock).toBe(1716220800000);
      expect(parsed!.counter).toBe(1);
      expect(parsed!.actorId).toBe("actor_alice");
    });

    it("returns null for too few parts", () => {
      expect(HLCClock.parse("1716220800000:0001")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(HLCClock.parse("")).toBeNull();
    });

    it("returns null for non-numeric wallclock", () => {
      expect(HLCClock.parse("bad:0001:actor")).toBeNull();
    });
  });

  describe("receive()", () => {
    it("advances local clock when remote wallclock is ahead", () => {
      // Given: a local clock seeded at frozenMs
      const frozenMs = 1700000000000;
      vi.spyOn(Date, "now").mockReturnValue(frozenMs);
      const clock = new HLCClock("actor_test");
      clock.now();

      // When: receiving a remote HLC 5s ahead (within drift tolerance)
      const remoteHLC = `${frozenMs + 5000}:0003:actor_remote`;
      expect(clock.receive(remoteHLC)).toBe(true);

      // Then: next now() is causally after the remote HLC
      const next = clock.now();
      expect(HLCClock.compare(next, remoteHLC)).toBeGreaterThan(0);
    });

    it("rejects remote HLC more than 60s ahead (jump clock guard)", () => {
      // Given: a local clock at frozenMs
      const frozenMs = 1700000000000;
      vi.spyOn(Date, "now").mockReturnValue(frozenMs);
      const clock = new HLCClock("actor_test");

      // When: receiving a remote HLC 90s in the future
      const remoteHLC = `${frozenMs + 90_000}:0001:actor_evil`;

      // Then: rejected — local clock not poisoned
      expect(clock.receive(remoteHLC)).toBe(false);
      const next = clock.now();
      const parsed = HLCClock.parse(next)!;
      expect(parsed.wallclock).toBe(frozenMs);
    });

    it("accepts remote HLC exactly at the 60s boundary", () => {
      // Given: a local clock at frozenMs
      const frozenMs = 1700000000000;
      vi.spyOn(Date, "now").mockReturnValue(frozenMs);
      const clock = new HLCClock("actor_test");

      // When: receiving a remote HLC exactly 60s ahead
      const remoteHLC = `${frozenMs + 60_000}:0001:actor_remote`;

      // Then: accepted (boundary is inclusive)
      expect(clock.receive(remoteHLC)).toBe(true);
    });

    it("returns false for malformed HLC input", () => {
      // Given: a clock
      const clock = new HLCClock("actor_test");

      // When/Then: malformed inputs are rejected without side effects
      expect(clock.receive("garbage")).toBe(false);
      expect(clock.receive("")).toBe(false);
      expect(clock.receive("::::")).toBe(false);
    });

    it("is a no-op when remote is behind local clock", () => {
      // Given: a local clock that has generated a timestamp
      const frozenMs = 1700000000000;
      vi.spyOn(Date, "now").mockReturnValue(frozenMs);
      const clock = new HLCClock("actor_test");
      const hlcBefore = clock.now();

      // When: receiving a remote HLC 10s behind
      const remoteHLC = `${frozenMs - 10_000}:0001:actor_remote`;
      expect(clock.receive(remoteHLC)).toBe(true);

      // Then: monotonicity preserved — next now() still advances
      const hlcAfter = clock.now();
      expect(HLCClock.compare(hlcAfter, hlcBefore)).toBeGreaterThan(0);
    });

    it("merges counters when wallclocks are equal", () => {
      // Given: a local clock with counter at 2 (three now() calls)
      const frozenMs = 1700000000000;
      vi.spyOn(Date, "now").mockReturnValue(frozenMs);
      const clock = new HLCClock("actor_test");
      clock.now(); // counter=0
      clock.now(); // counter=1
      clock.now(); // counter=2

      // When: receiving a remote HLC at the same wallclock with counter=10
      const remoteHLC = `${frozenMs}:0010:actor_remote`;
      clock.receive(remoteHLC);

      // Then: next counter is > max(local=2, remote=10)
      const next = clock.now();
      const parsed = HLCClock.parse(next)!;
      expect(parsed.counter).toBeGreaterThan(10);
    });
  });

  describe("compare()", () => {
    it("returns positive when a > b (newer wallclock)", () => {
      expect(
        HLCClock.compare("1000:0001:alice", "0999:0001:alice")
      ).toBeGreaterThan(0);
    });

    it("returns negative when a < b (older wallclock)", () => {
      expect(
        HLCClock.compare("0999:0001:alice", "1000:0001:alice")
      ).toBeLessThan(0);
    });

    it("returns positive when same wallclock but higher counter", () => {
      expect(
        HLCClock.compare("1000:0002:alice", "1000:0001:alice")
      ).toBeGreaterThan(0);
    });

    it("returns positive when same wallclock+counter but higher actorId (tiebreaker)", () => {
      expect(
        HLCClock.compare("1000:0001:bob", "1000:0001:alice")
      ).toBeGreaterThan(0);
    });

    it("returns 0 for identical HLCs", () => {
      expect(HLCClock.compare("1000:0001:alice", "1000:0001:alice")).toBe(0);
    });
  });
});
