/** `pnpm validate`: checks the real registry and the testnet fixtures. Exit 1 on any problem. */
import { formatFinding, validateRegistry } from "./registry.js";

const { payees, findings } = validateRegistry([".", "fixtures"]);
for (const f of findings) console.error(formatFinding(f));
console.log(`${payees.length} payee file(s) checked, ${findings.length} problem(s)`);
process.exit(findings.length ? 1 : 0);
