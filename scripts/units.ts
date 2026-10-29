/**
 * Exact base-unit math for 7-decimal assets (native XLM, and every SAC on the allowlist).
 *
 * Money never becomes a float here: `Number` loses precision above 2^53 stroops (~900 million
 * XLM), and `Number("abc")` is `NaN`, which compares false against everything — a healthy account
 * would be reported as underfunded with no clue why. Parse with `parseUnits`, compare the
 * bigints, and call `formatUnits` only to show a number to a human.
 */

export const UNITS_PER_WHOLE = 10_000_000n;

/** `"2"`, `"0.5"`, `"10000.0000001"` to base units. Anything else (empty, signed, 8 decimals, `abc`) returns undefined. */
export function parseUnits(text: string): bigint | undefined {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(text);
  if (!match) return undefined;
  const [, whole, fraction = ""] = match;
  return BigInt(whole ?? "0") * UNITS_PER_WHOLE + BigInt(fraction.padEnd(7, "0"));
}

/** Base units to a 7-decimal string, for display only — never feed this back into a comparison. */
export function formatUnits(units: bigint): string {
  return `${units / UNITS_PER_WHOLE}.${(units % UNITS_PER_WHOLE).toString().padStart(7, "0")}`;
}
