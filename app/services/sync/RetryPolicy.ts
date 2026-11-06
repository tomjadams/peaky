/**
 * Retry policy for sync outbox push.
 *
 * Provides exponential backoff with decorrelated jitter.
 * Classifies errors as retryable or terminal.
 *
 * Formal model: formal_verification/sync/outbox_item_lifecycle.fizz — maxAttempts
 * is MAX_RETRIES there, asserted equal by
 * tests/guards/spec-drift.test.ts.
 */

interface RetryPolicy {
  getDelay(attempt: number, context?: RetryContext): number;
  isRetryable(error: unknown): boolean;
  readonly maxAttempts: number;
}

export interface RetryContext {
  lastStatusCode?: number;
  lastError?: string;
  entityType?: string;
  /** If set, overrides calculated backoff (e.g. from Retry-After header) */
  retryAfterMs?: number;
}

/** Errors classified as terminal — never retry.
 *
 * These reasons are returned by the Go sync server in the push response
 * `rejected[].reason` field. A terminal rejection marks the outbox entry
 * as `failed` immediately (no exponential backoff, no retry attempts).
 *
 * - access_revoked:        Actor lost canEdit entitlement for the entity.
 * - invalid_entity_type:   Entity type is not in the server whitelist (e.g.
 *                          `review_progress` which is intentionally local-only).
 * - validation_error:      Malformed push payload (reserved, not yet sent).
 * - forbidden:             Authorization denied (reserved for Phase 4 Cedar).
 * - hlc_conflict:          All fields in the event lost HLC comparison —
 *                          another actor's newer timestamp won. Retrying the
 *                          same stale HLC will always be rejected.
 * - partial_hlc_conflict:  Some fields accepted, some lost HLC comparison.
 *                          The accepted fields are already stored; retrying
 *                          the rejected fields with the same HLC is futile.
 */
const NON_RETRYABLE_REASONS = new Set([
  "access_revoked",
  "invalid_entity_type",
  "validation_error",
  "forbidden",
  "hlc_conflict",
  "partial_hlc_conflict",
]);

export class AdaptiveRetryPolicy implements RetryPolicy {
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  readonly maxAttempts: number;

  constructor(options?: {
    baseDelayMs?: number;
    maxDelayMs?: number;
    maxAttempts?: number;
  }) {
    this.baseDelayMs = options?.baseDelayMs ?? 1000;
    this.maxDelayMs = options?.maxDelayMs ?? 60_000;
    this.maxAttempts = options?.maxAttempts ?? 5;
  }

  /**
   * Return delay in ms before the next attempt.
   *
   * Uses decorrelated jitter: `Math.random() * Math.min(cap, base * 2^attempt)`
   * so successive retries spread out without strict doubling.
   *
   * If the context carries a `retryAfterMs` (from a 429 Retry-After header),
   * that value is used directly instead of calculated backoff.
   */
  getDelay(attempt: number, context?: RetryContext): number {
    if (context?.retryAfterMs != null && context.retryAfterMs > 0) {
      return Math.min(context.retryAfterMs, this.maxDelayMs);
    }

    const cap = this.maxDelayMs;
    const base = this.baseDelayMs;
    const exponential = base * Math.pow(2, attempt);
    const window = Math.min(cap, exponential);
    return Math.random() * window;
  }

  /**
   * Classify an error as retryable.
   *
   * Retryable: network errors, HTTP 5xx, HTTP 429.
   * Not retryable: HTTP 4xx (except 429), access_revoked, validation errors.
   */
  isRetryable(error: unknown): boolean {
    // String-based error reasons (rejection reason from server)
    if (typeof error === "string") {
      return !NON_RETRYABLE_REASONS.has(error);
    }

    if (error instanceof Error) {
      // Check for embedded status code in the error message
      const statusMatch = error.message.match(/\b(\d{3})\b/);
      if (statusMatch) {
        const code = Number.parseInt(statusMatch[1]!, 10);
        return isRetryableStatusCode(code);
      }

      // Network / connection errors — always retry
      if (isNetworkError(error)) return true;

      // Check error reason embedded in message
      for (const reason of NON_RETRYABLE_REASONS) {
        if (error.message.includes(reason)) return false;
      }

      return true;
    }

    // Objects that carry a statusCode (H3/fetch errors)
    if (error !== null && typeof error === "object") {
      const obj = error as Record<string, unknown>;
      const code = obj["statusCode"] ?? obj["status"];
      if (typeof code === "number") {
        return isRetryableStatusCode(code);
      }

      const reason = obj["reason"];
      if (typeof reason === "string") {
        return !NON_RETRYABLE_REASONS.has(reason);
      }
    }

    // Unknown error shape — treat as retryable (fail open for network issues)
    return true;
  }
}

function isRetryableStatusCode(code: number): boolean {
  if (code === 429) return true;
  if (code >= 500) return true;
  // 4xx (except 429) are client errors — not retryable
  if (code >= 400 && code < 500) return false;
  return true;
}

function isNetworkError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("socket") ||
    error.name === "TypeError" // fetch failures in browsers
  );
}

export const defaultRetryPolicy = new AdaptiveRetryPolicy();
