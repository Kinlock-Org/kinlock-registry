import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { canonicalize, metaHash, payeeId } from "../scripts/registry.js";

const schemaUrl = new URL("../schemas/payee.schema.json", import.meta.url);
const payeeSchema = JSON.parse(readFileSync(schemaUrl, "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
const validatePayee = ajv.compile(payeeSchema);

const DEFAULT_ADDR = "GCLMHF7LAR34TSELDNEREYPTNE4K7MMESPS62WXE7ZDLPWIJUF3MC5QM";

const basePayee = (over: Record<string, unknown> = {}) => ({
  slug: "fr-lycee-francais",
  display_name: "Lycée Français",
  category: "School",
  country: "FR",
  local_currency: "EUR",
  city: "Paris",
  payout_address: DEFAULT_ADDR,
  attester: "kinlock-attester",
  verified_at: "2026-11-02",
  ...over,
});

describe("schemas/payee.schema.json — Unicode and internationalization validation", () => {
  describe("Valid international Unicode names and accents in display_name and city", () => {
    it("accepts French names and cities with accents, cedillas, and ligatures", () => {
      const frenchCases = [
        {
          slug: "fr-lycee-francais-paris",
          display_name: "Lycée Français Victor Hugo",
          city: "Saint-Étienne",
        },
        {
          slug: "fr-ecole-superieure",
          display_name: "École Supérieure d'Électricité & Mécanique",
          city: "Châteauroux",
        },
        {
          slug: "fr-institution-notre-dame",
          display_name: "Institution Notre-Dame du Sacré-Cœur",
          city: "Aix-en-Provence",
        },
      ];

      for (const item of frenchCases) {
        const record = basePayee(item);
        const valid = validatePayee(record);
        expect(validatePayee.errors).toBeNull();
        expect(valid).toBe(true);
      }
    });

    it("accepts Spanish names and cities with accents, tildes, and diacritics", () => {
      const spanishCases = [
        {
          slug: "co-colegio-san-martin",
          display_name: "Colegio San Martín & Educación Técnica",
          country: "CO",
          local_currency: "COP",
          city: "Medellín",
        },
        {
          slug: "es-instituto-tecnologico",
          display_name: "Instituto Tecnológico Señor de Sipán",
          country: "ES",
          local_currency: "EUR",
          city: "Málaga",
        },
        {
          slug: "co-residencia-bogota",
          display_name: "Residencia Universitaria La Candelaria",
          country: "CO",
          local_currency: "COP",
          city: "Bogotá, D.C.",
        },
      ];

      for (const item of spanishCases) {
        const record = basePayee(item);
        const valid = validatePayee(record);
        expect(validatePayee.errors).toBeNull();
        expect(valid).toBe(true);
      }
    });

    it("accepts Portuguese names and cities with tildes, circumflexes, and accents", () => {
      const portugueseCases = [
        {
          slug: "br-sao-paulo-academy",
          display_name: "São Paulo Academy of Sciences",
          country: "BR",
          local_currency: "BRL",
          city: "São Paulo",
        },
        {
          slug: "br-colegio-santo-antonio",
          display_name: "Colégio Santo Antônio de Educação Básica",
          country: "BR",
          local_currency: "BRL",
          city: "Brasília",
        },
        {
          slug: "br-fundacao-joao-pinheiro",
          display_name: "Fundação João Pinheiro & Habitação",
          country: "BR",
          local_currency: "BRL",
          city: "Ribeirão Preto",
        },
      ];

      for (const item of portugueseCases) {
        const record = basePayee(item);
        const valid = validatePayee(record);
        expect(validatePayee.errors).toBeNull();
        expect(valid).toBe(true);
      }
    });

    it("accepts Vietnamese names and cities with stacked diacritics and horned vowels", () => {
      const vietnameseCases = [
        {
          slug: "vn-thpt-chu-van-an",
          display_name: "Trường THPT Chu Văn An",
          country: "VN",
          local_currency: "VND",
          city: "Hà Nội",
        },
        {
          slug: "vn-hoc-vien-bcvn",
          display_name: "Học viện Công nghệ Bưu chính Viễn thông",
          country: "VN",
          local_currency: "VND",
          city: "Thành phố Hồ Chí Minh",
        },
        {
          slug: "vn-co-so-giao-duc-do-phu",
          display_name: "Cơ sở Giáo dục Đỗ Phủ & Ký túc xá Sinh viên",
          country: "VN",
          local_currency: "VND",
          city: "Đà Nẵng",
        },
        {
          slug: "vn-can-tho-campus",
          display_name: "Trường Đại học Cần Thơ - Khoa Nông nghiệp",
          country: "VN",
          local_currency: "VND",
          city: "Cần Thơ",
        },
      ];

      for (const item of vietnameseCases) {
        const record = basePayee(item);
        const valid = validatePayee(record);
        expect(validatePayee.errors).toBeNull();
        expect(valid).toBe(true);
      }
    });

    it("accepts diverse international non-Latin scripts (Arabic, CJK, Cyrillic, Greek, Devanagari)", () => {
      const nonLatinCases = [
        {
          slug: "eg-madrasat-al-amal",
          display_name: "مدرسة الأمل للتعليم الأساسي",
          country: "EG",
          local_currency: "EGP",
          city: "القاهرة",
        },
        {
          slug: "jp-tokyo-kokusai",
          display_name: "東京国際アカデミー・日本語学校",
          country: "JP",
          local_currency: "JPY",
          city: "東京都新宿区",
        },
        {
          slug: "in-delhi-vidyapith",
          display_name: "दिल्ली विद्यापीठ एवं प्रौद्योगिकी संस्थान",
          country: "IN",
          local_currency: "INR",
          city: "नई दिल्ली",
        },
        {
          slug: "ua-kyiv-academy",
          display_name: "Київська Академія Мистецтв та Науки",
          country: "UA",
          local_currency: "UAH",
          city: "Київ",
        },
        {
          slug: "gr-athens-polytechnic",
          display_name: "Εθνικό Μετσόβιο Πολυτεχνείο",
          country: "GR",
          local_currency: "EUR",
          city: "Αθήνα",
        },
      ];

      for (const item of nonLatinCases) {
        const record = basePayee(item);
        const valid = validatePayee(record);
        expect(validatePayee.errors).toBeNull();
        expect(valid).toBe(true);
      }
    });

    it("accepts single character and boundary length Unicode strings", () => {
      // 1 char display_name and city (minLength: 1)
      const minimalRecord = basePayee({
        display_name: "學",
        city: "京",
      });
      expect(validatePayee(minimalRecord)).toBe(true);

      // 160-char Unicode display_name (maxLength: 160)
      const longName = "Trường Đại học Quốc tế ".repeat(7).slice(0, 160);
      expect(longName.length).toBe(160);
      const boundaryRecord = basePayee({
        display_name: longName,
        city: "Hà Nội".padEnd(120, "."),
      });
      expect(validatePayee(boundaryRecord)).toBe(true);
    });
  });

  describe("Rejection of invalid slug values (strictly lowercase ASCII alphanumeric with hyphens)", () => {
    it("refuses accented French characters in slug", () => {
      const record = basePayee({ slug: "lycée-francais" });
      const valid = validatePayee(record);
      expect(valid).toBe(false);
      expect(validatePayee.errors?.some((e) => e.instancePath === "/slug")).toBe(true);
    });

    it("refuses accented Portuguese characters in slug", () => {
      const record = basePayee({ slug: "são-paulo-school" });
      const valid = validatePayee(record);
      expect(valid).toBe(false);
      expect(validatePayee.errors?.some((e) => e.instancePath === "/slug")).toBe(true);
    });

    it("refuses Vietnamese diacritics in slug", () => {
      const record = basePayee({ slug: "trường-chu-văn-an" });
      const valid = validatePayee(record);
      expect(valid).toBe(false);
      expect(validatePayee.errors?.some((e) => e.instancePath === "/slug")).toBe(true);
    });

    it("refuses Spanish accented characters in slug", () => {
      const record = basePayee({ slug: "colegio-san-martín" });
      const valid = validatePayee(record);
      expect(valid).toBe(false);
      expect(validatePayee.errors?.some((e) => e.instancePath === "/slug")).toBe(true);
    });

    it("refuses non-Latin scripts in slug", () => {
      const nonLatinSlugs = ["東京-school", "مدرسة-hope", "киев-academy", "delhi-विद्यापीठ"];
      for (const slug of nonLatinSlugs) {
        const record = basePayee({ slug });
        const valid = validatePayee(record);
        expect(valid).toBe(false);
        expect(validatePayee.errors?.some((e) => e.instancePath === "/slug")).toBe(true);
      }
    });

    it("refuses uppercase letters, spaces, or improper hyphenation in slug", () => {
      const invalidSlugs = [
        "Lycee-Francais",
        "lycee francais",
        "lycee_francais",
        "-leading-hyphen",
        "trailing-hyphen-",
        "double--hyphen",
      ];
      for (const slug of invalidSlugs) {
        const record = basePayee({ slug });
        const valid = validatePayee(record);
        expect(valid).toBe(false);
        expect(validatePayee.errors?.some((e) => e.instancePath === "/slug")).toBe(true);
      }
    });
  });

  describe("Rejection of invalid display_name and city values", () => {
    it("refuses empty string for display_name (minLength: 1)", () => {
      const record = basePayee({ display_name: "" });
      const valid = validatePayee(record);
      expect(valid).toBe(false);
      expect(validatePayee.errors?.some((e) => e.instancePath === "/display_name")).toBe(true);
    });

    it("refuses empty string for city (minLength: 1)", () => {
      const record = basePayee({ city: "" });
      const valid = validatePayee(record);
      expect(valid).toBe(false);
      expect(validatePayee.errors?.some((e) => e.instancePath === "/city")).toBe(true);
    });

    it("refuses display_name exceeding 160 characters", () => {
      const overLongName = "École ".repeat(30); // 180 chars
      const record = basePayee({ display_name: overLongName });
      const valid = validatePayee(record);
      expect(valid).toBe(false);
      expect(validatePayee.errors?.some((e) => e.instancePath === "/display_name")).toBe(true);
    });

    it("refuses city exceeding 120 characters", () => {
      const overLongCity = "São Paulo ".repeat(15); // 150 chars
      const record = basePayee({ city: overLongCity });
      const valid = validatePayee(record);
      expect(valid).toBe(false);
      expect(validatePayee.errors?.some((e) => e.instancePath === "/city")).toBe(true);
    });
  });

  describe("Hash and ID stability with Unicode characters", () => {
    it("generates deterministic canonical JSON and meta_hash for records with Unicode", () => {
      const record = basePayee({
        slug: "vn-thpt-chu-van-an",
        display_name: "Trường THPT Chu Văn An",
        city: "Hà Nội",
      });

      const hash1 = metaHash(record);
      const hash2 = metaHash(record);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);

      // Verify canonicalize preserves Unicode without mangling UTF-8 sequences
      const canon = canonicalize(record);
      expect(canon).toContain("Trường THPT Chu Văn An");
      expect(canon).toContain("Hà Nội");

      // Verify payee_id from ASCII slug matches 64 hex chars
      const id = payeeId(record.slug);
      expect(id).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
