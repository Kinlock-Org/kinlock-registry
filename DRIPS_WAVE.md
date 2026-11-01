# Kinlock Registry — Drips Wave Application & Review Summary

> Program: [Stellar Wave on Drips Network](https://www.drips.network/wave/stellar) (backed by the Stellar Development Foundation)  
> Organization: [`Kinlock-Org`](https://github.com/Kinlock-Org)  
> Repository: `Kinlock-Org/kinlock-registry` (Public Payee & Attester Registry)

This document provides a single-page executive and technical summary for the Drips Wave review panel evaluating Kinlock for inclusion in the Stellar Wave Program.

---

## 1. Project Overview & Real-World Utility

**Kinlock Registry** is the public, cryptographically bound directory of verified institutional payees (schools, property managers) and authorized attesters.

- **Real-World Problem:** Decentralized escrow requires transparent, tamper-proof verification of payee credentials, payout addresses, and regional jurisdictions without centralized lock-in or exposure of private personal information.
- **Data Architecture & Stellar Contract Binding:**
  - **Canonical JSON Hashing:** Payee records are hashed into a deterministic `meta_hash` (`sha256` over sorted-key compact UTF-8 JSON) and `payee_id` (`sha256` of slug). The Soroban contract verifies that registered on-chain payees match their public git-tracked metadata.
  - **Strict Privacy Invariant:** Registry schemas enforce public fields only (`slug`, `display_name`, `category`, `country`, `local_currency`, `city`, `payout_address`, `attester`, `verified_at`). No identity documents, bank statements, personal phone numbers, or private credentials ever enter the repository or chain.
  - **Worldwide Neutrality:** Directory structures use ISO 3166-1 alpha-2 codes (`payees/<country>/<slug>.json`) and ISO 4217 currency standards. Country permissions are policy-governed via `supported-countries.json` and attester scopes, keeping the on-chain contract universal.
  - **Readiness Verification Tooling:** Includes automated CLI scripts (`pnpm check-attester-readiness`) to verify on-ledger trustlines, base reserve XLM floats, and account activation before an attester submits a payee registration.

---

## 2. Live Deployed Artifacts & Verification

| Resource | Link / Reference |
|---|---|
| **Live Web App (Testnet)** | [kinlock-app.vercel.app](https://kinlock-app.vercel.app) |
| **Documentation Hub** | [kinlock-org.github.io](https://kinlock-org.github.io) |
| **Contract ID (Testnet)** | [`CCSHDQFRYFC3AHV5NE6ULQW6X2CMG5RPANBORDXJGSUD6UKECASJQBRI`](https://stellar.expert/explorer/testnet/contract/CCSHDQFRYFC3AHV5NE6ULQW6X2CMG5RPANBORDXJGSUD6UKECASJQBRI) |
| **Admin Address (2-of-3 Multisig)** | `GDFOEZ673H2FMB4UUD57BPR76PJJQJCK7U2LND25QW5377Y6VUGKCWPV` |
| **Allowlisted USDC SAC Address** | `CAQCFVLOBWSG3DRR6CE67D5Q46MVAJWJ2K7G4GB5T3D56D3N25T7P2N6` |
| **Attester Guide & Checklist** | [`docs/ATTESTER_GUIDE.md`](docs/ATTESTER_GUIDE.md) · [`ATTESTER_CHECKLIST.md`](ATTESTER_CHECKLIST.md) |
| **Testnet Fixture Payees** | Kenya (`KE`), Nigeria (`NG`), Philippines (`PH`) in [`fixtures/`](fixtures/) |

---

## 3. Reviewer Checklist & Repository Hygiene

- [x] **Hosted under Organization:** [`Kinlock-Org`](https://github.com/Kinlock-Org)
- [x] **Permissive License:** Apache-2.0 ([`LICENSE`](LICENSE))
- [x] **Branch Protection:** Enforced on `main` (peer reviews required, required checks passing)
- [x] **Continuous Integration (CI):** Green GitHub Actions running Biome linting, TypeScript `tsc`, Vitest test runner, and strict schema validation (`pnpm validate`)
- [x] **Automated On-Chain Match CI:** Scheduled GitHub Actions workflow (`onchain-match.yml`) validating that fixture metadata matches live Soroban contract state on testnet
- [x] **Security Hardening:**
  - CodeQL SAST scanning (Actions, JavaScript/TypeScript)
  - Semgrep code security checks
  - JSON Schema validation with Draft-07 compliance
  - Strict CI enforcement preventing commits with personal data or invalid directory structures
- [x] **Testing Rigor:**
  - 5 test suites with 48 passing tests
  - Validation tests covering canonical formatting, attester geographic authorization, duplicate slug prevention, and refusal of PII fields
- [x] **Roadmap & Progress Tracking:** Every PR tracked and enforced via [`ROADMAP.md`](ROADMAP.md)

---

## 4. Drips Wave Task Queue & Issue Board

Issues for external contributors follow a strict three-tier complexity mapping aligned with Drips Wave points:
- **Trivial (100 points):** Schema property descriptions, fixture data edge cases, and documentation clarity.
- **Medium (150 points):** Attester readiness CLI checks (e.g., Soroban RPC health verification, asset trustline flags).
- **High (200 points):** Automated batch verification harnesses, attester cryptographic signature checks, and multi-region metadata sync scripts.

> **Task Safety Rule:** Under `AGENTS.md`, no payee may be added on an agent's initiative. Additions come strictly from verified attesters through reviewed PRs. Wave tasks focus on validation harnesses, schema tooling, and offline verification scripts.

- **Active Bounty Issues:** [Kinlock Registry Wave Issues](https://github.com/Kinlock-Org/kinlock-registry/issues?q=is%3Aissue+is%3Aopen+label%3Adrips-wave%2Cwave)
- **Contribution Guide:** [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/wave-issue-format.md`](https://github.com/Kinlock-Org/.github/blob/main/docs/wave-issue-format.md)

---

## 5. Core Maintainers

| Name | Role | GitHub | Contact |
|---|---|---|---|
| Ayobami Yazar | Core Maintainer (Full-Stack & Integrations) | [@YazarAyobami](https://github.com/YazarAyobami) | [Email](mailto:Yazarayobami76@gmail.com) |
| Adenike Ajala | Core Maintainer (Smart Contracts & Protocol) | [@abrcrmb](https://github.com/abrcrmb) | [Email](mailto:adenikeajala2018@gmail.com) |
