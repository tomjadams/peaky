/**
 * AIMD (Additive Increase / Multiplicative Decrease) batch-size controller.
 *
 * Dynamically adjusts how many outbox items are pushed per sync cycle based
 * on server feedback:
 * - On full-batch success: increase batch size by 50% (additive increase),
 *   clamped to `max` (default 20).
 * - On any rejection or network error: halve the batch size (multiplicative
 *   decrease), clamped to `min` (default 1).
 *
 * Initial batch size is 5. Typical stable range is 5–15 under mixed load.
 *
 * Formal model: formal_verification/resilience/aimd_concurrency_controller.fizz.
 * The default config below is mirrored there as MIN_SIZE/MAX_SIZE and asserted
 * equal by tests/guards/spec-drift.test.ts; the model-based
 * test in formal_verification/mbt/ drives this class through the spec's own
 * state space. Kept dependency-free so that harness can import it directly.
 */
export class ConcurrencyController {
  private currentBatchSize: number;

  constructor(
    private config: { initial: number; max: number; min: number } = {
      initial: 5,
      max: 20,
      min: 1,
    }
  ) {
    this.currentBatchSize = config.initial;
  }

  get batchSize(): number {
    return this.currentBatchSize;
  }

  /**
   * On full batch success: increase by 50%, clamp to max.
   *
   * The `+ 1` floor matters at the bottom of the range: `Math.floor(1 * 1.5)`
   * is 1, so proportional growth alone leaves a controller that has collapsed
   * to `min: 1` stuck there forever, pushing one item per cycle for the rest of
   * the session. Growth must make progress whenever there is headroom.
   */
  onSuccess(): void {
    this.currentBatchSize = Math.min(
      this.config.max,
      Math.max(
        this.currentBatchSize + 1,
        Math.floor(this.currentBatchSize * 1.5)
      )
    );
  }

  /** On any failure: halve, clamp to min. */
  onFailure(): void {
    this.currentBatchSize = Math.max(
      this.config.min,
      Math.floor(this.currentBatchSize / 2)
    );
  }
}
