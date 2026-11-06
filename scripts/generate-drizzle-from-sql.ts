#!/usr/bin/env tsx
/**
 * Codegen: services/schema.sql → shared/db/schema/*.ts
 *
 * Reads the PostgreSQL DDL (single source of truth) and emits Drizzle sqliteTable()
 * definitions for the client SQLite schema. Run via `pnpm gen:schemas`.
 *
 * Type mapping (PostgreSQL → SQLite Drizzle):
 *   TEXT / VARCHAR(N)            → text()
 *   TIMESTAMPTZ / TIMESTAMP      → text()  (stored as ISO-8601 string in SQLite)
 *   JSONB / JSON                 → text()  (stored as JSON string in SQLite)
 *   INT / INTEGER                → integer()
 *   BOOLEAN                      → integer()
 *
 * Generated files have a "GENERATED" header. Do not edit them directly —
 * edit services/schema.sql and re-run this script.
 * TypeScript-only additions (enum arrays, $defaultFn, type exports) live in
 * shared/db/schema/extensions/*.ts and are imported by the generated files.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCHEMA_SQL = join(ROOT, "services/schema.sql");
// Output to generated/ so hand-written files (with enum arrays, type exports)
// are not overwritten. Run `pnpm gen:schemas` then diff against shared/db/schema/
// for the parity check (task 1.7). Once verified, generated files become the
// source of truth and hand-written ones are retired.
const OUT_DIR = join(ROOT, "shared/db/schema/generated");

// --- Type mapping -----------------------------------------------------------

// PostgreSQL types that map to SQLite text() (ISO-8601 strings, JSON strings, etc.)
const TEXT_TYPES = new Set([
  "varchar",
  "text",
  "datetime",
  "json",
  "jsonb",
  "timestamptz",
  "timestamp",
]);

function mapType(mysqlType: string): "text" | "integer" {
  const base = mysqlType
    .toLowerCase()
    .replace(/\(.*\)/, "")
    .trim();
  if (TEXT_TYPES.has(base)) return "text";
  if (base === "int" || base === "integer" || base === "boolean")
    return "integer";
  throw new Error(`Unknown MySQL type: ${mysqlType}`);
}

// --- snake_case → camelCase -------------------------------------------------

function toCamel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// --- SQL parser -------------------------------------------------------------

interface ColumnDef {
  name: string; // snake_case
  type: "text" | "integer";
  notNull: boolean;
  defaultValue: string | number | null; // raw SQL default value
  isPrimaryKey: boolean;
}

interface IndexDef {
  name: string;
  columns: string[];
  unique: boolean;
}

interface ForeignKeyDef {
  column: string;
  refTable: string;
  refColumn: string;
  onDelete?: string;
}

interface TableDef {
  name: string;
  columns: ColumnDef[];
  indexes: IndexDef[];
  foreignKeys: ForeignKeyDef[];
}

function parseTables(sql: string): TableDef[] {
  const tables: TableDef[] = [];
  // Strip comments and normalise trailing whitespace so splits are consistent
  const clean = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/[ \t]+$/gm, "");

  // Pass 1: parse CREATE TABLE bodies
  const createRe = /CREATE\s+TABLE\s+(\w+)\s*\(([\s\S]*?)\);/gi;
  let match: RegExpExecArray | null;
  while ((match = createRe.exec(clean)) !== null) {
    const tableName = match[1]!.toLowerCase();
    const body = match[2]!;
    tables.push({ name: tableName, ...parseTableBody(body) });
  }

  // Pass 2: parse standalone CREATE [UNIQUE] INDEX name ON table (cols) statements.
  // PostgreSQL indexes live outside CREATE TABLE — MySQL had them inline.
  const idxRe =
    /CREATE\s+(UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\)/gi; // eslint-disable-line security/detect-unsafe-regex
  while ((match = idxRe.exec(clean)) !== null) {
    const isUnique = !!match[1];
    const idxName = match[2]!.toLowerCase();
    const tableName = match[3]!.toLowerCase();
    const cols = match[4]!.split(",").map((c) => c.trim().toLowerCase());
    const table = tables.find((t) => t.name === tableName);
    if (table) {
      table.indexes.push({ name: idxName, columns: cols, unique: isUnique });
    }
  }

  return tables;
}

function parseTableBody(body: string): Omit<TableDef, "name"> {
  const columns: ColumnDef[] = [];
  const indexes: IndexDef[] = [];
  const foreignKeys: ForeignKeyDef[] = [];

  const lines = body
    .split(",\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Pass 1: collect primary key columns from table-level PRIMARY KEY constraint
  const pkColumns = new Set<string>();
  for (const line of lines) {
    const pkMatch = line.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (pkMatch) {
      pkMatch[1]!
        .split(",")
        .forEach((c) => pkColumns.add(c.trim().toLowerCase()));
    }
  }

  // Pass 2: parse columns and other constraints
  for (const line of lines) {
    // CONSTRAINT ... FOREIGN KEY
    const fkMatch = line.match(
      /CONSTRAINT\s+\w+\s+FOREIGN\s+KEY\s*\((\w+)\)\s+REFERENCES\s+(\w+)\s*\((\w+)\)(?:\s+ON\s+DELETE\s+(\w+))?/i // eslint-disable-line security/detect-unsafe-regex
    );
    if (fkMatch) {
      foreignKeys.push({
        column: fkMatch[1]!.toLowerCase(),
        refTable: fkMatch[2]!.toLowerCase(),
        refColumn: fkMatch[3]!.toLowerCase(),
        onDelete: fkMatch[4]?.toUpperCase(),
      });
      continue;
    }

    // Skip table-level PRIMARY KEY lines
    if (/^PRIMARY\s+KEY/i.test(line)) continue;

    // PostgreSQL: CONSTRAINT name UNIQUE (cols)
    // MySQL compat: UNIQUE KEY name (cols)
    const ukConstraint =
      line.match(/CONSTRAINT\s+(\w+)\s+UNIQUE\s*\(([^)]+)\)/i) ??
      line.match(/UNIQUE\s+KEY\s+(\w+)\s*\(([^)]+)\)/i);
    if (ukConstraint) {
      indexes.push({
        name: ukConstraint[1]!,
        columns: ukConstraint[2]!.split(",").map((c) => c.trim().toLowerCase()),
        unique: true,
      });
      continue;
    }

    // MySQL compat: inline INDEX name (cols) inside CREATE TABLE
    const idxMatch = line.match(/^INDEX\s+(\w+)\s*\(([^)]+)\)/i);
    if (idxMatch) {
      indexes.push({
        name: idxMatch[1]!,
        columns: idxMatch[2]!.split(",").map((c) => c.trim().toLowerCase()),
        unique: false,
      });
      continue;
    }

    // Column definition: name TYPE [NOT NULL] [DEFAULT x]
    const colMatch = line.match(/^(\w+)\s+([\w()]+(?:\(\d+\))?)/i); // eslint-disable-line security/detect-unsafe-regex
    if (!colMatch) continue;
    const colName = colMatch[1]!.toLowerCase();
    if (["primary", "unique", "index", "constraint", "key"].includes(colName))
      continue;

    let type: "text" | "integer";
    try {
      type = mapType(colMatch[2]!);
    } catch {
      continue;
    }

    const notNull = /NOT\s+NULL/i.test(line);
    // isPrimaryKey: inline declaration OR table-level PRIMARY KEY clause
    const isPrimaryKey = /PRIMARY\s+KEY/i.test(line) || pkColumns.has(colName);

    let defaultValue: string | number | null = null;
    const defMatch = line.match(/DEFAULT\s+(?:'([^']*)'|(\d+))/i);
    if (defMatch) {
      defaultValue =
        defMatch[1] !== undefined ? defMatch[1] : Number(defMatch[2]);
    }

    columns.push({ name: colName, type, notNull, defaultValue, isPrimaryKey });
  }

  return { columns, indexes, foreignKeys };
}

// --- Code generation --------------------------------------------------------

// Table → output file mapping
const TABLE_FILE: Record<string, string> = {
  subjects: "subject",
  subject_component_links: "subject",
  templates: "template",
  template_versions: "template",
  template_pillars: "template",
  template_questions: "template",
  reviews: "review",
  review_template_selections: "review",
  review_answer_state: "review",
  review_note_state: "review",
  review_attachments: "review",
  review_score_state: "review",
  review_participants: "review",
  events: "event",
  draft_answer_imports: "event",
  draft_answer_evidence: "event",
  field_versions: "field-version",
  field_version_events: "field-version",
};

// Cross-file table references (for .references() calls)
const CROSS_FILE_REFS: Record<string, Record<string, string>> = {
  subject: {},
  template: { subjects: "./subject" },
  review: { subjects: "./subject" },
  event: { reviews: "./review", draft_answer_imports: "./event" },
  "field-version": { events: "./event" },
};

function generateTableCode(table: TableDef, _fileKey: string): string {
  const lines: string[] = [];
  const varName = toCamel(table.name);

  const fkMap = new Map(table.foreignKeys.map((fk) => [fk.column, fk]));
  const _needsUniqueIndex = table.indexes.some((i) => i.unique);
  const _needsIndex = table.indexes.some((i) => !i.unique);

  lines.push(`export const ${varName} = sqliteTable(`);
  lines.push(`  "${table.name}",`);
  lines.push(`  {`);

  for (const col of table.columns) {
    const prop = toCamel(col.name);
    const fn =
      col.type === "text" ? `text("${col.name}")` : `integer("${col.name}")`;
    const parts: string[] = [fn];

    if (col.isPrimaryKey) parts.push("primaryKey()");
    if (col.notNull && !col.isPrimaryKey) parts.push("notNull()");

    if (col.defaultValue !== null) {
      const dv =
        typeof col.defaultValue === "string"
          ? `"${col.defaultValue}"`
          : String(col.defaultValue);
      parts.push(`default(${dv})`);
    }

    const fk = fkMap.get(col.name);
    if (fk) {
      const onDelete =
        fk.onDelete === "CASCADE" ? `, { onDelete: "cascade" }` : "";
      parts.push(
        `references(() => ${toCamel(fk.refTable)}.${toCamel(fk.refColumn)}${onDelete})`
      );
    }

    // Timestamp defaultFn convention
    if (col.name === "created_at" || col.name === "updated_at") {
      // Replace simple notNull+default with notNull+$defaultFn
      const idx = parts.indexOf("notNull()");
      const didx = parts.findIndex((p) => p.startsWith("default("));
      if (didx >= 0) parts.splice(didx, 1);
      const base = parts.slice(0, idx >= 0 ? idx + 1 : parts.length).join(".");
      lines.push(
        `    ${prop}: ${base}.$defaultFn(() => new Date().toISOString()),`
      );
      continue;
    }

    lines.push(`    ${prop}: ${parts.join(".")},`);
  }

  lines.push(`  },`);

  if (table.indexes.length > 0) {
    lines.push(`  (table) => ({`);
    for (const idx of table.indexes) {
      const cols = idx.columns.map((c) => `table.${toCamel(c)}`).join(", ");
      const fn = idx.unique ? "uniqueIndex" : "index";
      lines.push(`    ${toCamel(idx.name)}: ${fn}("${idx.name}").on(${cols}),`);
    }
    lines.push(`  })`);
  }

  lines.push(`);`);
  return lines.join("\n");
}

function generateFile(fileKey: string, tables: TableDef[]): string {
  const drizzleImports = new Set<string>(["sqliteTable"]);
  const crossImports: Record<string, Set<string>> = {};

  for (const table of tables) {
    for (const col of table.columns) {
      drizzleImports.add(col.type === "text" ? "text" : "integer");
    }
    const hasUnique = table.indexes.some((i) => i.unique);
    const hasIndex = table.indexes.some((i) => !i.unique);
    if (hasUnique) drizzleImports.add("uniqueIndex");
    if (hasIndex) drizzleImports.add("index");

    for (const fk of table.foreignKeys) {
      const refFile = CROSS_FILE_REFS[fileKey]?.[fk.refTable];
      if (refFile && refFile !== `./${fileKey}`) {
        crossImports[refFile] ??= new Set();
        crossImports[refFile]!.add(toCamel(fk.refTable));
      }
    }
  }

  const out: string[] = [
    "// GENERATED FILE — do not edit. Run `pnpm gen:schemas` to regenerate.",
    `// Source: services/schema.sql`,
    `import { ${[...drizzleImports].toSorted().join(", ")} } from "drizzle-orm/sqlite-core";`,
  ];

  for (const [importPath, names] of Object.entries(crossImports)) {
    out.push(
      `import { ${[...names].toSorted().join(", ")} } from "${importPath}";`
    );
  }

  out.push("");

  for (const table of tables) {
    out.push(generateTableCode(table, fileKey));
    out.push("");
  }

  return out.join("\n");
}

// --- Exports (for testing) --------------------------------------------------

export { parseTables, generateFile, mapType, toCamel, TABLE_FILE };
export type { TableDef, ColumnDef, IndexDef, ForeignKeyDef };

// --- Main -------------------------------------------------------------------

function main(): void {
  const sql = readFileSync(SCHEMA_SQL, "utf8");
  const tables = parseTables(sql);

  // Group by output file
  const byFile = new Map<string, TableDef[]>();
  for (const table of tables) {
    const file = TABLE_FILE[table.name];
    if (!file) {
      console.warn(
        `[codegen] No file mapping for table ${table.name} — skipping`
      );
      continue;
    }
    const arr = byFile.get(file) ?? [];
    arr.push(table);
    byFile.set(file, arr);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  for (const [fileKey, fileTables] of byFile) {
    const content = generateFile(fileKey, fileTables);
    const outPath = join(OUT_DIR, `${fileKey}.ts`);
    writeFileSync(outPath, content, "utf8");
    console.log(`[codegen] Wrote ${outPath} (${fileTables.length} tables)`);
  }

  console.log(`[codegen] Done. Generated ${byFile.size} files.`);
}

// Only run when invoked directly (not during test imports)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
