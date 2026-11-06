/**
 * Client-safety guard for the maturity-score change surface — a repository
 * lint, not a unit test (improvement-plans/AC-034 through AC-036;
 * design Security Considerations 4 and 6 of implement-maturity-score).
 *
 * It proves the change introduced:
 *   - no `v-html` anywhere in `app/` — all authored and externally supplied
 *     strings (rationale, snapshot titles, helpful-link URLs, override
 *     explanations, ticket references) render through Vue text
 *     interpolation, so no sanitisation gap can exist;
 *   - no new production `window.*` global — the maturity and handoff module
 *     trees may read `window.location.origin` (the copy-text renderer's
 *     absolute-URL base) but must never assign a global. The existing
 *     `window.peakyDB` / `window.__peakySeed` test helpers live in
 *     `app/plugins/` behind `testHelpersEnabled` and are out of scope here.
 *
 * Sibling guarantees this guard deliberately does not duplicate:
 *   - no provider network I/O, no provider-shaped sync entity, clipboard as
 *     the only outbound browser API, capability never in client code —
 *     `tests/guards/handoff-provider-boundary.test.ts`;
 *   - no client-authoritative authorization — server-side
 *     `MaturityOverridePolicy` and `ProviderHandoffPolicy` tests in
 *     `services/internal/authz/` and push-boundary tests in
 *     `services/internal/syncengine/push_handoff_test.go`;
 *   - bounded ticket/handoff payloads — the `handoff-limits/v1` contract
 *     proven in both runtimes against `tests/fixtures/handoff-limits.v1.json`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** Recursively list files under `dir` with one of `exts`, repo-relative. */
function listFiles(dir: string, exts: readonly string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, exts);
    return exts.some((ext) => entry.name.endsWith(ext))
      ? [relative(REPO_ROOT, full)]
      : [];
  });
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}

describe("maturity/handoff client-safety guard", () => {
  it("no v-html exists anywhere in app/ (Security Consideration 4)", () => {
    const vueFiles = listFiles(join(REPO_ROOT, "app"), [".vue"]);
    expect(
      vueFiles.length,
      "scan must be non-empty to prove anything"
    ).toBeGreaterThan(0);
    for (const path of vueFiles) {
      expect(
        /v-html/.test(read(path)),
        `${path} uses v-html — render authored and external strings through ` +
          `text interpolation instead`
      ).toBe(false);
    }
  });

  // The module trees this change added or extended.
  const changeModules = [
    "app/components/handoff",
    "app/components/maturity",
    "app/composables/handoff",
    "app/services/handoff",
    "app/services/maturity",
  ].flatMap((dir) => listFiles(join(REPO_ROOT, dir), [".ts", ".vue"]));

  it("enumerates the change surface it claims to guard", () => {
    expect(
      changeModules.length,
      "change surface scan must be non-empty"
    ).toBeGreaterThan(0);
  });

  it.each(changeModules)(
    "%s assigns no window.* global (Security Consideration 6)",
    (path) => {
      const assignments = [
        ...read(path).matchAll(/window\.(\w+)\s*=[^=]/g),
      ].map((match) => match[1]!);
      expect(
        assignments,
        `${path} assigns window.${assignments[0]} — new globals need a ` +
          `testHelpersEnabled gate and a threat-model row`
      ).toEqual([]);
    }
  );
});
