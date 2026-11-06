import { ensureLocalDatabaseReady } from "./bootstrap";

export async function waitForLocalDbReady(_maxAttempts = 40): Promise<void> {
  if (!import.meta.client) {
    return;
  }

  try {
    await ensureLocalDatabaseReady();
  } catch (error) {
    console.error("[local-db] Failed to initialize database:", error);
  }
}
