/**
 * Handoff provider-boundary guard — a repository lint, not a unit test
 * (improvement-plans/AC-022, AC-034, AC-035; authorization/AC-021; design
 * Decision 7 of implement-maturity-score).
 *
 * The handoff UI is always available and copy-text is its primary action.
 * This change ships NO provider adapter, reservation endpoint, or route:
 * the only outbound path any handoff journey can reach is the ordinary
 * review-root sync push, and the only user-directed export is a plain-text
 * clipboard write. A future provider integration must pass the single
 * choke point `authz.ProviderHandoffPolicy`, gated by the private server
 * capability `PROVIDER_HANDOFF_INTEGRATION_ENABLED` plus Review
 * authorization — handoff UI availability alone can never authorize a
 * provider operation (AC-035).
 *
 * These assertions enumerate the handoff modules and the sync registry so
 * no current handoff journey — selection, draft edit, reorder, copy,
 * cancellation, existing-ticket association, replacement, completion — can
 * reach a provider adapter. Scanning the module directories means future
 * handoff modules are covered automatically.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** Recursively list files under `dir` with one of `exts`, repo-relative. */
function listFiles(dir: string, exts: readonly string[]): string[] {
  if (!existsSync(dir)) return [];
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

// Every handoff journey runs through these two module trees. Assert the
// scan is non-empty — an empty scan would prove nothing.
const handoffModules = [
  ...listFiles(join(REPO_ROOT, "app/services/handoff"), [".ts"]),
  ...listFiles(join(REPO_ROOT, "app/composables/handoff"), [".ts"]),
];
const goFiles = listFiles(join(REPO_ROOT, "services"), [".go"]);

const NETWORK_PATTERNS: Record<string, RegExp> = {
  $fetch: /\$fetch/,
  useFetch: /\buseFetch\b/,
  "fetch()": /\bfetch\s*\(/,
  XMLHttpRequest: /XMLHttpRequest/,
  sendBeacon: /sendBeacon/,
  WebSocket: /\bWebSocket\b/,
  EventSource: /\bEventSource\b/,
  axios: /\baxios\b/,
};

describe("handoff provider boundary guard", () => {
  it("enumerates the handoff modules it claims to guard", () => {
    // The domain (selection, draft edit, reorder, cancellation,
    // association, replacement) and the copy control must all be present.
    const names = handoffModules.map((path) => path.split("/").at(-1));
    for (const expected of [
      "draft.ts",
      "association.ts",
      "confirmation.ts",
      "projection.ts",
      "copyText.ts",
      "useHandoffCopy.ts",
    ]) {
      expect(names, `handoff module ${expected} not found`).toContain(expected);
    }
  });

  it.each(handoffModules)(
    "%s performs no network I/O (AC-034, AC-035)",
    (path) => {
      const source = read(path);
      for (const [name, pattern] of Object.entries(NETWORK_PATTERNS)) {
        expect(
          pattern.test(source),
          `${path} references ${name} — handoff modules must never invoke ` +
            `the network; sync rides the shared outbox, copy uses the clipboard`
        ).toBe(false);
      }
    }
  );

  it.each(
    handoffModules.filter(
      (path) => path !== "app/services/handoff/association.ts"
    )
  )("%s stays provider-neutral (AC-036)", (path) => {
    expect(
      /jira/i.test(read(path)),
      `${path} mentions Jira — only the URL parser may recognize providers`
    ).toBe(false);
  });

  it("the clipboard is the only browser API handoff modules touch (AC-045)", () => {
    // Copy is a user-directed clipboard write. Any other navigator.* use
    // (beacons, share, credentials) is a new outbound surface.
    for (const path of handoffModules) {
      for (const match of read(path).matchAll(/navigator\.(\w+)/g)) {
        expect(
          match[1],
          `${path} uses navigator.${match[1]} — only navigator.clipboard is allowed`
        ).toBe("clipboard");
      }
    }
  });

  it("the sync entity registry declares no provider entity type (AC-022)", () => {
    // A provider operation would need a payload shape; the registry is the
    // complete list of syncable entity types. Handoff rides the three
    // review-child types from group 6 — nothing provider-shaped exists.
    const registry = read("services/internal/syncengine/entity/registry.go");
    const entityTypes = [
      ...registry.matchAll(/^\t\w+\s+Type = "([^"]+)"/gm),
    ].map((match) => match[1]!);
    expect(entityTypes.length).toBeGreaterThan(0);
    for (const entityType of entityTypes) {
      expect(
        /provider|external_work_item|ticket/i.test(entityType),
        `sync entity type ${entityType} is provider-shaped`
      ).toBe(false);
    }
  });

  it("no Go route registers a provider or handoff path (AC-021)", () => {
    // The handoff journeys synchronize through the existing review-root
    // push/pull routes; a provider route would be a new registration.
    for (const file of goFiles) {
      const routes = [
        ...read(file).matchAll(
          /fuego\.(?:Get|Post|Put|Patch|Delete)\(s,\s*"([^"]+)"/g
        ),
      ].map((match) => match[1]!);
      for (const route of routes) {
        expect(
          /provider|handoff/i.test(route),
          `${file} registers route ${route} — no provider or handoff route ` +
            `may ship before the provider integration change`
        ).toBe(false);
      }
    }
  });

  it("the private capability never reaches client code or public config (AC-035)", () => {
    // Handoff UI availability alone cannot authorize a provider operation:
    // the capability is server-only and must never be serialized to the
    // client bundle or the public runtime config.
    const clientFiles = [
      ...listFiles(join(REPO_ROOT, "app"), [".ts", ".vue"]),
      ...listFiles(join(REPO_ROOT, "shared"), [".ts"]),
      "nuxt.config.ts",
    ];
    for (const path of clientFiles) {
      expect(
        /providerHandoff|PROVIDER_HANDOFF/i.test(read(path)),
        `${path} references the provider handoff capability — it is ` +
          `server-private and must never reach the client`
      ).toBe(false);
    }
  });

  it("the capability has exactly one choke point (AC-021)", () => {
    const allowed = [
      "services/internal/app/config.go",
      "services/internal/app/config_test.go",
      "services/internal/authz/provider.go",
      "services/internal/authz/provider_test.go",
    ];
    const referencing = goFiles.filter((file) =>
      /ProviderHandoffIntegrationEnabled|ProviderHandoffPolicy/.test(read(file))
    );
    expect(
      referencing.toSorted(),
      "the provider capability or policy is referenced outside its choke " +
        "point — review the new caller and update this allowlist deliberately"
    ).toEqual(allowed.toSorted());
    expect(
      existsSync(join(REPO_ROOT, "services/internal/authz/provider.go"))
    ).toBe(true);
  });
});
