# kinlock-registry

[![Validate](https://github.com/Kinlock-Org/kinlock-registry/actions/workflows/validate.yml/badge.svg)](https://github.com/Kinlock-Org/kinlock-registry/actions/workflows/validate.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Public payee and attester data, JSON schemas, and the hash and policy checks that bind it to the contract.

> **Status: active development, testnet only.** Schema validation, hashing, and on-chain match checks are implemented, with testnet fixture payees across two countries. See `ROADMAP.md`.

**Try it live (testnet):** [kinlock-app.vercel.app](https://kinlock-app.vercel.app) · **Docs:** [kinlock-org.github.io](https://kinlock-org.github.io)

## Quick start
```
pnpm install
pnpm validate               # registry + testnet fixtures
pnpm hash <payee-file>      # payee_id and meta_hash for register_payee
pnpm check-onchain          # fixtures vs the testnet contract
```

## Read first
- `docs/ARCHITECTURE_ESSENTIALS.md` (short; read at the start of every task)
- `AGENTS.md` (rules for humans and agents) and `CLAUDE.md`
- `ROADMAP.md`: **every PR updates it**

Docs in `docs/` are read-only copies synced from [Kinlock-Org/.github](https://github.com/Kinlock-Org/.github).
