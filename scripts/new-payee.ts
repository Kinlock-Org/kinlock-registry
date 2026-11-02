/**
 * Interactive CLI helper to scaffold a new payee record (Issue #45, Roadmap M1-24).
 *
 * Prompts for payee metadata, validates against schemas/payee.schema.json,
 * and writes a canonical JSON file to payees/<country>/<slug>.json.
 *
 * Usage:
 *   pnpm tsx scripts/new-payee.ts
 *   pnpm new-payee
 *   pnpm tsx scripts/new-payee.ts --non-interactive --country KE --name "New Academy" ...
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { metaHash, payeeId, prettyCanonical } from "./registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const schemaPath = join(rootDir, "schemas", "payee.schema.json");
const payeeSchema = JSON.parse(readFileSync(schemaPath, "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
const validatePayee = ajv.compile(payeeSchema);

export interface PayeeRecord {
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

/**
 * Derives a valid payee slug from country code and display name.
 * Format: <country_lowercase>-<slugified-display-name>
 * Strict pattern: ^[a-z0-9]+(-[a-z0-9]+)*$, maxLength: 80
 */
export function slugify(country: string, displayName: string): string {
  const prefix = country.trim().toLowerCase();
  const normalized = displayName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens

  const baseSlug = normalized.length > 0 ? `${prefix}-${normalized}` : `${prefix}-payee`;
  return baseSlug.slice(0, 80).replace(/-+$/, "");
}

/**
 * Validates a payee record against schemas/payee.schema.json.
 * Returns array of formatted error messages (empty if valid).
 */
export function validatePayeeRecord(record: unknown): string[] {
  const valid = validatePayee(record);
  if (valid) return [];
  return (validatePayee.errors ?? []).map((err) => `${err.instancePath || "/"}: ${err.message}`);
}

/**
 * Parses CLI command line arguments.
 */
export function parseArgs(argv: string[]): {
  flags: Record<string, string>;
  isNonInteractive: boolean;
  dryRun: boolean;
  force: boolean;
} {
  const flags: Record<string, string> = {};
  let isNonInteractive = false;
  let dryRun = false;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg === "--non-interactive") {
      isNonInteractive = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--force") {
      force = true;
    } else if (arg.startsWith("--") && i + 1 < argv.length) {
      const key = arg.slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith("--")) {
        flags[key] = val;
        i++;
      }
    }
  }

  return { flags, isNonInteractive, dryRun, force };
}

/**
 * Interactively prompts user or resolves from flags.
 */
export async function createPayeeInteractive(options?: {
  argv?: string[];
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  baseDir?: string;
  promptFn?: (prompt: string, defaultValue?: string) => Promise<string>;
}): Promise<{ record: PayeeRecord; targetPath: string }> {
  const argv = options?.argv ?? process.argv.slice(2);
  const { flags, isNonInteractive, dryRun, force } = parseArgs(argv);
  const baseDir = options?.baseDir ?? rootDir;

  const rl = createInterface({
    input: options?.input ?? process.stdin,
    output: options?.output ?? process.stdout,
  });

  const ask = async (prompt: string, defaultValue?: string): Promise<string> => {
    if (isNonInteractive) return defaultValue ?? "";
    if (options?.promptFn) {
      const res = await options.promptFn(prompt, defaultValue);
      const trimmed = res.trim();
      return trimmed.length > 0 ? trimmed : (defaultValue ?? "");
    }
    const promptText = defaultValue ? `${prompt} [${defaultValue}]: ` : `${prompt}: `;
    const answer = await rl.question(promptText);
    const trimmed = answer.trim();
    return trimmed.length > 0 ? trimmed : (defaultValue ?? "");
  };

  try {
    if (!isNonInteractive) {
      rl.write("--- Kinlock Registry Payee Scaffolding Tool ---\n");
    }

    const displayName = flags["display-name"] || (await ask("1. Payee display name"));
    const categoryInput = flags.category || (await ask("2. Category (School or Rent)", "School"));
    const category = categoryInput === "Rent" ? "Rent" : "School";

    const country = (
      flags.country || (await ask("3. Country (ISO 3166-1 alpha-2, e.g. KE)"))
    ).toUpperCase();
    const currency = (
      flags.currency ||
      flags["local-currency"] ||
      (await ask("4. Local currency (ISO 4217, e.g. KES)"))
    ).toUpperCase();

    const city = flags.city || (await ask("5. City"));
    const payoutAddress =
      flags.address ||
      flags["payout-address"] ||
      (await ask("6. Payout address (Stellar G... or C...)"));

    const attester =
      flags.attester || (await ask("7. Attester handle (from attesters/<handle>.json)"));

    const defaultSlug = slugify(country, displayName);
    const slug = flags.slug || (await ask("8. Payee slug", defaultSlug));

    const today = new Date().toISOString().slice(0, 10);
    const verifiedAt = flags["verified-at"] || (await ask("9. Verified date (YYYY-MM-DD)", today));

    const record: PayeeRecord = {
      slug,
      display_name: displayName,
      category,
      country,
      local_currency: currency,
      city,
      payout_address: payoutAddress,
      attester,
      verified_at: verifiedAt,
    };

    // Validate schema
    const errors = validatePayeeRecord(record);
    if (errors.length > 0) {
      const errHeader = "Schema validation failed for generated payee record:\n";
      const errList = errors.map((e) => `  - ${e}`).join("\n");
      throw new Error(`${errHeader}${errList}`);
    }

    const targetDir = join(baseDir, "payees", country.toLowerCase());
    const targetPath = join(targetDir, `${slug}.json`);

    if (existsSync(targetPath) && !force) {
      if (isNonInteractive) {
        throw new Error(`File already exists at ${targetPath}. Use --force to overwrite.`);
      }
      const overwrite = await ask(`File already exists at ${targetPath}. Overwrite? (y/N)`, "N");
      if (overwrite.toLowerCase() !== "y") {
        throw new Error("Aborted by user; file already exists.");
      }
    }

    if (!dryRun) {
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(targetPath, prettyCanonical(record as never), "utf8");
    }

    const hash = metaHash(record as never);
    const id = payeeId(slug);

    if (!isNonInteractive) {
      rl.write(`\nSuccess! Payee record created at:\n  ${targetPath}\n\n`);
      rl.write(`Computed identifiers:\n`);
      rl.write(`  payee_id:  ${id}\n`);
      rl.write(`  meta_hash: ${hash}\n\n`);
      rl.write(`Next steps:\n`);
      rl.write(`  1. Run 'pnpm validate' to verify registry consistency.\n`);
      rl.write(`  2. Register on-chain using attester account with meta_hash.\n`);
    }

    return { record, targetPath };
  } finally {
    rl.close();
  }
}

// Direct execution entrypoint
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  createPayeeInteractive()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
