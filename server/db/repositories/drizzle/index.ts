/**
 * Drizzle-based repository implementations.
 *
 * Each repository is a class with constructor dependency injection.
 * All repositories use the in-memory SQLite database via better-sqlite3.
 *
 * When we add PostgreSQL, we'll use the same Drizzle schemas with a different driver.
 *
 * @example
 * // Create repositories with explicit database
 * const db = getDatabase();
 * const repos = createRepositories(db);
 * const subject = await repos.subjects.findById("123");
 */

// Repository classes (each exports its own types)
// Factory for creating all repos with same database
import { SubjectRepository } from "./subject";
import { TemplateRepository } from "./template";
import { ReviewRepository } from "./review";
import { EventRepository } from "./event";
import { SyncRepository } from "./sync";
import { getDatabase } from "../../connection";

export { SubjectRepository } from "./subject";
export { TemplateRepository } from "./template";
export { ReviewRepository } from "./review";
export { EventRepository } from "./event";
export { SyncRepository } from "./sync";

export function createRepositories(db = getDatabase()) {
  return {
    subjects: new SubjectRepository(db),
    templates: new TemplateRepository(db),
    reviews: new ReviewRepository(db),
    events: new EventRepository(db),
    sync: new SyncRepository(db),
  };
}
