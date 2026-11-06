/**
 * Review repository - assessments with answers and progress.
 *
 * A "review" is an assessment conducted on a subject (team, product, or organization).
 * Reviews progress through stages: draft → in-progress → completed → archived.
 *
 * @example
 * // Find all reviews for a product (subject)
 * const repo = new ReviewRepository(db);
 * const reviews = await repo.findBySubjectId("product_123");
 */
import type { InferSelectModel } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { reviews } from "../../schema";

export type Review = InferSelectModel<typeof reviews>;

export type ReviewInput = Pick<Review, "id" | "subjectId" | "name"> & {
  status?: Review["status"];
};

export type ReviewUpdate = Partial<Pick<Review, "name" | "status">>;

export class ReviewRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async findById(id: string): Promise<Review | null> {
    const result = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Find all reviews for a subject (team, product, or organization).
   */
  async findBySubjectId(subjectId: string): Promise<Review[]> {
    return this.db
      .select()
      .from(reviews)
      .where(eq(reviews.subjectId, subjectId));
  }

  async save(data: ReviewInput): Promise<Review | null> {
    const now = new Date().toISOString();
    await this.db.insert(reviews).values({
      ...data,
      status: data.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(data.id);
  }

  async update(id: string, data: ReviewUpdate): Promise<Review | null> {
    await this.db
      .update(reviews)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(reviews.id, id));
    return this.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(reviews).where(eq(reviews.id, id));
    return result.changes > 0;
  }
}
