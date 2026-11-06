/**
 * Per-endpoint failure-aware backoff gate.
 *
 * Each server endpoint gets its own BackoffGate instance so that
 * independent failure domains don't interfere with each other.
 * SSE being down should not throttle push, and vice versa.
 *
 *   Why per-endpoint, not shared:
 *
 *     peaky-api (push/pull)  and  peaky-sse  are separate services.
 *     A shared gate conflates their health — if SSE fails 10 times,
 *     a shared counter would throttle push even though the API is up.
 *     That's the "shared circuit breaker" anti-pattern:
 *     https://brooker.co.za/blog/2022/02/16/circuit-breakers.html
 *
 *   The right model (per-endpoint backoff with jitter):
 *     https://brooker.co.za/blog/2022/02/28/retries.html
 *
 * How it works:
 *
 *   Each gate tracks its own consecutive failures and provides:
 *
 *     delay()      — backoff delay for the next scheduled attempt
 *     mayAttempt() — whether a triggered (user-initiated) attempt is allowed
 *
 *     failures = 0   →  delay = baseMs        mayAttempt = true
 *     failures > 0   →  delay = exponential   mayAttempt = cooldown elapsed
 *     success        →  failures = 0          resume normal
 *
 *   Timeline — SSE down, API healthy:
 *
 *     SSE gate:   FAIL → 30s → FAIL → 60s → FAIL → 120s  (backing off)
 *     Sync gate:  OK → 30s → OK → 30s → OK → 30s         (unaffected)
 *     User push:  immediate                                (sync gate healthy)
 *
 * Usage:
 *
 *   const gate = new BackoffGate({ baseMs: 1_000, capMs: 120_000 });
 *
 *   // After each attempt
 *   success ? gate.recordSuccess() : gate.recordFailure();
 *
 *   // Scheduled retry
 *   await sleep(gate.delay());
 *
 *   // Triggered attempt
 *   if (gate.mayAttempt()) await attempt();
 */

export class BackoffGate {
  private failures = 0;
  private lastAttemptAt = 0;
  private readonly baseMs: number;
  private readonly capMs: number;

  constructor(opts?: { baseMs?: number; capMs?: number }) {
    this.baseMs = opts?.baseMs ?? 30_000;
    this.capMs = opts?.capMs ?? 300_000;
  }

  recordSuccess(): void {
    this.failures = 0;
  }

  recordFailure(): void {
    this.failures++;
    this.lastAttemptAt = Date.now();
  }

  /** Backoff delay for the next scheduled attempt (ms). */
  delay(): number {
    if (this.failures === 0) return this.baseMs;
    const exponential = this.baseMs * Math.pow(2, this.failures);
    const capped = Math.min(exponential, this.capMs);
    return capped * (0.5 + Math.random() * 0.5); // jitter 50-100%
  }

  /**
   * Whether a triggered (user-initiated) attempt should proceed now.
   * Returns true when healthy (failures = 0) or enough time has
   * elapsed since the last failed attempt.
   */
  mayAttempt(): boolean {
    if (this.failures === 0) return true;
    return Date.now() - this.lastAttemptAt >= this.delay();
  }

  get consecutiveFailures(): number {
    return this.failures;
  }

  get isHealthy(): boolean {
    return this.failures === 0;
  }
}

/** Sync polling + user-triggered push (peaky-api). */
export const syncGate = new BackoffGate({ baseMs: 30_000, capMs: 300_000 });

/** SSE reconnect (peaky-sse). */
export const sseGate = new BackoffGate({ baseMs: 1_000, capMs: 120_000 });
