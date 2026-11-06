/**
 * Test-seed plugin — exposes local-first mutation functions on `window.__peakySeed`.
 *
 * **Dev/test only** — this plugin is a no-op in production builds.
 *
 * ## Why this exists
 *
 * The app's source of truth is a browser-local SQLite database (OPFS via SQLocal).
 * Playwright E2E tests run in Node.js and can only reach the browser through
 * `page.evaluate()`. Raw SQL seeding works but is fragile — every schema migration
 * would require updating the seed SQL by hand.
 *
 * Instead, we expose production mutations plus one test-only snapshot helper:
 *
 *   - `createLocalTemplateDraft` / `addLocalPillar` / `addLocalQuestion`
 *   - `freezeTemplateFixture` (test-only immutable Review fixture)
 *   - `productMutations.create`
 *   - `reviewMutations.create`
 *   - `createTeam` (Drizzle insert — no mutation class exists for teams)
 *
 * This means E2E seeds go through the real code path: Drizzle schema validation,
 * domain event emission, and outbox queueing. If a migration changes the schema,
 * TypeScript catches it at compile time instead of failing silently at runtime.
 *
 * ## Architecture note for maintainers
 *
 * The local-first architecture means there is no server API for creating templates,
 * products, or reviews — all writes happen client-side via the mutation layer.
 * The server only provides read-only catalog data (organizations, catalog users)
 * and accepts sync pushes from the client outbox.
 *
 * This plugin bridges the gap between Playwright (Node.js) and the browser by
 * putting the mutation functions on `window.__peakySeed`, which the E2E seed
 * helper (`tests/e2e/helpers/seed.ts`) calls via `page.evaluate()`.
 *
 * @see tests/e2e/helpers/seed.ts         — Playwright-side seed orchestration
 * @see app/services/entity/              — Mutation classes (the real write layer)
 * @see app/composables/local/            — Template draft CRUD (pillars, questions)
 * @see app/plugins/local-db.client.ts    — Database bootstrap and window.peakyDB debug helpers
 */

import { createLocalTemplateDraft } from "~/composables/local/useLocalTemplateDraft";
import { addLocalPillar } from "~/composables/local/useLocalTemplatePillars";
import {
  addLocalQuestion,
  updateLocalQuestion,
} from "~/composables/local/useLocalTemplateQuestions";
import { productMutations } from "~/services/entity/ProductMutations";
import { reviewMutations } from "~/services/entity/ReviewMutations";
import { answerMutations } from "~/services/entity/AnswerMutations";
import { syncRunner } from "~/services/sync/syncRunner";
import { withDatabase, createUuidV7, nowISO, eq } from "~/local-db";
import { subjects, teamProfiles, templateRevisions } from "#shared/db/schema";
import { fetchDirectoryGroups } from "~/catalog-directory-mirror/local";
import { EntitlementService } from "~/services/entitlement/EntitlementService";
import { readPersistedActor } from "~/composables/auth/persisted-actor";

/** Poll until the scheduler singleton is registered, then signal readiness. */
const MAX_READY_RETRIES = 290; // 29s at 100ms — under awaitSeedReady's 30s timeout
let readyRetries = 0;

function checkSyncReady() {
  if (syncRunner.isRegistered()) {
    window.peakySyncReady = true;
  } else if (++readyRetries < MAX_READY_RETRIES) {
    setTimeout(checkSyncReady, 100);
  } else {
    console.warn(
      "[test-seed] sync scheduler not registered after 29s — default.vue layout may not have mounted"
    );
  }
}

/**
 * Create a team in the local database.
 *
 * Teams are read-only in production (sourced from the server catalog), so there
 * is no TeamMutations.create() method. For E2E seeding we insert directly via
 * Drizzle — still schema-aware, so migrations won't silently break this.
 */
async function createTeam(input: {
  name: string;
  orgId?: string;
  orgName?: string;
}): Promise<string> {
  const id = createUuidV7();
  const now = nowISO();

  await withDatabase(async (db) => {
    await db.insert(subjects).values({
      id,
      type: "team",
      name: input.name,
      slug: id,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(teamProfiles).values({
      id: createUuidV7(),
      subjectId: id,
      orgId: input.orgId ?? "org-e2e",
      orgName: input.orgName ?? "E2E Org",
      memberCount: 5,
      createdBy: "e2e-seed",
      createdAt: now,
      updatedAt: now,
    });
  });

  return id;
}

async function grantTemplateEdit(): Promise<void> {
  const actorId = readPersistedActor().id;
  const service = new EntitlementService();
  const snapshot = await service.getSnapshot(actorId);
  if (!snapshot) {
    await service.saveSnapshot(actorId, {
      "template:*": { canEdit: true, canView: true },
    });
    return;
  }
  await service.updateEntitlement(actorId, "template", "*", {
    canEdit: true,
    canView: true,
  });
}

// Production publication is frozen. E2E Reviews still need an immutable
// snapshot, so the test-only bridge freezes a separate draft fixture in place.
async function freezeTemplateFixture(revisionId: string): Promise<string> {
  const now = nowISO();
  await withDatabase((db) =>
    db
      .update(templateRevisions)
      .set({
        status: "published",
        revisionNumber: 1,
        revisionSummary: "E2E fixture",
        updatedAt: now,
        publishedAt: now,
        publishedByActorId: "e2e-seed",
      })
      .where(eq(templateRevisions.id, revisionId))
  );
  return revisionId;
}

export default defineNuxtPlugin({
  name: "test-seed",
  dependsOn: ["local-db"],
  setup() {
    if (import.meta.server) return;
    // Gate via runtime config (true in local dev + Vercel preview, false in
    // real production). This is what lets Playwright run E2E against a
    // preview deployment instead of forcing it to a local dev server.
    if (!useRuntimeConfig().public.testHelpersEnabled) return;

    window.__peakySeed = {
      ensureDirectoryGroups: fetchDirectoryGroups,
      grantTemplateEdit,

      // ── Templates ──────────────────────────────────────────────────────
      // Creates a draft → add pillars → add questions → publish to "active"
      createTemplateDraft: createLocalTemplateDraft,
      addPillar: addLocalPillar,
      addQuestion: addLocalQuestion,
      // Lets E2E seeds attach checklist items / leading practices / helpful
      // links after creation, e.g. to exercise the kiosk survey's info rail.
      updateQuestion: updateLocalQuestion,
      freezeTemplateFixture,

      // ── Products ───────────────────────────────────────────────────────
      // Full mutation: subjects + product_profiles + domain event + outbox
      createProduct: (input: Parameters<typeof productMutations.create>[0]) =>
        productMutations.create(input),

      // ── Reviews ────────────────────────────────────────────────────────
      // Full mutation: reviews + template_selections + domain event + outbox
      createReview: (input: Parameters<typeof reviewMutations.create>[0]) =>
        reviewMutations.create(input),
      saveAnswer: (input: Parameters<typeof answerMutations.save>[0]) =>
        answerMutations.save(input),

      // ── Teams ──────────────────────────────────────────────────────────
      // Drizzle insert (no mutation class — teams are server-catalog read-only)
      createTeam,

      // ── Sync ───────────────────────────────────────────────────────────
      // Force a push+pull cycle now. Background tabs are timer-throttled in
      // headless multi-page runs, so the scheduler may never fire on its own;
      // persona e2e tests call this to drain the outbox and pull entitlement-
      // scoped events deterministically.
      syncNow: () => syncRunner.runSyncCycle(),
    };

    // Signal sync readiness after the scheduler singleton is registered by
    // useSyncClient (which runs in default.vue layout's setup). We poll
    // instead of using onNuxtReady directly because onNuxtReady can fire
    // before the layout mounts (e.g. on auth/login.vue where default.vue
    // never mounts), which would signal readiness with no scheduler.
    // The flag is intentionally never reset — it tracks "the scheduler has
    // been created at least once", not "a sync is in progress". Tests poll
    // for syncNow() results separately via expectSees().
    onNuxtReady(checkSyncReady);
  },
});
