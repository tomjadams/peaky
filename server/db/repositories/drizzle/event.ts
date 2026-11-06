/**
 * Event repository - append-only audit log for reviews.
 *
 * Events record how review state changed over time (who, what, when).
 * Used for history derivation and audit trails.
 */
import type { InferSelectModel } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, desc } from "drizzle-orm";
import { events } from "../../schema";

export type ReviewEvent = InferSelectModel<typeof events>;

export type ReviewEventInput = Pick<
  ReviewEvent,
  "id" | "eventType" | "actorType" | "actorId" | "time"
> & {
  reviewId?: ReviewEvent["reviewId"];
  data?: ReviewEvent["data"];
  status?: ReviewEvent["status"];
};

export class EventRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async save(data: ReviewEventInput): Promise<ReviewEvent> {
    await this.db.insert(events).values({
      ...data,
      status: data.status ?? "pending",
    });
    const result = await this.db
      .select()
      .from(events)
      .where(eq(events.id, data.id))
      .limit(1);
    const event = result[0];
    if (!event) throw new Error(`Failed to save event ${data.id}`);
    return event;
  }

  async findByReviewId(reviewId: string, limit = 50): Promise<ReviewEvent[]> {
    return this.db
      .select()
      .from(events)
      .where(eq(events.reviewId, reviewId))
      .orderBy(desc(events.time))
      .limit(limit);
  }

  async findPending(limit = 100): Promise<ReviewEvent[]> {
    return this.db
      .select()
      .from(events)
      .where(eq(events.status, "pending"))
      .orderBy(desc(events.time))
      .limit(limit);
  }
}
