import { withDatabase } from "./helpers";

interface TableWithName {
  _: {
    name: string;
  };
}

function getEntityType(table: TableWithName | string): string {
  return typeof table === "string" ? table : table._.name;
}

// Stub — reactive invalidation handlers will be wired in the service layer.
export function invalidateQueries(
  _entityType: string,
  _entityId?: string
): void {}

export async function insert<TValues>(
  table: TableWithName,
  values: TValues
): Promise<void> {
  await withDatabase(async (db) => {
    await db.insert(table as never).values(values as never);
  });

  invalidateQueries(getEntityType(table));
}

export async function update<TValues>(
  table: TableWithName,
  values: Partial<TValues>,
  whereClause: unknown
): Promise<void> {
  await withDatabase(async (db) => {
    await db
      .update(table as never)
      .set(values as never)
      .where(whereClause as never);
  });

  invalidateQueries(getEntityType(table));
}

export async function deleteRow(
  table: TableWithName,
  whereClause: unknown
): Promise<void> {
  await withDatabase(async (db) => {
    await db.delete(table as never).where(whereClause as never);
  });

  invalidateQueries(getEntityType(table));
}
