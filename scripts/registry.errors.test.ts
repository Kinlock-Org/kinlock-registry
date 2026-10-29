/**
 * Failure branches `registry.test.ts` never reaches: unreadable or schema-bad sibling files and an
 * attester whose handle does not match its filename. These are the paths that decide what CI says
 * when a tree is broken at the source rather than in one payee record.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prettyCanonical, validateRegistry } from "./registry.js";

const ADDR = "GCLMHF7LAR34TSELDNEREYPTNE4K7MMESPS62WXE7ZDLPWIJUF3MC5QM";
const payee = {
  attester: "att",
  category: "School",
  city: "Nairobi",
  country: "KE",
  display_name: "Test School",
  local_currency: "KES",
  payout_address: ADDR,
  slug: "ke-test-school",
  verified_at: "2026-10-06",
};
const attester = { address: ADDR, countries: ["KE"], display_name: "Att", handle: "att" };

let root: string;
const write = (path: string, text: string) => {
  const file = join(root, path);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, text);
};
const json = (path: string, value: unknown) => write(path, prettyCanonical(value as never));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kinlock-registry-errors-"));
  json("supported-countries.json", { countries: ["KE"] });
  json("attesters/att.json", attester);
  json("payees/ke/ke-test-school.json", payee);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const errors = () => validateRegistry([root]).errors.map((e) => e.replace(root, "<root>"));

describe("unreadable files", () => {
  it("reports a payee file that is not JSON instead of crashing the run", () => {
    write("payees/ke/ke-test-school.json", "{ slug: ");
    expect(errors().join("\n")).toMatch(/payees\/ke\/ke-test-school\.json: not valid JSON/);
  });

  it("reports an attester file that is not JSON", () => {
    write("attesters/att.json", "not json at all");
    expect(errors().join("\n")).toMatch(/attesters\/att\.json: not valid JSON/);
  });

  it("reports a country list that is not JSON", () => {
    write("supported-countries.json", "[");
    expect(errors().join("\n")).toMatch(/supported-countries\.json: not valid JSON/);
  });
});

describe("schema failures on the files a payee depends on", () => {
  it("names the missing property when the country list has no `countries`", () => {
    json("supported-countries.json", { country: ["KE"] });
    const report = errors().join("\n");
    expect(report).toMatch(/supported-countries\.json: .*required property 'countries'/);
  });

  it("stops before scanning payees when the country list is unusable", () => {
    json("supported-countries.json", { countries: "KE" });
    const report = errors().join("\n");
    expect(report).toMatch(/supported-countries\.json: /);
    expect(report).not.toMatch(/ke-test-school\.json/);
  });

  it("names the missing property when an attester file has no `countries`", () => {
    json("attesters/att.json", { address: ADDR, display_name: "Att", handle: "att" });
    expect(errors().join("\n")).toMatch(/attesters\/att\.json: .*required property 'countries'/);
  });

  it("reports an attester file whose handle does not match its filename", () => {
    json("attesters/att.json", { ...attester, handle: "someone-else" });
    expect(errors().join("\n")).toMatch(
      /attesters\/att\.json: handle "someone-else" must match the file name/,
    );
  });
});
