# Attester checklist

DRAFT. Final version and script: roadmap `M1-26` (depends on `M0-06`). Requirement `REG-6`.

Complete every step before opening a payee PR. Keep identity evidence yourself; never put it in this repo or any Kinlock system.

## Eligibility
- [ ] The payee's country is listed in `supported-countries.json`.
- [ ] You are authorized for that country in `attesters/<your-handle>.json`.
- [ ] You verified the institution off-chain and keep the evidence privately.
- [ ] The payee is legally able to receive stablecoins in its country (per counsel's guidance for that market).

## Payout account
- [ ] Payout account exists on the network.
- [ ] USDC trustline present **and authorized**, with sufficient limit.
- [ ] Small XLM float for fees.
- [ ] Test receive and a test release completed on testnet.

## Cash-out
- [ ] Payee walked through the cash-out route for their country (wallet + anchor, or holding USDC), including minimums and fees.

## Registry PR
- [ ] File at `payees/<country>/<slug>.json`, public fields only.
- [ ] `meta_hash` produced by `scripts/hash.ts`, then `register_payee` called with it.
