/**
 * Exact integer ratios for maturity arithmetic (maturity-score/REQ-011, AC-055).
 *
 * Every configured share and every result is an exact ratio of integers.
 * Threshold comparison happens by cross multiplication; nothing is scaled,
 * rounded, or converted to floating point before stage resolution. Rounding
 * to a whole percentage happens only at the display boundary.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */

export interface ExactRatio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

/** JSON-safe form stored on the serialized calculation trace. */
export interface SerializedRatio {
  readonly numerator: string;
  readonly denominator: string;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

/** Creates a reduced ratio with a positive denominator. */
export function exactRatio(
  numerator: number | bigint,
  denominator: number | bigint
): ExactRatio {
  let n = BigInt(numerator);
  let d = BigInt(denominator);
  if (d === 0n) {
    throw new Error("exactRatio: denominator must not be zero");
  }
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = gcd(n, d);
  if (divisor > 1n) {
    n /= divisor;
    d /= divisor;
  }
  return { numerator: n, denominator: d };
}

export const ZERO_RATIO: ExactRatio = Object.freeze({
  numerator: 0n,
  denominator: 1n,
});

export function addExact(a: ExactRatio, b: ExactRatio): ExactRatio {
  return exactRatio(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator
  );
}

export function subtractExact(a: ExactRatio, b: ExactRatio): ExactRatio {
  return exactRatio(
    a.numerator * b.denominator - b.numerator * a.denominator,
    a.denominator * b.denominator
  );
}

export function compareExact(a: ExactRatio, b: ExactRatio): -1 | 0 | 1 {
  const left = a.numerator * b.denominator;
  const right = b.numerator * a.denominator;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function multiplyExact(a: ExactRatio, b: ExactRatio): ExactRatio {
  return exactRatio(a.numerator * b.numerator, a.denominator * b.denominator);
}

export function divideExact(
  dividend: ExactRatio,
  divisor: ExactRatio
): ExactRatio {
  if (divisor.numerator === 0n) {
    throw new Error("divideExact: divisor must not be zero");
  }
  return exactRatio(
    dividend.numerator * divisor.denominator,
    dividend.denominator * divisor.numerator
  );
}

/**
 * Compares a ratio against a whole-percent threshold by cross multiplication.
 * Returns -1 when ratio < percent/100, 0 when equal, 1 when greater.
 */
export function compareToPercent(
  value: ExactRatio,
  percent: number
): -1 | 0 | 1 {
  const left = value.numerator * 100n;
  const right = BigInt(percent) * value.denominator;
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Rounds to a whole percentage, half up. Display boundary only — never use
 * the result for stage resolution (maturity-score/AC-024, AC-035).
 */
export function toWholePercent(value: ExactRatio): number {
  return Number(
    (200n * value.numerator + value.denominator) / (2n * value.denominator)
  );
}

export function toTenthsPercent(value: ExactRatio): number {
  const scaledTenths = value.numerator * 1000n;
  const roundedTenths =
    (2n * scaledTenths + value.denominator) / (2n * value.denominator);
  return Number(roundedTenths) / 10;
}

export function serializeRatio(value: ExactRatio): SerializedRatio {
  return {
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
  };
}

export function deserializeRatio(value: SerializedRatio): ExactRatio {
  return exactRatio(BigInt(value.numerator), BigInt(value.denominator));
}
