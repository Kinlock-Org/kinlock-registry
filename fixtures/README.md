# Testnet fixtures

Fictional test institutions for **testnet only**: not real schools or landlords, and not a decision about which countries Kinlock supports. The real registry is at the repo root, and its `supported-countries.json` stays empty until counsel signs off (DEC-20).

These files follow exactly the same rules as the real registry (`pnpm validate`) and are registered on the testnet contract in `network.json` by the testnet attester (`kinlock-testnet-attester-1`). `pnpm check-onchain` confirms each on-chain record matches its file.

| Payee | Country | Category | Payout (USDC trustline, authorized) | Registration tx |
|---|---|---|---|---|
| `ke-kinlock-test-school` | KE | School | `GCLMHF7L…C5QM` | `e8138573de3cb829…` |
| `ng-kinlock-test-academy` | NG | School | `GDPUY733…K7ZG` | `0ecf41bf837252ff…` |
| `ph-kinlock-test-rentals` | PH | Rent | `GBXKOYQ4…2WSX` | `5627c5063e14686b…` |

Registering a new fixture payee: add its file, run `pnpm validate` and `pnpm hash <file>`, merge, then as the attester call `register_payee` with the printed `payee_id` and `meta_hash`, and run `pnpm check-onchain`.
