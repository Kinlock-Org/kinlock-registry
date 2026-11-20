/**
 * `pnpm check-attester-countries [trees...]`
 *
 * Automated verification of attester country permissions (AGENTS.md §8.4, roadmap M1-29).
 * Ensures no payee file references an attester who is not authorized for that country.
 *
 * Each attester has an authorized country roster in `attesters/<handle>.json`.
 * A payee in `payees/<country>/<slug>.json` must be vouched for by an attester
 * whose file explicitly includes `<COUNTRY>` in uppercase ISO 3166-1 alpha-2 format.
 *
 * Exit code 0 if all payees are valid. Exit code 1 if any mismatches or missing attesters are found.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface AttesterCountryMismatch {
  file: string;
  payeeSlug: string;
  country: string;
  attesterHandle: string;
  authorizedCountries: string[];
  reason: "unauthorized" | "missing_attester";
  error: string;
}

export interface CheckAttesterCountriesResult {
  payeesChecked: number;
  mismatches: AttesterCountryMismatch[];
}

const jsonFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
    : [];

/**
 * Checks attester country permissions across the specified registry trees.
 * Defaults to repo root and fixtures directory.
 */
export function checkAttesterCountries(
  trees: string[] = [".", "fixtures"],
): CheckAttesterCountriesResult {
  const mismatches: AttesterCountryMismatch[] = [];
  let payeesChecked = 0;

  for (const tree of trees) {
    if (!existsSync(tree)) continue;

    // 1. Build attester handle -> Set<countryCode> map
    const attestersDir = join(tree, "attesters");
    const attesters = new Map<string, Set<string>>();

    for (const name of jsonFiles(attestersDir)) {
      const file = join(attestersDir, name);
      try {
        const text = readFileSync(file, "utf8");
        const a = JSON.parse(text) as { handle?: string; countries?: string[] };
        const handle = a.handle ?? name.replace(/\.json$/, "");
        const countries = new Set(
          Array.isArray(a.countries) ? a.countries.map((c) => String(c).toUpperCase()) : [],
        );
        attesters.set(handle, countries);
      } catch {
        // Handled by standard schema validation in pnpm validate
      }
    }

    // 2. Scan payees/<country>/<slug>.json
    const payeesDir = join(tree, "payees");
    if (!existsSync(payeesDir)) continue;

    const countryDirs = readdirSync(payeesDir).filter((d) => {
      try {
        return statSync(join(payeesDir, d)).isDirectory();
      } catch {
        return false;
      }
    });

    for (const countryDir of countryDirs.sort()) {
      const countryPath = join(payeesDir, countryDir);
      for (const name of jsonFiles(countryPath)) {
        const file = join(countryPath, name);
        try {
          const text = readFileSync(file, "utf8");
          const payee = JSON.parse(text) as {
            slug?: string;
            country?: string;
            attester?: string;
          };

          payeesChecked++;

          const slug = payee.slug ?? name.replace(/\.json$/, "");
          const country = (payee.country ?? countryDir).toUpperCase();
          const attesterHandle = payee.attester ?? "";

          if (!attesterHandle) {
            mismatches.push({
              file,
              payeeSlug: slug,
              country,
              attesterHandle: "(none)",
              authorizedCountries: [],
              reason: "missing_attester",
              error: `${file}: payee specifies no attester`,
            });
            continue;
          }

          const authorized = attesters.get(attesterHandle);
          if (!authorized) {
            mismatches.push({
              file,
              payeeSlug: slug,
              country,
              attesterHandle,
              authorizedCountries: [],
              reason: "missing_attester",
              error: `${file}: attester "${attesterHandle}" has no record in ${attestersDir}`,
            });
          } else if (!authorized.has(country)) {
            const list = Array.from(authorized).sort().join(", ");
            mismatches.push({
              file,
              payeeSlug: slug,
              country,
              attesterHandle,
              authorizedCountries: Array.from(authorized).sort(),
              reason: "unauthorized",
              error: `${file}: attester "${attesterHandle}" is not authorized for country ${country} (authorized: [${list}])`,
            });
          }
        } catch {
          // Handled by standard schema validation in pnpm validate
        }
      }
    }
  }

  return { payeesChecked, mismatches };
}

// CLI entry point when run directly via tsx
const isDirectRun =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url).replace(/\\/g, "/") ===
    (process.argv[1] ?? "").replace(/\\/g, "/");

if (isDirectRun) {
  const args = process.argv.slice(2);
  const targetTrees = args.length > 0 ? args : [".", "fixtures"];

  const { payeesChecked, mismatches } = checkAttesterCountries(targetTrees);

  for (const m of mismatches) {
    console.error(`✗ ${m.error}`);
  }

  console.log(
    `${payeesChecked} payee file(s) checked for attester country permissions, ${mismatches.length} problem(s)`,
  );

  process.exit(mismatches.length ? 1 : 0);
}
