# kinlock-registry

Public payee and attester data, JSON schemas, and the hash and policy checks that bind it to the contract.

> **Status: scaffold.** Structure and data models are drafted; features are not built. Testnet only.

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
