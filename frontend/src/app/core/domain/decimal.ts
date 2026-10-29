/**
 * Fixed-point decimal math for money and quantities.
 *
 * Values are stored as BigInt scaled by 10^6, so 0.1 + 0.2 is exactly 0.3
 * and costs like 0.032 baht/gram never drift. Convert back to number only
 * for display (toNumber) or when sending to the API.
 */
const SCALE = 6;
const FACTOR = 10n ** BigInt(SCALE);

export type Dec = bigint;

export const ZERO: Dec = 0n;

export function dec(value: number | string | null | undefined): Dec {
  if (value === null || value === undefined || value === '') return ZERO;
  const text = typeof value === 'number' ? value.toFixed(SCALE) : value.trim();
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match) throw new Error(`Invalid decimal: ${value}`);
  const [, sign, intPart, fracPart = ''] = match;
  const frac = (fracPart + '0'.repeat(SCALE)).slice(0, SCALE);
  const raw = BigInt(intPart || '0') * FACTOR + BigInt(frac || '0');
  return sign ? -raw : raw;
}

/** Integer division rounded half away from zero. */
function roundDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new RangeError('Division by zero');
  const negative = n < 0n !== d < 0n;
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  const q = (an * 2n + ad) / (ad * 2n);
  return negative ? -q : q;
}

export const add = (...values: Dec[]): Dec => values.reduce((a, b) => a + b, ZERO);
export const sub = (a: Dec, b: Dec): Dec => a - b;
export const mul = (a: Dec, b: Dec): Dec => roundDiv(a * b, FACTOR);
export const div = (a: Dec, b: Dec): Dec => roundDiv(a * FACTOR, b);

/** Round to `places` decimals (e.g. 2 for satang). */
export function round(value: Dec, places = 2): Dec {
  const step = 10n ** BigInt(SCALE - places);
  return roundDiv(value, step) * step;
}

export function toNumber(value: Dec): number {
  return Number(value) / Number(FACTOR);
}
