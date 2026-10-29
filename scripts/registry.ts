/**
 * Registry rules, in one place (AGENTS.md §8.4, roadmap M1-24, M1-29).
 *
 * A registry tree is a folder with `supported-countries.json`, `attesters/<handle>.json`, and
 * `payees/<country>/<slug>.json`. The repo root is the real registry; `fixtures/` holds fictional
 * test payees for testnet, checked by exactly the same rules against its own country list.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Sorted keys, no whitespace, UTF-8: the input to `meta_hash` (ARCHITECTURE.md §5.3). */
export function canonicalize(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalize(value[k] as Json)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const sha256Hex = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** SHA-256 of the canonical JSON: what attesters pass to `register_payee` as `meta_hash`. */
export const metaHash = (payee: Json): string => sha256Hex(canonicalize(payee));

/** The on-chain payee ID: SHA-256 of the slug. */
export const payeeId = (slug: string): string => sha256Hex(slug);

/** How every registry file must be formatted: sorted keys, 2-space indent, final newline. */
export function prettyCanonical(value: Json): string {
  const sortDeep = (v: Json): Json =>
    Array.isArray(v)
      ? v.map(sortDeep)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, sortDeep(v[k] as Json)]),
          )
        : v;
  return `${JSON.stringify(sortDeep(value), null, 2)}\n`;
}

const schemaDir = new URL("../schemas/", import.meta.url);
const loadSchema = (name: string) => JSON.parse(readFileSync(new URL(name, schemaDir), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
const validators = {
  payee: ajv.compile(loadSchema("payee.schema.json")),
  attester: ajv.compile(loadSchema("attester.schema.json")),
  countries: ajv.compile(loadSchema("supported-countries.schema.json")),
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
/** A real ISO 3166-1 alpha-2 region (Intl knows its name). */
const isCountry = (code: string) => /^[A-Z]{2}$/.test(code) && regionNames.of(code) !== code;
const currencies = new Set(Intl.supportedValuesOf("currency"));

export interface Payee {
  slug: string;
  display_name: string;
  category: "School" | "Rent";
  country: string;
  local_currency: string;
  city: string;
  payout_address: string;
  attester: string;
  verified_at: string;
}

export interface LoadedPayee {
  file: string;
  tree: string;
  payee: Payee;
}

const jsonFiles = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
    : [];

export interface Finding {
  file: string;
  ruleId: string;
  field?: string;
  message: string;
  fixHint: string;
}

export interface ValidationResult {
  payees: LoadedPayee[];
  errors: string[];
  findings: Finding[];
}

/** Validates every tree; returns the payees found, errors, and structured findings. */
export function validateRegistry(trees: string[]): ValidationResult {
  const findings: Finding[] = [];
  const payees: LoadedPayee[] = [];
  const slugs = new Map<string, string>();

  const readJson = (file: string): Json | undefined => {
    if (!existsSync(file)) {
      findings.push({
        file,
        ruleId: "FILE_MISSING",
        message: "missing",
        fixHint: "create the file at the required path",
      });
      return undefined;
    }
    const text = readFileSync(file, "utf8");
    let value: Json;
    try {
      value = JSON.parse(text);
    } catch {
      findings.push({
        file,
        ruleId: "INVALID_JSON",
        message: "not valid JSON",
        fixHint: "fix JSON syntax errors",
      });
      return undefined;
    }
    if (text !== prettyCanonical(value)) {
      findings.push({
        file,
        ruleId: "CANONICAL_FORMAT",
        message: "not canonically formatted (sorted keys, 2 spaces, final newline)",
        fixHint: "format with sorted keys, 2 spaces indentation, and trailing newline",
      });
    }
    return value;
  };

  for (const tree of trees) {
    const countriesFile = join(tree, "supported-countries.json");
    const countriesJson = readJson(countriesFile);
    let supported = new Set<string>();
    if (countriesJson !== undefined) {
      if (!validators.countries(countriesJson)) {
        findings.push({
          file: countriesFile,
          ruleId: "SCHEMA_VIOLATION",
          message: ajv.errorsText(validators.countries.errors),
          fixHint: "conform to schemas/supported-countries.schema.json",
        });
      } else {
        supported = new Set((countriesJson as { countries: string[] }).countries);
        for (const c of supported) {
          if (!isCountry(c)) {
            findings.push({
              file: countriesFile,
              ruleId: "INVALID_COUNTRY_CODE",
              field: "countries",
              message: `"${c}" is not an ISO 3166-1 country`,
              fixHint: "use a standard two-letter uppercase ISO 3166-1 alpha-2 country code",
            });
          }
        }
      }
    }

    const attesters = new Map<string, Set<string>>();
    for (const name of jsonFiles(join(tree, "attesters"))) {
      const file = join(tree, "attesters", name);
      const a = readJson(file);
      if (a === undefined) continue;
      if (!validators.attester(a)) {
        findings.push({
          file,
          ruleId: "SCHEMA_VIOLATION",
          message: ajv.errorsText(validators.attester.errors),
          fixHint: "conform to schemas/attester.schema.json",
        });
        continue;
      }
      const attester = a as { handle: string; countries: string[] };
      if (`${attester.handle}.json` !== name) {
        findings.push({
          file,
          ruleId: "HANDLE_FILENAME_MISMATCH",
          field: "handle",
          message: `handle "${attester.handle}" must match the file name`,
          fixHint: `rename file to ${attester.handle}.json or change handle property`,
        });
      }
      attesters.set(attester.handle, new Set(attester.countries));
    }

    const payeesDir = join(tree, "payees");
    const countryDirs = existsSync(payeesDir)
      ? readdirSync(payeesDir).filter((d) => statSync(join(payeesDir, d)).isDirectory())
      : [];
    for (const dir of countryDirs.sort()) {
      for (const name of jsonFiles(join(payeesDir, dir))) {
        const file = join(payeesDir, dir, name);
        const p = readJson(file);
        if (p === undefined) continue;

        const initialFindingCount = findings.length;

        if (!validators.payee(p)) {
          const ajvMsg = ajv.errorsText(validators.payee.errors);
          let fixHint = "ensure the record conforms to schemas/payee.schema.json";
          if (ajvMsg.includes("payout_address")) {
            fixHint = "payout_address must be a G- or C-address, 56 characters";
          } else if (ajvMsg.includes("additional properties")) {
            fixHint = "remove unlisted properties; registry entries only contain public metadata";
          }
          findings.push({
            file,
            ruleId: "SCHEMA_VIOLATION",
            field: validators.payee.errors?.[0]?.instancePath.replace(/^\//, "") || undefined,
            message: ajvMsg,
            fixHint,
          });
        }

        const payee = (p !== null && typeof p === "object" ? p : {}) as Record<string, unknown>;

        if (typeof payee.slug === "string") {
          if (`${payee.slug}.json` !== name) {
            findings.push({
              file,
              ruleId: "SLUG_FILENAME_MISMATCH",
              field: "slug",
              message: `slug "${payee.slug}" must match the file name`,
              fixHint: `rename file to ${payee.slug}.json or change slug to match filename`,
            });
          }
        }

        if (typeof payee.country === "string") {
          if (payee.country.toLowerCase() !== basename(dir)) {
            findings.push({
              file,
              ruleId: "COUNTRY_DIR_MISMATCH",
              field: "country",
              message: `country ${payee.country} must live in payees/${payee.country.toLowerCase()}/`,
              fixHint: `move file to payees/${payee.country.toLowerCase()}/`,
            });
          }
          if (!isCountry(payee.country)) {
            findings.push({
              file,
              ruleId: "INVALID_COUNTRY_CODE",
              field: "country",
              message: `"${payee.country}" is not an ISO 3166-1 country`,
              fixHint: "use a standard two-letter uppercase ISO 3166-1 alpha-2 country code",
            });
          }
          if (countriesJson !== undefined && !supported.has(payee.country)) {
            findings.push({
              file,
              ruleId: "UNSUPPORTED_COUNTRY",
              field: "country",
              message: `${payee.country} is not in ${countriesFile}`,
              fixHint: "request country addition to supported-countries.json with counsel sign-off",
            });
          }
        }

        if (typeof payee.local_currency === "string") {
          if (!currencies.has(payee.local_currency)) {
            findings.push({
              file,
              ruleId: "INVALID_CURRENCY_CODE",
              field: "local_currency",
              message: `"${payee.local_currency}" is not an ISO 4217 currency`,
              fixHint: "use a standard three-letter uppercase ISO 4217 currency code",
            });
          }
        }

        if (typeof payee.attester === "string") {
          const scope = attesters.get(payee.attester);
          if (!scope) {
            findings.push({
              file,
              ruleId: "UNKNOWN_ATTESTER",
              field: "attester",
              message: `attester "${payee.attester}" has no file in ${join(tree, "attesters")}`,
              fixHint: `add attester record to attesters/${payee.attester}.json or verify handle spelling`,
            });
          } else if (typeof payee.country === "string" && !scope.has(payee.country)) {
            findings.push({
              file,
              ruleId: "ATTESTER_UNAUTHORIZED",
              field: "attester",
              message: `attester "${payee.attester}" is not authorized for ${payee.country}`,
              fixHint: `add "${payee.country}" to authorized countries in attesters/${payee.attester}.json`,
            });
          }
        }

        if (typeof payee.slug === "string") {
          const seen = slugs.get(payee.slug);
          if (seen) {
            findings.push({
              file,
              ruleId: "DUPLICATE_SLUG",
              field: "slug",
              message: `slug "${payee.slug}" is already used by ${seen}`,
              fixHint: "choose a globally unique slug across all registry trees",
            });
          } else {
            slugs.set(payee.slug, file);
          }
        }

        if (findings.length === initialFindingCount) {
          payees.push({ file, tree, payee: payee as unknown as Payee });
        }
      }
    }
  }

  findings.sort((a, b) => {
    const fileCmp = a.file.localeCompare(b.file);
    if (fileCmp !== 0) return fileCmp;
    return a.ruleId.localeCompare(b.ruleId);
  });

  const errors = findings.map((f) => `${f.file}: ${f.message}`);
  return { payees, errors, findings };
}

/** Formats a finding into a single readable string with its rule ID and actionable fix hint. */
export function formatFinding(f: Finding): string {
  if (f.ruleId === "INVALID_JSON") {
    return `✗ [${f.ruleId}] ${f.file}: ${f.message} (stops per-file checks) — Fix: ${f.fixHint}`;
  }
  const field = f.field ? ` (${f.field})` : "";
  return `✗ [${f.ruleId}] ${f.file}${field}: ${f.message} — Fix: ${f.fixHint}`;
}
