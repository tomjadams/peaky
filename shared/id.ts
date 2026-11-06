import { v7 as uuidv7 } from "uuid";

function requireCrypto(): Crypto {
  if (!globalThis.crypto) {
    throw new Error("Secure random generation is unavailable in this runtime");
  }

  return globalThis.crypto;
}

/**
 * Create a UUIDv7 string.
 *
 * UUIDv7 keeps the current timestamp in the leading bytes, which makes ids more
 * sortable than random UUIDv4 while still being globally unique enough for local-first
 * creation before remote sync exists.
 *
 * Example output:
 * - `0195b0c6-8af2-7f56-9d80-0d7d4f8d4f84`
 */
export function createUuidV7(): string {
  requireCrypto();
  return uuidv7();
}
