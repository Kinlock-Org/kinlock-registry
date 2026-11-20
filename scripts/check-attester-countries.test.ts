import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkAttesterCountries } from "./check-attester-countries.js";

describe("checkAttesterCountries", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "check-attester-countries-test-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const writeJson = (relPath: string, data: unknown) => {
    const fullPath = join(root, relPath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  };

  it("passes on existing repo fixtures", () => {
    const res = checkAttesterCountries(["fixtures"]);
    expect(res.mismatches).toHaveLength(0);
    expect(res.payeesChecked).toBeGreaterThan(0);
  });

  it("passes when payee attester is authorized for the country", () => {
    writeJson("attesters/legal-kenya.json", {
      handle: "legal-kenya",
      countries: ["KE", "UG"],
    });
    writeJson("payees/ke/nairobi-academy.json", {
      slug: "nairobi-academy",
      country: "KE",
      attester: "legal-kenya",
    });

    const res = checkAttesterCountries([root]);
    expect(res.mismatches).toHaveLength(0);
    expect(res.payeesChecked).toBe(1);
  });

  it("detects when attester is not authorized for payee country", () => {
    writeJson("attesters/nigeria-only.json", {
      handle: "nigeria-only",
      countries: ["NG"],
    });
    writeJson("payees/ke/nairobi-academy.json", {
      slug: "nairobi-academy",
      country: "KE",
      attester: "nigeria-only",
    });

    const res = checkAttesterCountries([root]);
    expect(res.payeesChecked).toBe(1);
    expect(res.mismatches).toHaveLength(1);
    const m = res.mismatches[0];
    expect(m).toBeDefined();
    if (m) {
      expect(m.reason).toBe("unauthorized");
      expect(m.attesterHandle).toBe("nigeria-only");
      expect(m.country).toBe("KE");
      expect(m.error).toContain("is not authorized for country KE");
      expect(m.error).toContain("authorized: [NG]");
    }
  });

  it("detects when payee references a missing attester", () => {
    writeJson("payees/ng/lagos-school.json", {
      slug: "lagos-school",
      country: "NG",
      attester: "ghost-attester",
    });

    const res = checkAttesterCountries([root]);
    expect(res.payeesChecked).toBe(1);
    expect(res.mismatches).toHaveLength(1);
    const m = res.mismatches[0];
    expect(m).toBeDefined();
    if (m) {
      expect(m.reason).toBe("missing_attester");
      expect(m.attesterHandle).toBe("ghost-attester");
      expect(m.error).toContain("has no record");
    }
  });

  it("handles missing trees or directories gracefully without crashing", () => {
    const res = checkAttesterCountries([join(root, "non-existent-subpath")]);
    expect(res.payeesChecked).toBe(0);
    expect(res.mismatches).toHaveLength(0);
  });
});
