# kinlock-registry

[![Validate](https://github.com/Kinlock-Org/kinlock-registry/actions/workflows/validate.yml/badge.svg)](https://github.com/Kinlock-Org/kinlock-registry/actions/workflows/validate.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

The public payee and attester registry: one JSON file per verified payee, the schemas that bind them, and the hash and policy checks that tie them to the on-chain contract. Data only — no application code.

> **Status: tooling is live, data is not.** Validation, canonical hashing, the scheduled on-chain match check, and the attester readiness script all work. `supported-countries.json` is **empty** and `payees/` and `attesters/` hold no real records: the three countries you see (KE, NG, PH) live under `fixtures/` and exist to test the pipeline against the testnet contract. Real entries need the M0 supported-countries policy (`M0-17`) and a named attester's reviewed PR. See `ROADMAP.md` (`M1-24`..`M1-29`).

**Try it live (testnet):** [kinlock-app.vercel.app](https://kinlock-app.vercel.app) · **Docs:** [kinlock-org.github.io](https://kinlock-org.github.io)

## What's here

| Path | What it is |
|---|---|
| `supported-countries.json` | Countries Kinlock supports. Currently `[]`. Changing it needs a human **and** counsel's sign-off |
| `attesters/<handle>.json` | Each attester's public identity and the countries they may vouch for |
| `payees/<country>/<slug>.json` | One file per verified payee, in ISO 3166-1 alpha-2 lowercase directories |
| `fixtures/` | Testnet-only sample data (KE, NG, PH) used by CI and `check-onchain` |
| `schemas/` | JSON Schemas for payee, attester, and the country list |
| `scripts/` | Validation, hashing, on-chain match, attester readiness |
| `ATTESTER_CHECKLIST.md` | How an attester takes a payee from verified to operational |

A payee record carries **public fields only**: `slug`, `display_name`, `category` (`School` | `Rent`), `country` (ISO 3166-1), `local_currency` (ISO 4217), `city`, `payout_address`, `attester`, `verified_at`. No personal data, no identity documents, no phone numbers, no evidence — identity evidence stays with the attester, in none of Kinlock's systems.

## Commands

```
pnpm install
pnpm validate                                  # both trees: real registry + fixtures
pnpm lint && pnpm typecheck && pnpm test       # biome, tsc, vitest
pnpm hash <payee-file>                         # payee_id and meta_hash, for register_payee
pnpm check-onchain                             # fixtures vs the testnet contract
pnpm check-attester-readiness <payout-address> # read-only: account, XLM float, USDC trustline
```

`check-attester-readiness` is the scripted half of the checklist. It only reads ledger entries, and takes `--min-xlm` (default 2) plus `--token`/`--issuer` for a non-default asset. It never signs or submits anything.

`meta_hash` is SHA-256 over sorted-key, compact, canonical UTF-8 JSON, and `payee_id` is SHA-256 of the slug. **Never compute either by hand** — use `pnpm hash`.

## What CI enforces

`validate.yml` runs lint, typecheck, tests, and `pnpm validate` on every PR and on `main`. Beyond schema validity it fails a payee whose:

- `country` is not in `supported-countries.json`;
- vouching `attester` has no file, or isn't authorized for that country;
- file lives in a directory that doesn't match its `country`;
- `slug` doesn't match its filename or isn't globally unique;
- `local_currency` isn't a valid ISO 4217 code, or `country` isn't a real ISO 3166-1 alpha-2 code.

`onchain-match.yml` runs nightly (and on dispatch, not on PRs) and compares each fixture's on-chain record against its file: `meta_hash`, payout address, category, vouching attester, Active status.

These are **off-chain policy**, not contract rules. The contract has no notion of country and anyone can call it directly — geography is governed by what Kinlock lists and verifies, never enforced on-chain.

## Adding a payee

You don't, on your own initiative. A named attester who has verified the institution off-chain and completed the checklist opens the PR; `CODEOWNERS` routes review. Follow `ATTESTER_CHECKLIST.md`.

## Read first

- `docs/ARCHITECTURE_ESSENTIALS.md` (short; read at the start of every task)
- `AGENTS.md` (rules for humans and agents) and `CLAUDE.md`
- `ROADMAP.md`: **every PR updates it**
- [`ATTESTER_CHECKLIST.md`](ATTESTER_CHECKLIST.md): onboarding steps and the readiness script

Docs in `docs/` are read-only copies synced from [Kinlock-Org/.github](https://github.com/Kinlock-Org/.github).

Found a documentation gap (missing, unclear, or outdated docs)? File it at [Kinlock-Org.github.io](https://github.com/Kinlock-Org/Kinlock-Org.github.io/issues/new/choose) with `area:registry`, the org's documentation hub, not here.
