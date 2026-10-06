/** `pnpm validate`: checks the real registry and the testnet fixtures. Exit 1 on any problem. */
import { validateRegistry } from "./registry.js";

const { payees, errors } = validateRegistry([".", "fixtures"]);
for (const e of errors) console.error(`✗ ${e}`);
console.log(`${payees.length} payee file(s) checked, ${errors.length} problem(s)`);
process.exit(errors.length ? 1 : 0);
