import { describe, expect, it } from "vitest";
import { type Finding, formatFinding } from "./registry.js";

describe("formatFinding", () => {
  it("formats schema violation with actionable fix hint", () => {
    const finding: Finding = {
      file: "payees/ke/school.json",
      ruleId: "SCHEMA_VIOLATION",
      field: "payout_address",
      message: "must match pattern ^[GC][A-Z2-7]{55}$",
      fixHint: "payout_address must be a G- or C-address, 56 characters",
    };
    expect(formatFinding(finding)).toBe(
      "✗ [SCHEMA_VIOLATION] payees/ke/school.json (payout_address): must match pattern ^[GC][A-Z2-7]{55}$ — Fix: payout_address must be a G- or C-address, 56 characters",
    );
  });

  it("formats invalid JSON reporting distinctly as stopping per-file checks", () => {
    const finding: Finding = {
      file: "payees/ke/broken.json",
      ruleId: "INVALID_JSON",
      message: "not valid JSON",
      fixHint: "fix JSON syntax errors",
    };
    expect(formatFinding(finding)).toBe(
      "✗ [INVALID_JSON] payees/ke/broken.json: not valid JSON (stops per-file checks) — Fix: fix JSON syntax errors",
    );
  });

  it("formats file missing error", () => {
    const finding: Finding = {
      file: "supported-countries.json",
      ruleId: "FILE_MISSING",
      message: "missing",
      fixHint: "create the file at the required path",
    };
    expect(formatFinding(finding)).toBe(
      "✗ [FILE_MISSING] supported-countries.json: missing — Fix: create the file at the required path",
    );
  });

  it("formats unauthorized attester error", () => {
    const finding: Finding = {
      file: "payees/ke/rent.json",
      ruleId: "ATTESTER_UNAUTHORIZED",
      field: "attester",
      message: 'attester "att" is not authorized for KE',
      fixHint: 'add "KE" to authorized countries in attesters/att.json',
    };
    expect(formatFinding(finding)).toBe(
      '✗ [ATTESTER_UNAUTHORIZED] payees/ke/rent.json (attester): attester "att" is not authorized for KE — Fix: add "KE" to authorized countries in attesters/att.json',
    );
  });
});
