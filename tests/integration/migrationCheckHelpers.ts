import { expect } from "vitest";
import type BetterSqlite3 from "better-sqlite3";

/**
 * Shared enum-CHECK guard (AGENTS.md SQLite enum-migration rule): reads the
 * applied DDL from sqlite_master and asserts every exported Drizzle enum
 * value is present in the table's CHECK constraint. Used by
 * migrations.test.ts for every enum-constrained table.
 */
export function assertEnumChecks(
  sqlite: BetterSqlite3.Database,
  contracts: ReadonlyArray<{
    readonly table: string;
    readonly field: string;
    readonly values: readonly string[];
  }>
): void {
  for (const contract of contracts) {
    const row = sqlite
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?"
      )
      .get(contract.table) as { sql: string };
    for (const value of contract.values) {
      expect(
        row.sql,
        `${contract.table}.${contract.field} CHECK must include '${value}'`
      ).toContain(`'${value}'`);
    }
  }
}
