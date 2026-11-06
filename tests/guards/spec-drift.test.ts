/**
 * Drift guard for the FizzBee specs under formal_verification/.
 *
 * This is a repository lint expressed with vitest, not a unit test: it reads
 * tracked files from disk and compares them to each other. It lives in
 * tests/guards/ for that reason, and runs in the fast suite because it takes
 * milliseconds and must fail on the machine of whoever broke the link.
 *
 * `make verify` cannot detect a stale spec: the model checker explores the
 * .fizz model and never reads the implementation, so a spec keeps passing long
 * after the code it claims to model has moved on. These assertions are the
 * mechanical link — every value a spec mirrors is compared against the module
 * that owns it, and every spec must point at code that still exists (and be
 * pointed back at, so the link is discoverable while editing the code).
 *
 * When one of these fails, decide which side is wrong before changing either.
 * If the protocol genuinely changed, update the spec and re-run
 * `make verify/<path>`; if only a constant moved, update the spec constant.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { outboxStatus } from "#shared/db/schema";
import { ConcurrencyController } from "~/services/sync/ConcurrencyController";
import { AdaptiveRetryPolicy } from "~/services/sync/RetryPolicy";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const SPEC_ROOT = join(REPO_ROOT, "formal_verification");

function listSpecs(dir = SPEC_ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listSpecs(full);
    return entry.name.endsWith(".fizz") ? [relative(SPEC_ROOT, full)] : [];
  });
}

const specs = listSpecs().toSorted();

function readSpec(relPath: string): string {
  return readFileSync(join(SPEC_ROOT, relPath), "utf8");
}

const PATH_PATTERN =
  /(?:app|shared|server|services|tests)\/[A-Za-z0-9_./-]*[A-Za-z0-9_]/g;
const CONSTANT_PATTERN = /^([A-Z][A-Z0-9_]*) *= *(-?\d+)/;
const STRING_LITERAL_PATTERN = /"([^"]*)"/g;

/** Paths listed in the spec's `# MODELS` block, relative to the repo root. */
function modelledPaths(source: string): string[] {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.startsWith("# MODELS"));
  if (start === -1) return [];
  const paths: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("#")) break;
    paths.push(...(line.match(PATH_PATTERN) ?? []));
  }
  return paths;
}

/** Integer value of a top-level `NAME = 123` constant. */
function specConstant(source: string, name: string): number {
  for (const line of source.split("\n")) {
    const match = CONSTANT_PATTERN.exec(line);
    if (match?.[1] === name) return Number(match[2]);
  }
  expect.fail(`constant ${name} not found in spec`);
}

/** String literals of a `return <var> in ["a", "b"]` assertion body. */
function specStringSet(source: string, assertion: string): string[] {
  const lines = source.split("\n");
  const start = lines.findIndex((line) =>
    line.trimEnd().endsWith(`assertion ${assertion}:`)
  );
  expect(start, `assertion ${assertion} not found in spec`).not.toBe(-1);
  for (const line of lines.slice(start + 1)) {
    if (line.includes(" in [")) {
      return [...line.matchAll(STRING_LITERAL_PATTERN)].map(
        (match) => match[1]!
      );
    }
    if (line.trim() === "") break;
  }
  expect.fail(`assertion ${assertion} has no membership check to compare`);
}

/** Names of every property the spec declares. */
function declaredProperties(source: string): string[] {
  return [
    ...source.matchAll(
      /^(?:always|eventually always|transition|exists) assertion (\w+):/gm
    ),
  ].map((match) => match[1]!);
}

describe("FizzBee specs — traceability to the implementation", () => {
  it("finds the specs", () => {
    expect(specs.length).toBeGreaterThanOrEqual(8);
  });

  it.each(specs)("%s declares a MODELS block", (spec) => {
    expect(modelledPaths(readSpec(spec))).not.toHaveLength(0);
  });

  it.each(specs)("%s only points at files that exist", (spec) => {
    for (const path of modelledPaths(readSpec(spec))) {
      expect(existsSync(join(REPO_ROOT, path)), `missing: ${path}`).toBe(true);
    }
  });

  it.each(specs)("%s is pointed back at by the code it models", (spec) => {
    const backlinks = modelledPaths(readSpec(spec)).filter((path) =>
      readFileSync(join(REPO_ROOT, path), "utf8").includes(spec)
    );
    expect(
      backlinks,
      `no file listed in the MODELS block of ${spec} mentions it — add a ` +
        `"Formal model: formal_verification/${spec}" comment so the link is ` +
        `visible to whoever edits the code`
    ).not.toHaveLength(0);
  });

  it.each(specs)("%s documents every property it declares", (spec) => {
    const source = readSpec(spec);
    const header = source.slice(0, source.search(/^\s*[^#\s]/m));
    const headerWords = new Set(header.split(/[^A-Za-z0-9]+/));
    for (const property of declaredProperties(source)) {
      // Header lists write the indexed invariants as `I1 Name`, the spec
      // declares them as `I1_Name`, so match part by part.
      const documented = property
        .split("_")
        .every((part) => headerWords.has(part));
      expect(documented, `${property} is not explained in the header`).toBe(
        true
      );
    }
  });
});

describe("outbox_item_lifecycle.fizz — mirrors the outbox implementation", () => {
  const source = readSpec("sync/outbox_item_lifecycle.fizz");

  it("StatusIsValid lists exactly the outboxStatus enum", () => {
    expect(specStringSet(source, "StatusIsValid").toSorted()).toEqual(
      [...outboxStatus].toSorted()
    );
  });

  it("MAX_RETRIES equals the retry policy's maxAttempts", () => {
    expect(specConstant(source, "MAX_RETRIES")).toBe(
      new AdaptiveRetryPolicy().maxAttempts
    );
  });

  it("EventuallyTerminal names the statuses the code treats as terminal", () => {
    expect(specStringSet(source, "EventuallyTerminal").toSorted()).toEqual([
      "failed",
      "synced",
    ]);
  });
});

/**
 * Drive the real controller to saturation to recover its clamp bounds.
 *
 * Bounded: a controller whose growth or decay oscillates has no fixed point, and
 * an unbounded loop here would hang the suite instead of reporting that.
 */
function saturate(direction: "up" | "down"): number {
  const STEP_LIMIT = 1000;
  const controller = new ConcurrencyController();
  let previous = -1;
  for (let step = 0; step < STEP_LIMIT; step++) {
    if (controller.batchSize === previous) return controller.batchSize;
    previous = controller.batchSize;
    if (direction === "up") controller.onSuccess();
    else controller.onFailure();
  }
  throw new Error(
    `ConcurrencyController did not converge going ${direction} within ` +
      `${STEP_LIMIT} steps (last batchSize=${controller.batchSize})`
  );
}

describe("aimd_concurrency_controller.fizz — mirrors ConcurrencyController", () => {
  const source = readSpec("resilience/aimd_concurrency_controller.fizz");

  it("MAX_SIZE equals the upper clamp the controller saturates at", () => {
    expect(specConstant(source, "MAX_SIZE")).toBe(saturate("up"));
  });

  it("MIN_SIZE equals the lower clamp the controller saturates at", () => {
    expect(specConstant(source, "MIN_SIZE")).toBe(saturate("down"));
  });

  it("Init uses the controller's initial batch size", () => {
    const initial = /batch_size = (\d+)/.exec(source);
    expect(Number(initial![1])).toBe(new ConcurrencyController().batchSize);
  });

  it("models the controller's actual update arithmetic", () => {
    // FizzBee has no floats, so the spec writes Math.floor(n * 1.5) as
    // `n * 3 // 2`. If either side changes, the equivalence must be re-checked
    // by hand — hence the exact-expression assertions.
    expect(source).toContain(
      "self.batch_size = min(MAX_SIZE, max(self.batch_size + 1, self.batch_size * 3 // 2))"
    );
    expect(source).toContain(
      "self.batch_size = max(MIN_SIZE, self.batch_size // 2)"
    );
  });

  it("grows exactly as the modelled increase expression, up to the clamp", () => {
    const max = specConstant(source, "MAX_SIZE");
    const controller = new ConcurrencyController();
    let modelled = controller.batchSize;

    for (let step = 0; step < 10; step++) {
      controller.onSuccess();
      modelled = Math.min(
        max,
        Math.max(modelled + 1, Math.floor((modelled * 3) / 2))
      );
      expect(controller.batchSize).toBe(modelled);
    }
    expect(controller.batchSize).toBe(max);
  });

  it("shrinks exactly as the modelled decrease expression, down to the clamp", () => {
    const min = specConstant(source, "MIN_SIZE");
    const max = specConstant(source, "MAX_SIZE");
    const controller = new ConcurrencyController();
    while (controller.batchSize < max) controller.onSuccess();

    let modelled = controller.batchSize;
    for (let step = 0; step < 10; step++) {
      controller.onFailure();
      modelled = Math.max(min, Math.floor(modelled / 2));
      // Halving, not decrement: a `size - 1` implementation diverges on step 1.
      expect(controller.batchSize).toBe(modelled);
    }
    expect(controller.batchSize).toBe(min);
  });
});

describe("local_db_migration_idempotency.fizz — mirrors the migration runner", () => {
  const source = readSpec("storage/local_db_migration_idempotency.fizz");

  it("TOTAL is declared as a representative bound, not a mirrored count", () => {
    // The registry grows with every migration; the proof is parametric in TOTAL,
    // so this must stay documented as an abstraction rather than a fact to sync.
    expect(source).toMatch(/^TOTAL = \d+\s*#\s*representative/m);
  });
});
