/**
 * `pnpm hash <payee-file>`: prints the `payee_id` and `meta_hash` an attester passes to
 * `register_payee`. Never compute these by hand.
 *
 * Refuses a record that registry CI would reject. A `meta_hash` registered from such a record
 * stops matching every file in the repo the moment the record is fixed to pass CI, and the
 * mismatch is only discoverable later, on-chain.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { metaHash, payeeId, validateRegistry } from "./registry.js";

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(2);
}

/** The registry tree is the nearest ancestor holding `supported-countries.json`. */
function findTree(start: string): string | undefined {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "supported-countries.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const argument = process.argv[2];
if (!argument) fail("usage: pnpm hash <payee-file>");

const file = resolve(argument);
if (!existsSync(file)) fail(`${file}: no such file`);

const tree = findTree(dirname(file));
if (!tree) {
  fail(
    `${file}: no supported-countries.json in this file's directory or any parent, so it is not ` +
      "inside a registry tree. Put the record in the registry repo first; CI validates trees, not loose files.",
  );
}

const parts = relative(tree, file).split(sep);
const [first, country, name] = parts;
if (
  parts.length !== 3 ||
  first !== "payees" ||
  !/^[a-z]{2}$/.test(country ?? "") ||
  !name?.endsWith(".json")
) {
  fail(
    `${file}: CI only scans payees/<country>/<slug>.json, so it cannot check a file at this path. ` +
      "Move it under payees/<lowercase-country>/ and try again.",
  );
}

// Rebuilt the way validateRegistry builds it, so the prefixes of its errors match this file exactly.
const scanned = join(tree, "payees", country ?? "", name ?? "");
const own = validateRegistry([tree]).errors.filter((e) => e.startsWith(`${scanned}:`));
if (own.length) {
  for (const e of own) console.error(`✗ ${e}`);
  console.error("Fix the record and re-run this once `pnpm validate` is clean.");
  process.exit(1);
}

const payee = JSON.parse(readFileSync(file, "utf8"));
console.log(`payee_id  ${payeeId(payee.slug)}`);
console.log(`meta_hash ${metaHash(payee)}`);
