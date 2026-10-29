/**
 * `pnpm check-attester-readiness <payout-address> [--min-xlm N] [--token CODE] [--issuer G...]`
 *
 * Read-only checks from the attester checklist (`ATTESTER_CHECKLIST.md`, roadmap `M1-26`):
 * the payout account exists, holds enough native XLM for fees, and has an authorized trustline
 * with room. Nothing is signed or sent. The checklist's "test receive and a test release" step is
 * deliberately NOT automated here: that's a real transaction through the actual send/claim flow
 * (`kinlock-app` or the SDK directly), not something a read-only script should fake or skip past.
 *
 * An asset is named by its classic `code` + `issuer` pair, which is what a trustline ledger entry
 * is keyed on; the testnet USDC whose SAC is
 * `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` (`deployments/testnet-setup.md`,
 * kinlock-contracts) is the default. Both ledger keys below are built from a `G...` ed25519
 * account ID, so a muxed (`M...`) or contract (`C...`) payout address needs a different key
 * construction and is rejected with a message rather than a stack trace (roadmap `M1-61`).
 */
import { readFileSync } from "node:fs";
import { Asset, Keypair, rpc, StrKey, xdr } from "@stellar/stellar-sdk";
import { formatUnits, parseUnits } from "./units.js";

interface Network {
  network: string;
  network_passphrase: string;
  rpc_url: string;
}

const DEFAULT_TOKEN_CODE = "USDC";
const DEFAULT_TOKEN_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const DEFAULT_MIN_XLM = "2";
const AUTHORIZED_FLAG = 1;
/** Classic asset codes are 1-4 letters, or 5-12 letters and digits. */
const ASSET_CODE = /^[A-Z0-9]{1,12}$/;

/** An argument is wrong: say which, and stop before contacting the network. */
function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(2);
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 || !process.argv[i + 1] ? fallback : (process.argv[i + 1] as string);
}

const USAGE =
  "usage: check-attester-readiness <payout-address> [--min-xlm N] [--token CODE] [--issuer G...]";

const payout = process.argv[2];
if (!payout || payout.startsWith("--")) fail(USAGE);

// A `fail()` call narrows at this scope but not inside the check functions below, so every value
// they use is bound to a fully-typed const first.
const account = StrKey.isValidEd25519PublicKey(payout)
  ? payout
  : fail(
      `"${payout}" is not a classic account address (G...). Muxed (M...) and contract (C...) ` +
        `payout accounts are not supported by this check yet.`,
    );

const issuerText = arg("issuer", DEFAULT_TOKEN_ISSUER);
const issuer = StrKey.isValidEd25519PublicKey(issuerText)
  ? issuerText
  : fail(`--issuer "${issuerText}" is not a G-address`);

const code = arg("token", DEFAULT_TOKEN_CODE);
if (!ASSET_CODE.test(code)) {
  fail(
    `--token takes an asset code (1-12 of A-Z0-9), not a contract address; got "${code}". ` +
      `The issuer of that asset goes in --issuer.`,
  );
}

const minXlmText = arg("min-xlm", DEFAULT_MIN_XLM);
const minXlm =
  parseUnits(minXlmText) ??
  fail(`--min-xlm must be a XLM amount with at most 7 decimals, got "${minXlmText}"`);

const asset = `${code}:${issuer}`;

const network: Network = JSON.parse(readFileSync("fixtures/network.json", "utf8"));
const server = new rpc.Server(network.rpc_url);

let problems = 0;
const report = (ok: boolean, message: string) => {
  console.log(`${ok ? "✓" : "✗"} ${message}`);
  if (!ok) problems += 1;
};

async function checkAccount(): Promise<void> {
  const key = xdr.LedgerKey.account(
    new xdr.LedgerKeyAccount({ accountId: Keypair.fromPublicKey(account).xdrAccountId() }),
  );
  const { entries } = await server.getLedgerEntries(key);
  const entry = entries[0];
  if (!entry) {
    report(false, `account ${account} not found on ${network.network}`);
    return;
  }
  if (entry.val.type !== "account") {
    report(false, `unexpected ledger entry type ${entry.val.type} for ${account}`);
    return;
  }
  report(
    entry.val.value.balance >= minXlm,
    `native XLM float: ${formatUnits(entry.val.value.balance)} (need >= ${formatUnits(minXlm)})`,
  );
}

async function checkTrustline(): Promise<void> {
  const key = xdr.LedgerKey.trustline(
    new xdr.LedgerKeyTrustLine({
      accountId: Keypair.fromPublicKey(account).xdrAccountId(),
      asset: new Asset(code, issuer).toTrustLineXdrObject(),
    }),
  );
  const { entries } = await server.getLedgerEntries(key);
  const entry = entries[0];
  if (!entry) {
    report(false, `no ${asset} trustline on ${account}`);
    return;
  }
  if (entry.val.type !== "trustline") {
    report(false, `unexpected ledger entry type ${entry.val.type} for ${account}`);
    return;
  }
  const line = entry.val.value;
  const authorized = (line.flags & AUTHORIZED_FLAG) !== 0;
  report(authorized, `${asset} trustline authorized: ${authorized}`);
  report(
    line.limit > line.balance,
    `${asset} trustline room: limit ${formatUnits(line.limit)} > balance ${formatUnits(line.balance)}`,
  );
}

console.log(`Checking ${account} on ${network.network} (asset ${asset})`);
await checkAccount();
await checkTrustline();
console.log(
  problems === 0
    ? "Account and trustline checks pass. Next: complete a real test receive and test release through kinlock-app or the SDK, then check the remaining boxes in ATTESTER_CHECKLIST.md by hand."
    : `${problems} problem(s) found. Fix them before using this payout address.`,
);
process.exit(problems ? 1 : 0);
