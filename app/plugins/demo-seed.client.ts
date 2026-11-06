/**
 * Demo-seed plugin — ensures the local SQLite database contains the hardcoded
 * demo product and team on first load.
 *
 * The server stores demo data in ephemeral in-memory arrays that are lost on
 * every Vercel cold start. The local-first client is the real source of truth
 * for product/team lists, so a fresh browser with an empty OPFS database sees
 * nothing until the sync engine pulls from the (often unavailable) Go backend.
 *
 * This plugin bridges the gap by seeding the same IDs the server uses,
 * making the demo product immediately visible without depending on sync.
 */

import { withDatabase, eq, firstOrNull } from "~/local-db";
import { subjects, productProfiles, teamProfiles } from "#shared/db/schema";
import {
  grantTemplateFixtureDraftAccess,
  installTemplateFixtureDrafts,
} from "~/services/template/TemplateFixtureDraftInstaller";
import { readPersistedActor } from "~/composables/auth/persisted-actor";

const DEMO_PRODUCT_ID = "01932b3c-7d00-7000-8000-000000000001";
const DEMO_TEAM_ID = "payments-scalability";

export default defineNuxtPlugin({
  name: "demo-seed",
  dependsOn: ["local-db"],
  async setup() {
    if (import.meta.server) return;

    const isTestEnvironment =
      import.meta.test ||
      (typeof process !== "undefined" && process.env.VITEST === "true");

    // Vitest loads client plugins without a real SQLocal worker. If this seed
    // runs there, SQLocal writes to stderr and can make CI integration jobs fail
    // even though the demo seed is irrelevant to test assertions.
    if (isTestEnvironment) {
      return;
    }

    const { ensureLocalDatabaseReady } = await import("~/local-db/bootstrap");
    await ensureLocalDatabaseReady();
    await installTemplateFixtureDrafts();
    if (import.meta.dev) {
      await grantTemplateFixtureDraftAccess(readPersistedActor().id);
    }

    // Idempotency guard: if any product already exists, the user has real data
    // and we should not inject demo rows.
    const existingProduct = await withDatabase(async (db) => {
      const rows = await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(eq(subjects.type, "product"))
        .limit(1);

      return firstOrNull(rows);
    });

    if (existingProduct) {
      return;
    }

    const now = "2025-01-15T00:00:00Z";

    // ── Demo team ────────────────────────────────────────────────────────
    await withDatabase(async (db) => {
      await db
        .insert(subjects)
        .values({
          id: DEMO_TEAM_ID,
          type: "team",
          name: "Payments Scalability",
          slug: DEMO_TEAM_ID,
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();

      await db
        .insert(teamProfiles)
        .values({
          id: "demo-seed-team-profile",
          subjectId: DEMO_TEAM_ID,
          orgId: "org-payments",
          orgName: "Payments",
          memberCount: 14,
          createdBy: "heitorl",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    });

    // ── Demo product ───────────────────────────────────────────────────
    await withDatabase(async (db) => {
      await db
        .insert(subjects)
        .values({
          id: DEMO_PRODUCT_ID,
          type: "product",
          name: "Demo Payments Scalability",
          slug: DEMO_PRODUCT_ID,
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();

      await db
        .insert(productProfiles)
        .values({
          id: "demo-seed-product-profile",
          subjectId: DEMO_PRODUCT_ID,
          origin: "bespoke",
          isExternal: 0,
          productManagerId: "vlads",
          engineeringLeadId: "heitorl",
          teamIds: JSON.stringify([DEMO_TEAM_ID]),
          componentIds: JSON.stringify(["modificationqueueprocessor"]),
          createdBy: "heitorl",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    });

    console.info(
      "[demo-seed] Seeded demo product and team into local database"
    );
  },
});
