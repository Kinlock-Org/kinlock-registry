import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPayeeInteractive, parseArgs, slugify, validatePayeeRecord } from "./new-payee.js";
import { metaHash, payeeId } from "./registry.js";

const DEFAULT_ADDR = "GCLMHF7LAR34TSELDNEREYPTNE4K7MMESPS62WXE7ZDLPWIJUF3MC5QM";

describe("scripts/new-payee.ts", () => {
  describe("slugify()", () => {
    it("generates clean lowercase alphanumeric hyphenated slug with country prefix", () => {
      expect(slugify("KE", "Starlight Academy")).toBe("ke-starlight-academy");
    });

    it("normalizes and strips diacritics and accents (French, Portuguese, Spanish, Vietnamese)", () => {
      expect(slugify("FR", "Lycée Français Victor Hugo")).toBe("fr-lycee-francais-victor-hugo");
      expect(slugify("BR", "São Paulo Academy")).toBe("br-sao-paulo-academy");
      expect(slugify("ES", "Colegio San Martín")).toBe("es-colegio-san-martin");
      expect(slugify("VN", "Trường THPT Chu Văn An")).toBe("vn-truong-thpt-chu-van-an");
    });

    it("strips special symbols and collapses hyphens", () => {
      expect(slugify("NG", "Apex & Tech -- High-School!")).toBe("ng-apex-tech-high-school");
      expect(slugify("KE", "---Leading and Trailing---")).toBe("ke-leading-and-trailing");
    });

    it("falls back to <country>-payee when name contains only non-Latin characters", () => {
      expect(slugify("JP", "東京アカデミー")).toBe("jp-payee");
      expect(slugify("EG", "مدرسة الأمل")).toBe("eg-payee");
    });

    it("truncates at 80 characters without trailing hyphen", () => {
      const veryLong =
        "Very Long Institution Name That Will Exceed Maximum Allowable Characters For A Slug In Registry";
      const slug = slugify("KE", veryLong);
      expect(slug.length).toBeLessThanOrEqual(80);
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(slug.endsWith("-")).toBe(false);
    });
  });

  describe("validatePayeeRecord()", () => {
    it("returns empty array for schema-compliant record", () => {
      const record = {
        slug: "ke-starlight-academy",
        display_name: "Starlight Academy",
        category: "School",
        country: "KE",
        local_currency: "KES",
        city: "Nairobi",
        payout_address: DEFAULT_ADDR,
        attester: "kinlock-testnet-attester-1",
        verified_at: "2026-11-02",
      };
      expect(validatePayeeRecord(record)).toEqual([]);
    });

    it("returns errors when required fields are missing or invalid", () => {
      const invalid = {
        slug: "INVALID_SLUG",
        display_name: "",
        category: "Hospital", // invalid enum
        country: "KENYA", // not 2 chars
        local_currency: "KES",
        city: "Nairobi",
        payout_address: "invalid-address",
        attester: "att",
        verified_at: "not-a-date",
      };
      const errors = validatePayeeRecord(invalid);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("/display_name"))).toBe(true);
      expect(errors.some((e) => e.includes("/category"))).toBe(true);
      expect(errors.some((e) => e.includes("/payout_address"))).toBe(true);
    });
  });

  describe("parseArgs()", () => {
    it("correctly parses flags and boolean options", () => {
      const parsed = parseArgs([
        "--non-interactive",
        "--country",
        "KE",
        "--display-name",
        "Test School",
        "--dry-run",
        "--force",
      ]);
      expect(parsed.isNonInteractive).toBe(true);
      expect(parsed.dryRun).toBe(true);
      expect(parsed.force).toBe(true);
      expect(parsed.flags.country).toBe("KE");
      expect(parsed.flags["display-name"]).toBe("Test School");
    });
  });

  describe("createPayeeInteractive() file creation", () => {
    let tempRoot: string;

    beforeEach(() => {
      tempRoot = mkdtempSync(join(tmpdir(), "kinlock-new-payee-test-"));
    });

    afterEach(() => {
      rmSync(tempRoot, { recursive: true, force: true });
    });

    it("generates canonical JSON file in non-interactive mode", async () => {
      const argv = [
        "--non-interactive",
        "--display-name",
        "Sunrise School",
        "--category",
        "School",
        "--country",
        "KE",
        "--currency",
        "KES",
        "--city",
        "Mombasa",
        "--address",
        DEFAULT_ADDR,
        "--attester",
        "kinlock-testnet-attester-1",
        "--verified-at",
        "2026-11-02",
      ];

      const { record, targetPath } = await createPayeeInteractive({
        argv,
        baseDir: tempRoot,
      });

      expect(record.slug).toBe("ke-sunrise-school");
      expect(record.display_name).toBe("Sunrise School");
      expect(record.country).toBe("KE");
      expect(targetPath).toBe(join(tempRoot, "payees", "ke", "ke-sunrise-school.json"));
      expect(existsSync(targetPath)).toBe(true);

      const saved = JSON.parse(readFileSync(targetPath, "utf8"));
      expect(saved.slug).toBe("ke-sunrise-school");
      expect(saved.display_name).toBe("Sunrise School");
      expect(saved.payout_address).toBe(DEFAULT_ADDR);

      // Verify canonical hashing matches
      expect(metaHash(saved)).toBe(metaHash(record as never));
      expect(payeeId(saved.slug)).toBe(payeeId("ke-sunrise-school"));
    });

    it("supports dry-run mode without writing file to disk", async () => {
      const argv = [
        "--non-interactive",
        "--dry-run",
        "--display-name",
        "Dry Run School",
        "--country",
        "KE",
        "--currency",
        "KES",
        "--city",
        "Nairobi",
        "--address",
        DEFAULT_ADDR,
        "--attester",
        "kinlock-attester",
      ];

      const { targetPath } = await createPayeeInteractive({
        argv,
        baseDir: tempRoot,
      });

      expect(existsSync(targetPath)).toBe(false);
    });

    it("refuses to overwrite existing file in non-interactive mode without --force", async () => {
      const argv = [
        "--non-interactive",
        "--display-name",
        "Duplicate School",
        "--country",
        "KE",
        "--currency",
        "KES",
        "--city",
        "Nairobi",
        "--address",
        DEFAULT_ADDR,
        "--attester",
        "kinlock-attester",
      ];

      // First run creates file
      await createPayeeInteractive({ argv, baseDir: tempRoot });

      // Second run without --force throws
      await expect(createPayeeInteractive({ argv, baseDir: tempRoot })).rejects.toThrow(
        /already exists/,
      );

      // Third run with --force succeeds
      const result = await createPayeeInteractive({
        argv: [...argv, "--force"],
        baseDir: tempRoot,
      });
      expect(result.record.slug).toBe("ke-duplicate-school");
    });

    it("handles interactive answers via prompter", async () => {
      const answers: Record<string, string> = {
        "1. Payee display name": "Interactive High School",
        "2. Category (School or Rent)": "School",
        "3. Country (ISO 3166-1 alpha-2, e.g. KE)": "KE",
        "4. Local currency (ISO 4217, e.g. KES)": "KES",
        "5. City": "Nakuru",
        "6. Payout address (Stellar G... or C...)": DEFAULT_ADDR,
        "7. Attester handle (from attesters/<handle>.json)": "kinlock-testnet-attester-1",
        "8. Payee slug": "", // default
        "9. Verified date (YYYY-MM-DD)": "2026-11-02",
      };

      const promptFn = async (prompt: string, defaultValue?: string) => {
        return answers[prompt] ?? defaultValue ?? "";
      };

      const { record, targetPath } = await createPayeeInteractive({
        argv: [],
        baseDir: tempRoot,
        promptFn,
      });

      expect(record.slug).toBe("ke-interactive-high-school");
      expect(record.display_name).toBe("Interactive High School");
      expect(record.city).toBe("Nakuru");
      expect(existsSync(targetPath)).toBe(true);
    });
  });
});
