import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { metaHash, payeeId, prettyCanonical } from "./registry.js";

const TSX = join(process.cwd(), "node_modules", ".bin", "tsx");
const ADDR = "GCLMHF7LAR34TSELDNEREYPTNE4K7MMESPS62WXE7ZDLPWIJUF3MC5QM";

function runHash(file: string): { code: number; out: string } {
  try {
    const out = execFileSync(TSX, ["scripts/hash.ts", file], { encoding: "utf8", stdio: "pipe" });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

let root: string;
const payee = (over: Record<string, unknown> = {}) => ({
  slug: "ke-hash-test",
  display_name: "Hash Test School",
  category: "School",
  country: "KE",
  local_currency: "KES",
  city: "Nairobi",
  payout_address: ADDR,
  attester: "att",
  verified_at: "2026-10-06",
  ...over,
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kinlock-hash-"));
  mkdirSync(join(root, "payees/ke"), { recursive: true });
  mkdirSync(join(root, "attesters"), { recursive: true });
  writeFileSync(join(root, "supported-countries.json"), prettyCanonical({ countries: ["KE"] }));
  writeFileSync(
    join(root, "attesters/att.json"),
    prettyCanonical({ handle: "att", display_name: "Att", address: ADDR, countries: ["KE"] }),
  );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const writePayee = (name: string, value: unknown, raw?: string) => {
  const file = join(root, "payees/ke", name);
  writeFileSync(file, raw ?? prettyCanonical(value as never));
  return file;
};

describe("hash.ts", () => {
  it("hashes a record CI accepts, and matches the library", () => {
    const record = payee();
    const file = writePayee("ke-hash-test.json", record);
    const { code, out } = runHash(file);
    expect(code).toBe(0);
    expect(out).toContain(`payee_id  ${payeeId("ke-hash-test")}`);
    expect(out).toContain(`meta_hash ${metaHash(record)}`);
  });

  it("refuses a record carrying personal data", () => {
    const file = writePayee("ke-hash-test.json", payee({ phone: "+254700000000" }));
    const { code, out } = runHash(file);
    expect(code).toBe(1);
    expect(out).toMatch(/must NOT have additional properties/);
    expect(out).not.toContain("meta_hash");
  });

  it("refuses a record that is not canonically formatted", () => {
    const file = writePayee("ke-hash-test.json", null, JSON.stringify(payee()));
    const { code, out } = runHash(file);
    expect(code).toBe(1);
    expect(out).toMatch(/not canonically formatted/);
    expect(out).not.toContain("meta_hash");
  });

  it("refuses a record whose attester is not authorized for its country", () => {
    writeFileSync(
      join(root, "attesters/att.json"),
      prettyCanonical({ handle: "att", display_name: "Att", address: ADDR, countries: ["PH"] }),
    );
    const file = writePayee("ke-hash-test.json", payee());
    const { code, out } = runHash(file);
    expect(code).toBe(1);
    expect(out).toMatch(/not authorized for KE/);
    expect(out).not.toContain("meta_hash");
  });

  it("refuses a file CI never scans", () => {
    const file = join(root, "draft.json");
    writeFileSync(file, prettyCanonical(payee() as never));
    const { code, out } = runHash(file);
    expect(code).toBe(2);
    expect(out).toMatch(/CI only scans payees\/<country>\/<slug>\.json/);
  });

  it("refuses a file that is not inside a registry tree", () => {
    const loose = mkdtempSync(join(tmpdir(), "kinlock-loose-"));
    try {
      const file = join(loose, "ke-hash-test.json");
      writeFileSync(file, prettyCanonical(payee() as never));
      const { code, out } = runHash(file);
      expect(code).toBe(2);
      expect(out).toMatch(/not\s+inside a registry tree/);
    } finally {
      rmSync(loose, { recursive: true, force: true });
    }
  });

  it("refuses an empty argument instead of printing nothing", () => {
    const { code, out } = runHash("");
    expect(code).toBe(2);
    expect(out).toMatch(/usage: pnpm hash/);
  });
});
