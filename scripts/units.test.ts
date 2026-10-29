import { describe, expect, it } from "vitest";
import { formatUnits, parseUnits, UNITS_PER_WHOLE } from "./units.js";

describe("parseUnits", () => {
  it("parses whole and fractional amounts to exact base units", () => {
    expect(parseUnits("2")).toBe(2n * UNITS_PER_WHOLE);
    expect(parseUnits("0.0000001")).toBe(1n);
    expect(parseUnits("9999.9647224")).toBe(99_999_647_224n);
  });

  it("rejects anything that is not a plain 7-decimal amount", () => {
    for (const bad of [
      "",
      " ",
      "abc",
      "NaN",
      "-1",
      "+1",
      "1.12345678",
      "1e3",
      "2.",
      ".5",
      "1 000",
    ]) {
      expect(parseUnits(bad), `parseUnits(${JSON.stringify(bad)})`).toBeUndefined();
    }
  });

  it("stays exact where a float would collide two different balances", () => {
    // Number.MAX_SAFE_INTEGER is 9007199254775807, so past it two distinct stroop counts turn
    // into the same float — which is what `--min-xlm` was comparing against before.
    expect(Number(9007199254775808n)).toBe(Number(9007199254775809n));
    expect(parseUnits("900719925.4775808")).toBe(9007199254775808n);
    expect(parseUnits("900719925.4775809")).toBe(9007199254775809n);
  });
});

describe("formatUnits", () => {
  it("always shows all 7 places", () => {
    expect(formatUnits(0n)).toBe("0.0000000");
    expect(formatUnits(1n)).toBe("0.0000001");
    expect(formatUnits(99_999_647_224n)).toBe("9999.9647224");
    expect(formatUnits(9223372036854775807n)).toBe("922337203685.4775807");
  });

  it("round-trips an amount back to its 7-decimal form", () => {
    const pairs: [string, string][] = [
      ["2", "2.0000000"],
      ["0.5", "0.5000000"],
      ["0.0000001", "0.0000001"],
      ["9999.9647224", "9999.9647224"],
      ["922337203685.4775807", "922337203685.4775807"],
    ];
    for (const [text, shown] of pairs) {
      expect(formatUnits(parseUnits(text) as bigint), text).toBe(shown);
    }
  });
});
