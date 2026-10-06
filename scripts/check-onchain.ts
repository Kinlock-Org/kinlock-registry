/**
 * `pnpm check-onchain`: confirms every fixture payee registered on testnet matches its registry
 * file (roadmap M1-25). For each payee it reads `get_payee` (read-only simulation, nothing is
 * sent) and checks meta_hash, payout, category, vouching attester, and Active status.
 * The real registry is checked the same way once it has a deployed network (mainnet, later).
 */
import { readFileSync } from "node:fs";
import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { metaHash, payeeId, validateRegistry } from "./registry.js";

interface Network {
  network: string;
  network_passphrase: string;
  rpc_url: string;
  contract_id: string;
}

const TREE = "fixtures";
const network: Network = JSON.parse(readFileSync(`${TREE}/network.json`, "utf8"));
const server = new rpc.Server(network.rpc_url);
const contract = new Contract(network.contract_id);
// Simulation needs a source account but never signs or sends; a throwaway key is enough.
const source = new Account(Keypair.random().publicKey(), "0");

async function getPayee(id: string): Promise<Record<string, unknown> | string> {
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: network.network_passphrase,
  })
    .addOperation(
      contract.call("get_payee", nativeToScVal(Buffer.from(id, "hex"), { type: "bytes" })),
    )
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    return /Error\(Contract, #11\)/.test(sim.error) ? "not registered on-chain" : sim.error;
  }
  if (!sim.result) return "no result from simulation";
  return scValToNative(sim.result.retval) as Record<string, unknown>;
}

const enumTag = (v: unknown) => (Array.isArray(v) ? String(v[0]) : String(v));

const { payees, errors: invalid } = validateRegistry([TREE]);
if (invalid.length) {
  for (const e of invalid) console.error(`✗ ${e}`);
  process.exit(1);
}
const attesterAddress = new Map(
  payees.map((p) => {
    const file = `${TREE}/attesters/${p.payee.attester}.json`;
    return [p.payee.attester, JSON.parse(readFileSync(file, "utf8")).address as string];
  }),
);

let problems = 0;
for (const { file, payee } of payees) {
  const onChain = await getPayee(payeeId(payee.slug));
  const issues: string[] = [];
  if (typeof onChain === "string") {
    issues.push(onChain);
  } else {
    const hash = Buffer.from(onChain.meta_hash as Uint8Array).toString("hex");
    if (hash !== metaHash(payee as never))
      issues.push(`meta_hash ${hash} != file ${metaHash(payee as never)}`);
    if (onChain.payout !== payee.payout_address) issues.push(`payout ${onChain.payout} != file`);
    if (enumTag(onChain.category) !== payee.category)
      issues.push(`category ${enumTag(onChain.category)} != file`);
    if (onChain.attester !== attesterAddress.get(payee.attester))
      issues.push("vouching attester differs");
    if (enumTag(onChain.status) !== "Active") issues.push(`status is ${enumTag(onChain.status)}`);
  }
  problems += issues.length;
  console.log(
    `${issues.length ? "✗" : "✓"} ${file}${issues.length ? `: ${issues.join("; ")}` : ""}`,
  );
}
console.log(`${payees.length} payee(s) checked on ${network.network}, ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
