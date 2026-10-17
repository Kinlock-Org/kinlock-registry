import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canonicalize, metaHash, payeeId, prettyCanonical, validateRegistry } from "./registry.js";

const ADDR = "GCLMHF7LAR34TSELDNEREYPTNE4K7MMESPS62WXE7ZDLPWIJUF3MC5QM";
const payee = (over: Record<string, unknown> = {}) => ({
  slug: "ke-test-school",
  display_name: "Test School",
  category: "School",
  country: "KE",
  local_currency: "KES",
  city: "Nairobi",
  payout_address: ADDR,
  attester: "att",
  verified_at: "2026-10-06",
  ...over,
});

let root: string;
const write = (path: string, value: unknown, raw?: string) => {
  const file = join(root, path);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, raw ?? prettyCanonical(value as never));
};
const tree = (name: string, countries = ["KE"], attesterCountries = ["KE"]) => {
  write(`${name}/supported-countries.json`, { countries });
  write(`${name}/attesters/att.json`, {
    handle: "att",
    display_name: "Attester",
    address: ADDR,
    countries: attesterCountries,
  });
};
const errorsFor = (...trees: string[]) =>
  validateRegistry(trees.map((t) => join(root, t))).errors.join("\n");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kinlock-registry-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("hashing", () => {
  it("canonicalizes with sorted keys and no whitespace", () => {
    expect(canonicalize({ b: 1, a: { d: [2, "x"], c: null } })).toBe(
      '{"a":{"c":null,"d":[2,"x"]},"b":1}',
    );
  });

  it("meta_hash and payee_id match an independent SHA-256", () => {
    const p = payee();
    const expected = createHash("sha256").update(canonicalize(p)).digest("hex");
    expect(metaHash(p)).toBe(expected);
    expect(payeeId("ke-test-school")).toBe(
      createHash("sha256").update("ke-test-school").digest("hex"),
    );
  });

  it("meta_hash doesn't depend on key order or formatting", () => {
    const p = payee();
    const reversed = Object.fromEntries(Object.entries(p).reverse());
    expect(metaHash(reversed)).toBe(metaHash(p));
  });
});

describe("validateRegistry", () => {
  it("accepts a valid tree", () => {
    tree("t");
    write("t/payees/ke/ke-test-school.json", payee());
    expect(errorsFor("t")).toBe("");
  });

  interface Case {
    name: string;
    payee: ReturnType<typeof payee> & Record<string, unknown>;
    dir: string;
    pattern: RegExp;
    countries: string[];
    attester: string[];
  }
  const cases: Case[] = [
    {
      name: "unsupported country",
      payee: payee({ country: "PH", local_currency: "PHP" }),
      dir: "ph",
      pattern: /PH is not in/,
      countries: ["KE"],
      attester: ["KE", "PH"],
    },
    {
      name: "attester not authorized for the country",
      payee: payee(),
      dir: "ke",
      pattern: /not authorized for KE/,
      countries: ["KE"],
      attester: ["PH"],
    },
    {
      name: "file in the wrong country folder",
      payee: payee(),
      dir: "ph",
      pattern: /must live in payees\/ke/,
      countries: ["KE"],
      attester: ["KE"],
    },
    {
      name: "fake currency",
      payee: payee({ local_currency: "ZZZ" }),
      dir: "ke",
      pattern: /not an ISO 4217 currency/,
      countries: ["KE"],
      attester: ["KE"],
    },
    {
      name: "unknown attester",
      payee: payee({ attester: "nobody" }),
      dir: "ke",
      pattern: /attester "nobody" has no file/,
      countries: ["KE"],
      attester: ["KE"],
    },
    {
      name: "personal data field",
      payee: payee({ phone: "+254700000000" }),
      dir: "ke",
      pattern: /must NOT have additional properties/,
      countries: ["KE"],
      attester: ["KE"],
    },
    {
      name: "bad payout address",
      payee: payee({ payout_address: "not-an-address" }),
      dir: "ke",
      pattern: /payout_address/,
      countries: ["KE"],
      attester: ["KE"],
    },
  ];
  it.each(cases)("rejects $name", (c) => {
    tree("t", c.countries, c.attester);
    write(`t/payees/${c.dir}/${c.payee.slug}.json`, c.payee);
    expect(errorsFor("t")).toMatch(c.pattern);
  });

  it("rejects a fake country code", () => {
    tree("t", ["QQ"], ["QQ"]);
    expect(errorsFor("t")).toMatch(/"QQ" is not an ISO 3166-1 country/);
  });

  it("rejects a slug that doesn't match the file name", () => {
    tree("t");
    write("t/payees/ke/other-name.json", payee());
    expect(errorsFor("t")).toMatch(/must match the file name/);
  });

  it("rejects a slug used twice, even across trees (one contract, one payee_id)", () => {
    tree("a");
    tree("b");
    write("a/payees/ke/ke-test-school.json", payee());
    write("b/payees/ke/ke-test-school.json", payee());
    expect(errorsFor("a", "b")).toMatch(/already used by/);
  });

  it("rejects files that aren't canonically formatted", () => {
    tree("t");
    write("t/payees/ke/ke-test-school.json", null, JSON.stringify(payee()));
    expect(errorsFor("t")).toMatch(/not canonically formatted/);
  });

  it("reports a missing country list instead of crashing", () => {
    expect(errorsFor("empty")).toMatch(/supported-countries.json: missing/);
  });

  it("aggregates multiple violations on a single record in one run", () => {
    tree("t");
    const multi = payee({
      payout_address: "not-an-address",
      local_currency: "ZZZ",
      attester: "nobody",
    });
    write("t/payees/ke/ke-test-school.json", multi);

    const res = validateRegistry([join(root, "t")]);
    expect(res.findings).toHaveLength(3);
    const ruleIds = res.findings.map((f) => f.ruleId);
    expect(ruleIds).toEqual(["INVALID_CURRENCY_CODE", "SCHEMA_VIOLATION", "UNKNOWN_ATTESTER"]);

    for (const f of res.findings) {
      expect(f.file).toContain("ke-test-school.json");
      expect(f.message.length).toBeGreaterThan(0);
      expect(f.fixHint.length).toBeGreaterThan(0);
    }

    const schemaFinding = res.findings.find((f) => f.ruleId === "SCHEMA_VIOLATION");
    expect(schemaFinding?.fixHint).toContain(
      "payout_address must be a G- or C-address, 56 characters",
    );
    const currencyFinding = res.findings.find((f) => f.ruleId === "INVALID_CURRENCY_CODE");
    expect(currencyFinding?.fixHint).toContain("ISO 4217");
    const attesterFinding = res.findings.find((f) => f.ruleId === "UNKNOWN_ATTESTER");
    expect(attesterFinding?.fixHint).toContain("attesters");

    expect(res.errors).toHaveLength(3);
    expect(res.errors[0]).toMatch(/not an ISO 4217 currency/);
    expect(res.errors[1]).toMatch(/payout_address/);
    expect(res.errors[2]).toMatch(/attester "nobody" has no file/);
  });

  it("reports unparseable JSON distinctly and stops per-file checks", () => {
    tree("t");
    write("t/payees/ke/ke-test-school.json", null, "{ not json }");
    const res = validateRegistry([join(root, "t")]);
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0]?.ruleId).toBe("INVALID_JSON");
    expect(res.findings[0]?.message).toBe("not valid JSON");
    expect(res.findings[0]?.fixHint).toContain("syntax");
  });

  it("sorts findings deterministically by file, then ruleId", () => {
    tree("t");
    write(
      "t/payees/ke/a-school.json",
      payee({ slug: "a-school", local_currency: "ZZZ", attester: "nobody" }),
    );
    write(
      "t/payees/ke/b-school.json",
      payee({ slug: "b-school", local_currency: "YYY", attester: "ghost" }),
    );

    const res = validateRegistry([join(root, "t")]);
    expect(res.findings).toHaveLength(4);
    expect(res.findings.map((f) => [f.file.split(/[\\/]/).pop(), f.ruleId])).toEqual([
      ["a-school.json", "INVALID_CURRENCY_CODE"],
      ["a-school.json", "UNKNOWN_ATTESTER"],
      ["b-school.json", "INVALID_CURRENCY_CODE"],
      ["b-school.json", "UNKNOWN_ATTESTER"],
    ]);
  });
});
