/**
 * `pnpm hash <payee-file>`: prints the `payee_id` and `meta_hash` an attester passes to
 * `register_payee`. Never compute these by hand.
 */
import { readFileSync } from "node:fs";
import { metaHash, payeeId } from "./registry.js";

const file = process.argv[2];
if (!file) {
  console.error("usage: pnpm hash <payee-file>");
  process.exit(2);
}
const payee = JSON.parse(readFileSync(file, "utf8"));
console.log(`payee_id  ${payeeId(payee.slug)}`);
console.log(`meta_hash ${metaHash(payee)}`);
