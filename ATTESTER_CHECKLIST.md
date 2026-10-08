# Attester checklist

Requirement `REG-6`, roadmap `M1-26`. The script below is real and checked against live testnet
data; the checklist as a whole is still marked `IN PROGRESS` in `ROADMAP.md` because its "runs end
to end on testnet" criterion needs a real attester to actually complete it (`M0-06`), not just a
working script.

Complete every step before opening a payee PR. Keep identity evidence yourself; never put it in this repo or any Kinlock system.

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
