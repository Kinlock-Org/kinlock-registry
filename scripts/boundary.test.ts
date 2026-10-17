import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canonicalize, metaHash, prettyCanonical, validateRegistry } from "./registry.js";

const DEFAULT_ADDR = "GCLMHF7LAR34TSELDNEREYPTNE4K7MMESPS62WXE7ZDLPWIJUF3MC5QM";

let root: string;
const write = (path: string, value: unknown, raw?: string) => {
  const file = join(root, path);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, raw ?? prettyCanonical(value as never));
};

const setupTree = (
  treeName: string,
  countries: string[] = ["KE", "JP", "BH", "EG", "FR"],
  attesterCountries: string[] = ["KE", "JP", "BH", "EG", "FR"],
) => {
  write(`${treeName}/supported-countries.json`, { countries });
  write(`${treeName}/attesters/kinlock-testnet-attester-1.json`, {
    handle: "kinlock-testnet-attester-1",
    display_name: "Kinlock testnet attester",
    address: DEFAULT_ADDR,
    countries: attesterCountries,
  });
};

const errorsFor = (...trees: string[]) =>
  validateRegistry(trees.map((t) => join(root, t))).errors.join("\n");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kinlock-boundary-test-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("Boundary Fixture Corpus — Valid Cases", () => {
  it("validates 0-decimal currency (JPY) in Japan", () => {
    setupTree("tree");
    const content = JSON.parse(readFileSync("fixtures/boundary/valid/0-decimal-jpy.json", "utf8"));
    write(`tree/payees/jp/${content.slug}.json`, content);
    expect(errorsFor("tree")).toBe("");
  });

  it("validates 3-decimal currency (BHD) in Bahrain", () => {
    setupTree("tree");
    const content = JSON.parse(readFileSync("fixtures/boundary/valid/3-decimal-bhd.json", "utf8"));
    write(`tree/payees/bh/${content.slug}.json`, content);
    expect(errorsFor("tree")).toBe("");
  });

  it("validates non-Latin Unicode display_name (Japanese) and preserves hash integrity", () => {
    setupTree("tree");
    const content = JSON.parse(
      readFileSync("fixtures/boundary/valid/non-latin-japanese.json", "utf8"),
    );
    write(`tree/payees/jp/${content.slug}.json`, content);
    expect(errorsFor("tree")).toBe("");

    // Verify canonical hashing survives non-Latin UTF-8 without corruption
    const expectedHash = createHash("sha256").update(canonicalize(content), "utf8").digest("hex");
    expect(metaHash(content)).toBe(expectedHash);
  });

  it("validates RTL Arabic display_name and verifies canonical hash stability", () => {
    setupTree("tree");
    const content = JSON.parse(readFileSync("fixtures/boundary/valid/rtl-arabic.json", "utf8"));
    write(`tree/payees/eg/${content.slug}.json`, content);
    expect(errorsFor("tree")).toBe("");

    const expectedHash = createHash("sha256").update(canonicalize(content), "utf8").digest("hex");
    expect(metaHash(content)).toBe(expectedHash);
  });

  it("validates French multi-word name with diacritics", () => {
    setupTree("tree");
    const content = JSON.parse(
      readFileSync("fixtures/boundary/valid/diacritics-french.json", "utf8"),
    );
    write(`tree/payees/fr/${content.slug}.json`, content);
    expect(errorsFor("tree")).toBe("");
  });

  it("validates slug at exactly 80 characters (maximum allowed boundary)", () => {
    setupTree("tree");
    const content = JSON.parse(
      readFileSync("fixtures/boundary/valid/slug-exact-80-chars.json", "utf8"),
    );
    expect(content.slug.length).toBe(80);
    write(`tree/payees/ke/${content.slug}.json`, content);
    expect(errorsFor("tree")).toBe("");
  });
});

describe("Boundary Fixture Corpus — Rejection Cases", () => {
  it("rejects slug at 81 characters with maxLength violation message", () => {
    setupTree("tree");
    const content = JSON.parse(
      readFileSync("fixtures/boundary/invalid/slug-81-chars.json", "utf8"),
    );
    expect(content.slug.length).toBe(81);
    write(`tree/payees/ke/${content.slug}.json`, content);
    expect(errorsFor("tree")).toMatch(/data\/slug must NOT have more than 80 characters/);
  });

  it("rejects payout_address with length 55 with pattern violation", () => {
    setupTree("tree");
    const content = JSON.parse(
      readFileSync("fixtures/boundary/invalid/payout-address-short-55.json", "utf8"),
    );
    expect(content.payout_address.length).toBe(55);
    write(`tree/payees/ke/${content.slug}.json`, content);
    expect(errorsFor("tree")).toMatch(/data\/payout_address must match pattern/);
  });

  it("rejects payout_address containing lowercase letter", () => {
    setupTree("tree");
    const content = JSON.parse(
      readFileSync("fixtures/boundary/invalid/payout-address-lowercase.json", "utf8"),
    );
    expect(content.payout_address).toMatch(/[a-z]/);
    write(`tree/payees/ke/${content.slug}.json`, content);
    expect(errorsFor("tree")).toMatch(/data\/payout_address must match pattern/);
  });

  it("rejects payout_address with invalid prefix 'S'", () => {
    setupTree("tree");
    const content = JSON.parse(
      readFileSync("fixtures/boundary/invalid/payout-address-swapped-prefix.json", "utf8"),
    );
    expect(content.payout_address.startsWith("S")).toBe(true);
    write(`tree/payees/ke/${content.slug}.json`, content);
    expect(errorsFor("tree")).toMatch(/data\/payout_address must match pattern/);
  });

  it("rejects payee file placed in wrong country folder", () => {
    setupTree("tree");
    const content = JSON.parse(
      readFileSync("fixtures/boundary/invalid/directory-country-mismatch.json", "utf8"),
    );
    // Write country KE into payees/ph/
    write(`tree/payees/ph/${content.slug}.json`, content);
    expect(errorsFor("tree")).toMatch(/country KE must live in payees\/ke\//);
  });

  it("rejects payee whose attester is not authorized for that country", () => {
    // Only authorize for KE
    setupTree("tree", ["KE", "GH"], ["KE"]);
    const content = JSON.parse(
      readFileSync("fixtures/boundary/invalid/attester-unauthorized-country.json", "utf8"),
    );
    write(`tree/payees/gh/${content.slug}.json`, content);
    expect(errorsFor("tree")).toMatch(
      /attester "kinlock-testnet-attester-1" is not authorized for GH/,
    );
  });

  it("rejects duplicate slug in a different country (global uniqueness enforcement)", () => {
    setupTree("tree", ["KE", "PH"], ["KE", "PH"]);
    const keContent = {
      attester: "kinlock-testnet-attester-1",
      category: "School",
      city: "Nairobi",
      country: "KE",
      display_name: "Original KE School",
      local_currency: "KES",
      payout_address: DEFAULT_ADDR,
      slug: "ke-kinlock-test-school",
      verified_at: "2026-10-17",
    };
    write("tree/payees/ke/ke-kinlock-test-school.json", keContent);

    const dupContent = JSON.parse(
      readFileSync("fixtures/boundary/invalid/duplicate-slug-cross-country.json", "utf8"),
    );
    write("tree/payees/ph/ke-kinlock-test-school.json", dupContent);

    expect(errorsFor("tree")).toMatch(/slug "ke-kinlock-test-school" is already used by/);
  });
});
