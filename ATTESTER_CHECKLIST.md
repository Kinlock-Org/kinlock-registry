# Attester checklist

Requirement `REG-6`, roadmap `M1-26`. The script below is real and checked against live testnet
data; the checklist as a whole is still marked `IN PROGRESS` in `ROADMAP.md` because its "runs end
to end on testnet" criterion needs a real attester to actually complete it (`M0-06`), not just a
working script.

Complete every step before opening a payee PR. Keep identity evidence yourself; never put it in this repo or any Kinlock system.

For a comprehensive step-by-step walkthrough from account readiness to `meta_hash` calculation, see the [Attester Guide](docs/ATTESTER_GUIDE.md).

## Eligibility
- [ ] The payee's country is listed in `supported-countries.json`.
- [ ] You are authorized for that country in `attesters/<your-handle>.json`.
- [ ] You verified the institution off-chain and keep the evidence privately.
- [ ] The payee is legally able to receive stablecoins in its country (per counsel's guidance for that market).

## Payout account
- [ ] Run `pnpm check-attester-readiness <payout-address>` (`scripts/check-attester-readiness.ts`): confirms the account exists, has enough native XLM for fees, and holds an authorized USDC trustline with room. Read-only, nothing is signed or sent.
- [ ] Test receive and a test release completed on testnet, through `kinlock-app` or the SDK directly. The script above deliberately doesn't automate this step: it's a real transaction, not something a read-only check should fake.

## Cash-out
- [ ] Payee walked through the cash-out route for their country (wallet + anchor, or holding USDC), including minimums and fees.

## Registry PR
- [ ] File at `payees/<country>/<slug>.json`, public fields only.
- [ ] `meta_hash` produced by `scripts/hash.ts`, then `register_payee` called with it.

## Key rotation
If an attester signing key is rotated or suspected of compromise, complete the following steps in order:
- [ ] **1. Prepare and verify the new Stellar account:** Provision a new Stellar keypair and fund it with native XLM for transaction fees. Run `pnpm check-attester-readiness <new-attester-address>` to verify the account exists on-chain and holds sufficient XLM float.
- [ ] **2. Rotate on-chain attester authorization:** Coordinate with the Kinlock multisig admin (`kinlock-contracts`) to invoke `add_attester(<new-attester-address>)` and `remove_attester(<old-attester-address>)`. Per ADR-0019, removing the old address immediately revokes its ability to register or modify payees while leaving existing open locks untouched.
- [ ] **3. Update the registry record:** Update the `"address"` field in `attesters/<your-handle>.json` to `<new-attester-address>` (maintaining canonical sorted keys, 2-space indentation, and trailing newline).
- [ ] **4. Run local and on-chain verification commands:**
  ```bash
  pnpm validate
  pnpm check-onchain
  ```
- [ ] **5. Open the rotation pull request:** Submit a PR with the updated `attesters/<your-handle>.json` and a `ROADMAP.md` Changelog entry.
