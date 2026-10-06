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

/** Validates every tree; returns the payees found and a list of problems (empty = valid). */
export function validateRegistry(trees: string[]): { payees: LoadedPayee[]; errors: string[] } {
  const errors: string[] = [];
  const payees: LoadedPayee[] = [];
  const slugs = new Map<string, string>();

  const readJson = (file: string): Json | undefined => {
    if (!existsSync(file)) {
      errors.push(`${file}: missing`);
      return undefined;
    }
    const text = readFileSync(file, "utf8");
    let value: Json;
    try {
      value = JSON.parse(text);
    } catch {
      errors.push(`${file}: not valid JSON`);
      return undefined;
    }
    if (text !== prettyCanonical(value)) {
      errors.push(`${file}: not canonically formatted (sorted keys, 2 spaces, final newline)`);
    }
    return value;
  };

  for (const tree of trees) {
    const countriesFile = join(tree, "supported-countries.json");
    const countriesJson = readJson(countriesFile);
    if (countriesJson === undefined) continue;
    if (!validators.countries(countriesJson)) {
      errors.push(`${countriesFile}: ${ajv.errorsText(validators.countries.errors)}`);
      continue;
    }
    const supported = new Set((countriesJson as { countries: string[] }).countries);
    for (const c of supported) {
      if (!isCountry(c)) errors.push(`${countriesFile}: "${c}" is not an ISO 3166-1 country`);
    }

    const attesters = new Map<string, Set<string>>();
    for (const name of jsonFiles(join(tree, "attesters"))) {
      const file = join(tree, "attesters", name);
      const a = readJson(file);
      if (a === undefined) continue;
      if (!validators.attester(a)) {
        errors.push(`${file}: ${ajv.errorsText(validators.attester.errors)}`);
        continue;
      }
      const attester = a as { handle: string; countries: string[] };
      if (`${attester.handle}.json` !== name) {
        errors.push(`${file}: handle "${attester.handle}" must match the file name`);
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
        if (!validators.payee(p)) {
          errors.push(`${file}: ${ajv.errorsText(validators.payee.errors)}`);
          continue;
        }
        const payee = p as unknown as Payee;
        if (`${payee.slug}.json` !== name) {
          errors.push(`${file}: slug "${payee.slug}" must match the file name`);
        }
        if (payee.country.toLowerCase() !== basename(dir)) {
          errors.push(
            `${file}: country ${payee.country} must live in payees/${payee.country.toLowerCase()}/`,
          );
        }
        if (!isCountry(payee.country)) {
          errors.push(`${file}: "${payee.country}" is not an ISO 3166-1 country`);
        }
        if (!supported.has(payee.country)) {
          errors.push(`${file}: ${payee.country} is not in ${countriesFile}`);
        }
        if (!currencies.has(payee.local_currency)) {
          errors.push(`${file}: "${payee.local_currency}" is not an ISO 4217 currency`);
        }
        const scope = attesters.get(payee.attester);
        if (!scope) {
          errors.push(
            `${file}: attester "${payee.attester}" has no file in ${join(tree, "attesters")}`,
          );
        } else if (!scope.has(payee.country)) {
          errors.push(
            `${file}: attester "${payee.attester}" is not authorized for ${payee.country}`,
          );
        }
        const seen = slugs.get(payee.slug);
        if (seen) errors.push(`${file}: slug "${payee.slug}" is already used by ${seen}`);
        else slugs.set(payee.slug, file);
        payees.push({ file, tree, payee });
      }
    }
  }
  return { payees, errors };
}
