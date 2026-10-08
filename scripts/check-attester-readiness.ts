/**
 * `pnpm check-attester-readiness <payout-address> [--min-xlm 2] [--token C...] [--issuer G...]`
 *
 * Read-only checks from the attester checklist (`ATTESTER_CHECKLIST.md`, roadmap `M1-26`):
 * the payout account exists, holds enough native XLM for fees, and has an authorized USDC
 * trustline with room. Nothing is signed or sent. The checklist's "test receive and a test
 * release" step is deliberately NOT automated here: that's a real transaction through the
 * actual send/claim flow (`kinlock-app` or the SDK directly), not something a read-only script
 * should fake or skip past.
 *
 * Defaults `--token`/`--issuer` to the testnet USDC in `deployments/testnet-setup.md`
 * (kinlock-contracts). Override for a different network or token.
 */
import { readFileSync } from "node:fs";
import { Asset, Keypair, rpc, xdr } from "@stellar/stellar-sdk";

interface Network {
  network: string;
  network_passphrase: string;
  rpc_url: string;
}

const DEFAULT_USDC_TOKEN = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const DEFAULT_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_CODE = "USDC";
const AUTHORIZED_FLAG = 1;
const DEFAULT_MIN_XLM = 2;
const STROOPS_PER_XLM = 10_000_000n;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 || !process.argv[i + 1] ? fallback : (process.argv[i + 1] as string);
}

const payout = process.argv[2];
if (!payout || payout.startsWith("--")) {
  console.error(
    "usage: check-attester-readiness <payout-address> [--min-xlm N] [--token C...] [--issuer G...]",
  );
  process.exit(2);
}
const minXlm = Number(arg("min-xlm", String(DEFAULT_MIN_XLM)));
const token = arg("token", DEFAULT_USDC_TOKEN);
const issuer = arg("issuer", DEFAULT_USDC_ISSUER);

const network: Network = JSON.parse(readFileSync("fixtures/network.json", "utf8"));
const server = new rpc.Server(network.rpc_url);

let problems = 0;
const report = (ok: boolean, message: string) => {
  console.log(`${ok ? "✓" : "✗"} ${message}`);
  if (!ok) problems += 1;
};

async function checkAccount(): Promise<void> {
  const key = xdr.LedgerKey.account(
    new xdr.LedgerKeyAccount({ accountId: Keypair.fromPublicKey(payout as string).xdrAccountId() }),
  );
  const { entries } = await server.getLedgerEntries(key);
  const entry = entries[0];
  if (!entry) {
    report(false, `account ${payout} does not exist on ${network.network}`);
    return;
  }
  if (entry.val.type !== "account") {
    report(false, `unexpected ledger entry type ${entry.val.type} for ${payout}`);
    return;
  }
  const xlm = Number(entry.val.value.balance) / Number(STROOPS_PER_XLM);
  report(xlm >= minXlm, `native XLM float: ${xlm} (need >= ${minXlm})`);
}

async function checkTrustline(): Promise<void> {
  const key = xdr.LedgerKey.trustline(
    new xdr.LedgerKeyTrustLine({
      accountId: Keypair.fromPublicKey(payout as string).xdrAccountId(),
      asset: new Asset(USDC_CODE, issuer).toTrustLineXdrObject(),
    }),
  );
  const { entries } = await server.getLedgerEntries(key);
  const entry = entries[0];
  if (!entry) {
    report(false, `no USDC trustline (${USDC_CODE}:${issuer}) on ${payout}`);
    return;
  }
  if (entry.val.type !== "trustline") {
    report(false, `unexpected ledger entry type ${entry.val.type} for ${payout}`);
    return;
  }
  const line = entry.val.value;
  const authorized = (line.flags & AUTHORIZED_FLAG) !== 0;
  report(authorized, `USDC trustline authorized: ${authorized}`);
  report(
    line.limit > line.balance,
    `USDC trustline room: limit ${line.limit} > balance ${line.balance}`,
  );
}

console.log(`Checking ${payout} on ${network.network} (token ${token})`);
await checkAccount();
await checkTrustline();
console.log(
  problems === 0
    ? "Account and trustline checks pass. Next: complete a real test receive and test release through kinlock-app or the SDK, then check the remaining boxes in ATTESTER_CHECKLIST.md by hand."
    : `${problems} problem(s) found. Fix them before using this payout address.`,
);
process.exit(problems ? 1 : 0);
