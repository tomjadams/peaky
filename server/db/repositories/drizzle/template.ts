/**
 * Template repository - assessment templates with pillars and questions.
 */
import type { InferSelectModel } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { templates, templatePillars } from "../../schema";

export type Template = InferSelectModel<typeof templates>;
export type TemplatePillar = InferSelectModel<typeof templatePillars>;

export type TemplateInput = Pick<Template, "id" | "name"> & {
  description?: Template["description"];
  status?: Template["status"];
};

export class TemplateRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async findById(id: string): Promise<Template | null> {
    const result = await this.db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findActive(): Promise<Template[]> {
    return this.db
      .select()
      .from(templates)
      .where(eq(templates.status, "active"));
  }

  async save(_data: TemplateInput): Promise<Template | null> {
    throw new Error("template_write_unavailable");
  }

  async getPillarsByRevisionId(revisionId: string): Promise<TemplatePillar[]> {
    return this.db
      .select()
      .from(templatePillars)
      .where(eq(templatePillars.templateRevisionId, revisionId));
  }
}
