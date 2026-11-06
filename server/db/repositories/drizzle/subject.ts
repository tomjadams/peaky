/**
 * Subject repository - teams, products, and organizations.
 *
 * A "subject" is the entity being reviewed. In Peaky, reviews are conducted
 * on teams, products, or organizations - each represented as a subject.
 */
import type { InferSelectModel } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, inArray } from "drizzle-orm";
import { subjects } from "../../schema";

export type Subject = InferSelectModel<typeof subjects>;

export type SubjectInput = Pick<Subject, "id" | "type" | "name" | "slug"> & {
  status?: Subject["status"];
};

export type SubjectUpdate = Partial<Pick<Subject, "name" | "status">>;

export class SubjectRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async findById(id: string): Promise<Subject | null> {
    const result = await this.db
      .select()
      .from(subjects)
      .where(eq(subjects.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findByIds(ids: string[]): Promise<Subject[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(subjects).where(inArray(subjects.id, ids));
  }

  async findByType(type: Subject["type"]): Promise<Subject[]> {
    return this.db.select().from(subjects).where(eq(subjects.type, type));
  }

  async save(data: SubjectInput): Promise<Subject | null> {
    const now = new Date().toISOString();
    await this.db.insert(subjects).values({
      ...data,
      status: data.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(data.id);
  }

  async update(id: string, data: SubjectUpdate): Promise<Subject | null> {
    await this.db
      .update(subjects)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(subjects.id, id));
    return this.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.delete(subjects).where(eq(subjects.id, id));
    return result.changes > 0;
  }
}
