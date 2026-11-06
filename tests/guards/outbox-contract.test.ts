/**
 * Outbox contract guard — a repository lint, not a unit test.
 *
 * Every local mutation MUST go through `localMutation.draft()` or
 * `localMutation.commit()` in `app/services/local-mutation.ts`. Those are the
 * only two sites that may call `insert(localOutbox)` directly. Every other
 * outbox write is a bypass that loses `triggerPush()`, failed-row cleanup,
 * the typed `OutboxEntry` contract, and the formal-verification coverage of
 * `formal_verification/sync/local_mutation_atomicity.fizz`.
 *
 * Two rules are enforced here:
 *
 * 1. **No `operation: "create"` or `operation: "update"`.**
 *    `local-first/spec.md` requires `upsert` or `delete` only. The
 *    `OutboxEntry` type allows exactly those two; `create`/`update` are spec
 *    violations that slipped in through untyped raw inserts.
 *
 * 2. **No empty `fields` on non-delete operations.**
 *    `local-first/spec.md` requires "a JSON array of `{name, value, hlc}`
 *    objects". An empty array carries no data, so receivers fall back to
 *    defaults (e.g. `ProductHandler` uses the UUID as the product name).
 *    Delete operations are exempt — there is no data to carry.
 *
 * Rule 0 (no raw `insert(localOutbox)` outside `local-mutation.ts`) was
 * previously enforced here but is now covered by the AST-based oxlint plugin
 * `peaky/enforce-local-mutation-uow` (introduced in MR !329). See issue #134
 * for extending the oxlint plugin to cover these remaining rules.
 *
 * Each rule ships with a ratchet allowlist of today's violations. The
 * allowlist can only shrink: fixing a site removes its entry, and the test
 * fails if the count drops below the allowlist (stale entry — remove it) or
 * rises above it (new violation — fix it or add a allowlisted reason).
 *
 * When this guard fails after you fix a site, delete the corresponding line
 * from the allowlist. Do not increase an allowlist count.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const APP_ROOT = join(REPO_ROOT, "app");

/** Recursively list non-test .ts files under `dir`, relative to REPO_ROOT. */
function listTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(full);
    if (
      entry.name.endsWith(".ts") &&
      !entry.name.includes(".test.") &&
      !entry.name.endsWith(".d.ts")
    ) {
      return [relative(REPO_ROOT, full)];
    }
    return [];
  });
}

const sourceFiles = listTsFiles(APP_ROOT);

function readFile(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

// ─── Rule 1: no operation: "create" or "update" ────────────────────────────

const INVALID_OP_ALLOWLIST: Record<string, number> = {};

const INVALID_OP_PATTERN = /operation:\s*"(?:create|update)"/g;

// ─── Rule 2: no empty fields on non-delete operations ──────────────────────

// Deletes legitimately have empty fields — there is no data to carry.
// Only flag empty fields when the operation is upsert/create/update.
// The pattern matches `operation: "upsert"` (or create/update) followed
// by `fields: []` on the next line, which is the consistent layout in all
// outbox blocks. See issue #133 for the review_checkpoint exception.
const EMPTY_FIELDS_ALLOWLIST: Record<string, number> = {
  // review_checkpoint is audit-only (no state table, no inbound handler).
  // The outbox entry exists to trigger the push; fields are never read.
  // See: https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/133
  "app/services/entity/ReviewMutations.ts": 1,
};

const EMPTY_FIELDS_PATTERN =
  /operation:\s*"(?:upsert|create|update)"\s*,\s*\n\s*fields:\s*(?:\[\]|JSON\.stringify\(\s*\[\]\s*\))/g;

/**
 * Ratchet check: for each file in the union of source files and allowlist
 * keys, compare the actual violation count to the allowlisted count.
 *
 * - count > allowed → new violation, fail
 * - count < allowed → stale allowlist entry, fail (remove the line)
 * - count == allowed → pass
 */
function ratchet(
  ruleName: string,
  pattern: RegExp,
  allowlist: Record<string, number>
): void {
  const allFiles = new Set([...sourceFiles, ...Object.keys(allowlist)]);

  for (const file of allFiles) {
    if (!existsSync(join(REPO_ROOT, file))) {
      // File was deleted — allowlist entry is stale.
      if (allowlist[file]) {
        expect.fail(
          `${ruleName}: allowlisted file ${file} no longer exists — remove its entry`
        );
      }
      continue;
    }

    const count = countMatches(readFile(file), new RegExp(pattern.source, "g"));
    const allowed = allowlist[file] ?? 0;

    if (count > allowed) {
      expect.fail(
        `${ruleName}: ${file} has ${count} violation(s), allowlist permits ${allowed}. ` +
          `Fix the new violation or do not increase the allowlist.`
      );
    }
    if (count < allowed) {
      expect.fail(
        `${ruleName}: ${file} has ${count} violation(s) but allowlist expects ${allowed}. ` +
          `Remove this entry from the allowlist — the ratchet can only shrink.`
      );
    }
  }
}

describe("outbox contract guard", () => {
  it("no operation: create or update (spec requires upsert or delete only)", () => {
    ratchet("invalid-operation", INVALID_OP_PATTERN, INVALID_OP_ALLOWLIST);
  });

  it("no empty outbox fields", () => {
    ratchet("empty-fields", EMPTY_FIELDS_PATTERN, EMPTY_FIELDS_ALLOWLIST);
  });
});
