import { firstOrNull, nowISO, createUuidV7, eq } from "~/local-db";
import { createEvent } from "~/services/events/createEvent";
import { localMutation } from "~/services/local-mutation";
import { getHLCClock } from "~/services/sync/syncClock";
import type {
  ProductCreated,
  ProductUpdated,
  ProductArchived,
  ProductRestored,
  ProductDeleted,
} from "~/services/events/DomainEvent";
import {
  assertLifecycleConfirmation,
  getDefaultLifecycleActor,
  type LifecycleActor,
} from "~/lifecycle/management";
import type { productOrigin } from "#shared/db/schema";
import { subjects, productProfiles } from "#shared/db/schema";
import {
  type ParsedLocalProduct,
  type ProductSubjectStatus,
  createProductLifecycleAuditRecord,
  fetchLocalProductRecords,
  fetchReviewMetrics,
  parseProductProfile,
} from "./ProductQueries";

export type { ParsedLocalProduct };

// Derive the ProductOrigin type from the schema const
type ProductOrigin = (typeof productOrigin)[number];

export interface LocalLifecycleOptions {
  actor?: LifecycleActor;
  confirmationName?: string;
}

export interface CreateProductInput {
  name: string;
  origin: ProductOrigin;
  isExternal: boolean;
  productManagerId: string;
  engineeringLeadId?: string;
  teamIds: string[];
  componentIds: string[];
  roadmapUrl?: string;
  documentationUrl?: string;
  supportChannel?: string;
  createdBy: string;
}

export type UpdateProductInput = Partial<{
  name: string;
  origin: ProductOrigin;
  isExternal: boolean;
  productManagerId: string;
  engineeringLeadId: string;
  teamIds: string[];
  componentIds: string[];
  roadmapUrl: string;
  documentationUrl: string;
  supportChannel: string;
}>;

export class ProductMutations {
  async fetchAll(): Promise<ParsedLocalProduct[]> {
    const records = await fetchLocalProductRecords();
    const metricsBySubject = await fetchReviewMetrics(
      records.map((record) => record.subjectId)
    );

    return records.map((record) =>
      parseProductProfile(record, metricsBySubject)
    );
  }

  async fetchById(productId: string): Promise<ParsedLocalProduct | null> {
    const records = await fetchLocalProductRecords(productId);
    const record = firstOrNull(records);

    if (!record) {
      return null;
    }

    const metricsBySubject = await fetchReviewMetrics([record.subjectId]);
    return parseProductProfile(record, metricsBySubject);
  }

  async create(input: CreateProductInput): Promise<string> {
    if (!input.name) throw new Error("name is required");
    if (!input.productManagerId)
      throw new Error("productManagerId is required");
    if (!input.createdBy) throw new Error("createdBy is required");

    // Generate IDs
    const subjectId = createUuidV7();
    const profileId = createUuidV7();
    const publicKey = createUuidV7();
    const now = nowISO();

    const event = createEvent<ProductCreated>("ProductCreated.v1", subjectId, {
      name: input.name,
      teamIds: input.teamIds,
      componentIds: input.componentIds,
      origin: input.origin,
      isExternal: input.isExternal,
      productManagerId: input.productManagerId,
      engineeringLeadId: input.engineeringLeadId,
      roadmapUrl: input.roadmapUrl,
      documentationUrl: input.documentationUrl,
      supportChannel: input.supportChannel,
    });

    const clock = getHLCClock();
    // One HLC for the whole creation — all fields are set atomically.
    const hlc = clock.now();

    try {
      await localMutation.commit({
        stateWrite: async (tx) => {
          await tx.insert(subjects).values({
            id: subjectId,
            type: "product",
            name: input.name,
            slug: publicKey,
            status: "active",
            createdAt: now,
            updatedAt: now,
          });

          await tx.insert(productProfiles).values({
            id: profileId,
            subjectId,
            origin: input.origin,
            isExternal: input.isExternal ? 1 : 0,
            productManagerId: input.productManagerId,
            engineeringLeadId: input.engineeringLeadId ?? null,
            teamIds: JSON.stringify(input.teamIds),
            componentIds: JSON.stringify(input.componentIds),
            roadmapUrl: input.roadmapUrl ?? null,
            documentationUrl: input.documentationUrl ?? null,
            supportChannel: input.supportChannel ?? null,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
          });
        },
        event,
        outbox: {
          entityType: "product",
          entityId: subjectId,
          operation: "upsert",
          fields: [
            { name: "name", value: input.name, hlc },
            { name: "slug", value: publicKey, hlc },
            { name: "status", value: "active", hlc },
            { name: "origin", value: input.origin, hlc },
            { name: "isExternal", value: input.isExternal, hlc },
            { name: "productManagerId", value: input.productManagerId, hlc },
            {
              name: "engineeringLeadId",
              value: input.engineeringLeadId ?? null,
              hlc,
            },
            { name: "teamIds", value: input.teamIds, hlc },
            { name: "componentIds", value: input.componentIds, hlc },
            { name: "roadmapUrl", value: input.roadmapUrl ?? null, hlc },
            {
              name: "documentationUrl",
              value: input.documentationUrl ?? null,
              hlc,
            },
            {
              name: "supportChannel",
              value: input.supportChannel ?? null,
              hlc,
            },
          ],
        },
      });

      return subjectId;
    } catch (err) {
      console.error("[ProductMutations.create] Failed:", { input, error: err });
      throw err;
    }
  }

  async update(subjectId: string, updates: UpdateProductInput): Promise<void> {
    if (!subjectId) throw new Error("subjectId is required");

    const now = nowISO();
    const clock = getHLCClock();

    const event = createEvent<ProductUpdated>("ProductUpdated.v1", subjectId, {
      changes: updates,
    });

    // Build the outbox field list from only the changed fields.
    // Products have mutable fields, so each gets its own HLC.
    const fields: { name: string; value: unknown; hlc: string }[] = [];
    if (updates.name !== undefined)
      fields.push({ name: "name", value: updates.name, hlc: clock.now() });
    if (updates.origin !== undefined)
      fields.push({ name: "origin", value: updates.origin, hlc: clock.now() });
    if (updates.isExternal !== undefined)
      fields.push({
        name: "isExternal",
        value: updates.isExternal,
        hlc: clock.now(),
      });
    if (updates.productManagerId !== undefined)
      fields.push({
        name: "productManagerId",
        value: updates.productManagerId,
        hlc: clock.now(),
      });
    if (updates.engineeringLeadId !== undefined)
      fields.push({
        name: "engineeringLeadId",
        value: updates.engineeringLeadId,
        hlc: clock.now(),
      });
    if (updates.teamIds !== undefined)
      fields.push({
        name: "teamIds",
        value: updates.teamIds,
        hlc: clock.now(),
      });
    if (updates.componentIds !== undefined)
      fields.push({
        name: "componentIds",
        value: updates.componentIds,
        hlc: clock.now(),
      });
    if (updates.roadmapUrl !== undefined)
      fields.push({
        name: "roadmapUrl",
        value: updates.roadmapUrl,
        hlc: clock.now(),
      });
    if (updates.documentationUrl !== undefined)
      fields.push({
        name: "documentationUrl",
        value: updates.documentationUrl,
        hlc: clock.now(),
      });
    if (updates.supportChannel !== undefined)
      fields.push({
        name: "supportChannel",
        value: updates.supportChannel,
        hlc: clock.now(),
      });

    if (fields.length === 0) return;

    await localMutation.commit({
      stateWrite: async (tx) => {
        // Always bump subjects.updatedAt — the fields.length === 0 guard
        // above ensures at least one field changed. Only set name when
        // explicitly provided (including empty string) to match the
        // outbox payload which uses updates.name !== undefined.
        const subjectUpdates: Partial<typeof subjects.$inferInsert> = {
          updatedAt: now,
        };
        if (updates.name !== undefined) subjectUpdates.name = updates.name;
        await tx
          .update(subjects)
          .set(subjectUpdates)
          .where(eq(subjects.id, subjectId));

        const profileUpdates: Partial<typeof productProfiles.$inferInsert> = {};

        if (updates.origin !== undefined)
          profileUpdates.origin = updates.origin;
        if (updates.isExternal !== undefined)
          profileUpdates.isExternal = updates.isExternal ? 1 : 0;
        if (updates.productManagerId !== undefined)
          profileUpdates.productManagerId = updates.productManagerId;
        if (updates.engineeringLeadId !== undefined)
          profileUpdates.engineeringLeadId = updates.engineeringLeadId;
        if (updates.teamIds !== undefined)
          profileUpdates.teamIds = JSON.stringify(updates.teamIds);
        if (updates.componentIds !== undefined)
          profileUpdates.componentIds = JSON.stringify(updates.componentIds);
        if (updates.roadmapUrl !== undefined)
          profileUpdates.roadmapUrl = updates.roadmapUrl;
        if (updates.documentationUrl !== undefined)
          profileUpdates.documentationUrl = updates.documentationUrl;
        if (updates.supportChannel !== undefined)
          profileUpdates.supportChannel = updates.supportChannel;

        if (Object.keys(profileUpdates).length > 0) {
          profileUpdates.updatedAt = now;
          await tx
            .update(productProfiles)
            .set(profileUpdates)
            .where(eq(productProfiles.subjectId, subjectId));
        }
      },
      event,
      outbox: {
        entityType: "product",
        entityId: subjectId,
        operation: "upsert",
        fields,
      },
    });
  }

  async delete(
    subjectId: string,
    options: LocalLifecycleOptions = {}
  ): Promise<void> {
    if (!subjectId) throw new Error("subjectId is required");

    const existingProduct = await this.fetchById(subjectId);

    if (!existingProduct) {
      return;
    }

    if (existingProduct.status !== "archived") {
      throw new Error("Only archived products can be deleted");
    }

    assertLifecycleConfirmation(
      existingProduct.name,
      options.confirmationName,
      "product"
    );

    const actor = options.actor ?? getDefaultLifecycleActor();
    const _audit = createProductLifecycleAuditRecord(
      existingProduct,
      subjectId,
      "delete",
      actor
    );

    const event = createEvent<ProductDeleted>("ProductDeleted.v1", subjectId, {
      name: existingProduct.name,
    });

    await localMutation.commit({
      stateWrite: async (tx) => {
        await tx
          .delete(productProfiles)
          .where(eq(productProfiles.subjectId, subjectId));
        await tx.delete(subjects).where(eq(subjects.id, subjectId));
      },
      event,
      outbox: {
        entityType: "product",
        entityId: subjectId,
        operation: "delete",
        fields: [],
      },
    });
  }

  async archive(
    subjectId: string,
    options: LocalLifecycleOptions = {}
  ): Promise<void> {
    await this._updateStatus(subjectId, "archived", options);
  }

  async restore(
    subjectId: string,
    options: LocalLifecycleOptions = {}
  ): Promise<void> {
    await this._updateStatus(subjectId, "active", options);
  }

  private async _updateStatus(
    subjectId: string,
    status: ProductSubjectStatus,
    options: LocalLifecycleOptions = {}
  ): Promise<void> {
    if (!subjectId) throw new Error("subjectId is required");

    const existingProduct = await this.fetchById(subjectId);

    if (!existingProduct) {
      throw new Error("Product not found");
    }

    const actor = options.actor ?? getDefaultLifecycleActor();
    const now = nowISO();
    const _audit = createProductLifecycleAuditRecord(
      existingProduct,
      subjectId,
      status === "archived" ? "archive" : "restore",
      actor
    );

    const event =
      status === "archived"
        ? createEvent<ProductArchived>("ProductArchived.v1", subjectId, {
            previousStatus: existingProduct.status,
          })
        : createEvent<ProductRestored>("ProductRestored.v1", subjectId, {
            previousStatus: existingProduct.status,
          });

    const clock = getHLCClock();

    await localMutation.commit({
      stateWrite: async (tx) => {
        await tx
          .update(subjects)
          .set({ status, updatedAt: now })
          .where(eq(subjects.id, subjectId));
      },
      event,
      outbox: {
        entityType: "product",
        entityId: subjectId,
        operation: "upsert",
        fields: [{ name: "status", value: status, hlc: clock.now() }],
      },
    });
  }
}

export const productMutations = new ProductMutations();
