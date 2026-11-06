/**
 * Property-based tests for the MySQL DDL → Drizzle SQLite codegen script.
 *
 * Tests cover all 6 type mappings, NOT NULL, DEFAULT, PRIMARY KEY, UNIQUE KEY,
 * INDEX, FOREIGN KEY, snake_case → camelCase, and $defaultFn conventions.
 *
 * Each group uses multiple concrete inputs to form a property-like suite
 * without a separate library.
 */
import { describe, expect, it } from "vitest";
import {
  mapType,
  toCamel,
  parseTables,
  generateFile,
} from "../../../scripts/generate-drizzle-from-sql";

// ---------------------------------------------------------------------------
// mapType — all 6 mappings
// ---------------------------------------------------------------------------

describe("mapType", () => {
  it.each([
    ["VARCHAR(255)", "text"],
    ["VARCHAR(50)", "text"],
    ["VARCHAR(1000)", "text"],
    ["TEXT", "text"],
    ["DATETIME(6)", "text"],
    ["JSON", "text"],
    ["INT", "integer"],
    ["INTEGER", "integer"],
    ["BOOLEAN", "integer"],
  ])("maps %s → %s", (mysqlType, expected) => {
    expect(mapType(mysqlType)).toBe(expected);
  });

  it("throws for unknown types", () => {
    expect(() => mapType("FLOAT")).toThrow();
    expect(() => mapType("BIGINT")).toThrow();
    expect(() => mapType("BLOB")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// toCamel — snake_case → camelCase
// ---------------------------------------------------------------------------

describe("toCamel", () => {
  it.each([
    ["actor_id", "actorId"],
    ["created_at", "createdAt"],
    ["review_answer_state", "reviewAnswerState"],
    ["id", "id"],
    ["hlc", "hlc"],
    ["entity_type", "entityType"],
    ["template_version_id", "templateVersionId"],
  ])("converts %s → %s", (input, expected) => {
    expect(toCamel(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// parseTables — structural parsing
// ---------------------------------------------------------------------------

describe("parseTables", () => {
  it("parses a simple table with all 6 MySQL types", () => {
    const sql = `
      CREATE TABLE all_types (
        id            VARCHAR(255) NOT NULL,
        label         TEXT,
        count         INT NOT NULL DEFAULT 0,
        flag          BOOLEAN NOT NULL DEFAULT 0,
        payload       JSON,
        recorded_at   DATETIME(6) NOT NULL,
        PRIMARY KEY (id)
      );
    `;
    const [table] = parseTables(sql);
    expect(table!.name).toBe("all_types");

    const byName = Object.fromEntries(table!.columns.map((c) => [c.name, c]));
    expect(byName["id"]!.type).toBe("text");
    expect(byName["label"]!.type).toBe("text");
    expect(byName["count"]!.type).toBe("integer");
    expect(byName["flag"]!.type).toBe("integer");
    expect(byName["payload"]!.type).toBe("text");
    expect(byName["recorded_at"]!.type).toBe("text");
  });

  it("captures NOT NULL correctly", () => {
    const sql = `
      CREATE TABLE nullable_check (
        required_col VARCHAR(255) NOT NULL,
        optional_col TEXT,
        PRIMARY KEY (required_col)
      );
    `;
    const [table] = parseTables(sql);
    const byName = Object.fromEntries(table!.columns.map((c) => [c.name, c]));
    expect(byName["required_col"]!.notNull).toBe(true);
    expect(byName["optional_col"]!.notNull).toBe(false);
  });

  it("captures string DEFAULT values", () => {
    const sql = `
      CREATE TABLE defaults_str (
        id     VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        source VARCHAR(100) NOT NULL DEFAULT 'peaky.client',
        PRIMARY KEY (id)
      );
    `;
    const [table] = parseTables(sql);
    const byName = Object.fromEntries(table!.columns.map((c) => [c.name, c]));
    expect(byName["status"]!.defaultValue).toBe("active");
    expect(byName["source"]!.defaultValue).toBe("peaky.client");
  });

  it("captures numeric DEFAULT values", () => {
    const sql = `
      CREATE TABLE defaults_num (
        id       VARCHAR(255) NOT NULL,
        position INT NOT NULL DEFAULT 0,
        retries  INT NOT NULL DEFAULT 3,
        PRIMARY KEY (id)
      );
    `;
    const [table] = parseTables(sql);
    const byName = Object.fromEntries(table!.columns.map((c) => [c.name, c]));
    expect(byName["position"]!.defaultValue).toBe(0);
    expect(byName["retries"]!.defaultValue).toBe(3);
  });

  it("parses UNIQUE KEY constraints", () => {
    const sql = `
      CREATE TABLE unique_check (
        id   VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY unique_check_slug_unique (slug)
      );
    `;
    const [table] = parseTables(sql);
    const unique = table!.indexes.filter((i) => i.unique);
    expect(unique).toHaveLength(1);
    expect(unique[0]!.name).toBe("unique_check_slug_unique");
    expect(unique[0]!.columns).toEqual(["slug"]);
  });

  it("parses INDEX constraints", () => {
    const sql = `
      CREATE TABLE index_check (
        id        VARCHAR(255) NOT NULL,
        actor_id  VARCHAR(255) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        PRIMARY KEY (id),
        INDEX index_check_actor_idx (actor_id),
        INDEX index_check_entity_idx (entity_id)
      );
    `;
    const [table] = parseTables(sql);
    const plain = table!.indexes.filter((i) => !i.unique);
    expect(plain).toHaveLength(2);
    expect(plain.map((i) => i.name)).toContain("index_check_actor_idx");
    expect(plain.map((i) => i.name)).toContain("index_check_entity_idx");
  });

  it("parses composite index columns", () => {
    const sql = `
      CREATE TABLE composite_idx (
        id          VARCHAR(255) NOT NULL,
        review_id   VARCHAR(255) NOT NULL,
        question_id VARCHAR(255) NOT NULL,
        PRIMARY KEY (id),
        INDEX composite_idx_review_question_idx (review_id, question_id)
      );
    `;
    const [table] = parseTables(sql);
    const idx = table!.indexes[0]!;
    expect(idx.columns).toEqual(["review_id", "question_id"]);
  });

  it("parses PostgreSQL-style standalone CREATE INDEX", () => {
    const sql = `
      CREATE TABLE standalone_idx (
        id     VARCHAR(255) NOT NULL,
        col1   VARCHAR(255) NOT NULL,
        col2   VARCHAR(255) NOT NULL,
        PRIMARY KEY (id)
      );
      CREATE INDEX idx_standalone_cols ON standalone_idx (col1, col2);
      CREATE UNIQUE INDEX idx_standalone_unique ON standalone_idx (id);
    `;
    const [table] = parseTables(sql);
    expect(table!.indexes).toHaveLength(2);

    const plain = table!.indexes.find((i) => i.name === "idx_standalone_cols");
    expect(plain).toBeDefined();
    expect(plain!.unique).toBe(false);
    expect(plain!.columns).toEqual(["col1", "col2"]);

    const unique = table!.indexes.find(
      (i) => i.name === "idx_standalone_unique"
    );
    expect(unique).toBeDefined();
    expect(unique!.unique).toBe(true);
    expect(unique!.columns).toEqual(["id"]);
  });

  it("parses FOREIGN KEY constraints", () => {
    const sql = `
      CREATE TABLE child_table (
        id        VARCHAR(255) NOT NULL,
        parent_id VARCHAR(255) NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT fk_child_parent FOREIGN KEY (parent_id) REFERENCES parent_table (id) ON DELETE CASCADE
      );
    `;
    const [table] = parseTables(sql);
    expect(table!.foreignKeys).toHaveLength(1);
    const fk = table!.foreignKeys[0]!;
    expect(fk.column).toBe("parent_id");
    expect(fk.refTable).toBe("parent_table");
    expect(fk.refColumn).toBe("id");
    expect(fk.onDelete).toBe("CASCADE");
  });

  it("parses multiple tables from one SQL string", () => {
    const sql = `
      CREATE TABLE alpha (
        id VARCHAR(255) NOT NULL,
        PRIMARY KEY (id)
      );
      CREATE TABLE beta (
        id VARCHAR(255) NOT NULL,
        PRIMARY KEY (id)
      );
    `;
    const tables = parseTables(sql);
    expect(tables).toHaveLength(2);
    expect(tables.map((t) => t.name)).toEqual(["alpha", "beta"]);
  });

  it("strips SQL comments before parsing", () => {
    const sql = `
      CREATE TABLE comment_table (
        -- this is a comment
        id     VARCHAR(255) NOT NULL, -- inline comment
        status VARCHAR(50) NOT NULL DEFAULT 'active',  -- 'active' | 'archived'
        PRIMARY KEY (id)
      );
    `;
    const [table] = parseTables(sql);
    const byName = Object.fromEntries(table!.columns.map((c) => [c.name, c]));
    expect(byName["id"]).toBeDefined();
    expect(byName["status"]!.defaultValue).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// generateFile — code output shape
// ---------------------------------------------------------------------------

describe("generateFile", () => {
  it("emits GENERATED header", () => {
    const tables = parseTables(`
      CREATE TABLE widgets (
        id VARCHAR(255) NOT NULL,
        PRIMARY KEY (id)
      );
    `);
    const code = generateFile("widget", tables);
    expect(code).toContain("GENERATED FILE");
  });

  it("emits drizzle-orm/sqlite-core import with used functions", () => {
    const tables = parseTables(`
      CREATE TABLE widgets (
        id    VARCHAR(255) NOT NULL,
        count INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        INDEX widgets_count_idx (count)
      );
    `);
    const code = generateFile("widget", tables);
    expect(code).toContain(`from "drizzle-orm/sqlite-core"`);
    expect(code).toContain("text");
    expect(code).toContain("integer");
    expect(code).toContain("index");
  });

  it("generates text() for VARCHAR columns", () => {
    const tables = parseTables(`
      CREATE TABLE t (
        id VARCHAR(255) NOT NULL,
        PRIMARY KEY (id)
      );
    `);
    const code = generateFile("t", tables);
    expect(code).toContain(`text("id")`);
  });

  it("generates integer() for INT columns", () => {
    const tables = parseTables(`
      CREATE TABLE t (
        id VARCHAR(255) NOT NULL,
        n  INT NOT NULL,
        PRIMARY KEY (id)
      );
    `);
    const code = generateFile("t", tables);
    expect(code).toContain(`integer("n")`);
  });

  it("generates .notNull() for NOT NULL columns", () => {
    const tables = parseTables(`
      CREATE TABLE t (
        id   VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        PRIMARY KEY (id)
      );
    `);
    const code = generateFile("t", tables);
    expect(code).toContain("notNull()");
  });

  it("generates .default() for columns with defaults", () => {
    const tables = parseTables(`
      CREATE TABLE t (
        id     VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        PRIMARY KEY (id)
      );
    `);
    const code = generateFile("t", tables);
    expect(code).toContain(`.default("active")`);
  });

  it("generates uniqueIndex() for UNIQUE KEY constraints", () => {
    const tables = parseTables(`
      CREATE TABLE t (
        id   VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY t_slug_unique (slug)
      );
    `);
    const code = generateFile("t", tables);
    expect(code).toContain("uniqueIndex");
    expect(code).toContain(`"t_slug_unique"`);
  });

  it("generates index() for INDEX constraints", () => {
    const tables = parseTables(`
      CREATE TABLE t (
        id       VARCHAR(255) NOT NULL,
        actor_id VARCHAR(255) NOT NULL,
        PRIMARY KEY (id),
        INDEX t_actor_idx (actor_id)
      );
    `);
    const code = generateFile("t", tables);
    expect(code).toContain("index");
    expect(code).toContain(`"t_actor_idx"`);
  });

  it("generates .references() for FOREIGN KEY columns", () => {
    const tables = parseTables(`
      CREATE TABLE parent (
        id VARCHAR(255) NOT NULL,
        PRIMARY KEY (id)
      );
      CREATE TABLE child (
        id        VARCHAR(255) NOT NULL,
        parent_id VARCHAR(255) NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT fk_child FOREIGN KEY (parent_id) REFERENCES parent (id) ON DELETE CASCADE
      );
    `);
    const code = generateFile("combined", tables);
    expect(code).toContain("references");
    expect(code).toContain(`onDelete: "cascade"`);
  });

  it("generates $defaultFn for created_at and updated_at", () => {
    const tables = parseTables(`
      CREATE TABLE t (
        id         VARCHAR(255) NOT NULL,
        created_at DATETIME(6) NOT NULL,
        updated_at DATETIME(6) NOT NULL,
        PRIMARY KEY (id)
      );
    `);
    const code = generateFile("t", tables);
    expect(code).toContain("$defaultFn");
    expect(code).toContain("new Date().toISOString()");
  });

  it("converts snake_case table/column names to camelCase TS properties", () => {
    const tables = parseTables(`
      CREATE TABLE review_answer_state (
        review_id   VARCHAR(255) NOT NULL,
        question_id VARCHAR(255) NOT NULL,
        PRIMARY KEY (review_id)
      );
    `);
    const code = generateFile("review", tables);
    expect(code).toContain("reviewAnswerState");
    expect(code).toContain("reviewId");
    expect(code).toContain("questionId");
    // DB column names stay snake_case inside text()/integer()
    expect(code).toContain(`"review_id"`);
    expect(code).toContain(`"question_id"`);
  });
});
