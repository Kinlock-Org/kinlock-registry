# Kinlock Attester Guide: From Payee Record to `meta_hash` to Review

> Requirement `REG-6`, Roadmap `M1-26`.  
> For authorized attesters onboarding schools, landlords, and educational institutions into the Kinlock registry.

---

## 1. What a Payee Record Means (and Does Not Mean)

Before authoring a record, keep **Hard Rule 7 (Honest Wording)** front and center:
- **What it is:** A payee record is an on-chain and in-registry attestation that an authorized, vetted attester has verified an institution's identity and confirmed its designated payout address on the Stellar blockchain.
- **What it is NOT:** A payee record does **not** prove that funds sent to the institution were spent on a specific service, that goods were delivered, or that tuition/rent was settled. It proves *payment to a verified payee*, nothing more.

Never collect, commit, or link private identity documents, bank accounts, or personal data to this repository. All private verification evidence must remain confidentially with the attester (**Hard Rule 11**).

---

## 2. Prerequisites & Eligibility

Before creating a payee file, verify:

1. **Country Support:** The country must be present in `supported-countries.json`.  
   *(Note: production `supported-countries.json` starts empty `[]`; testnet trials use `fixtures/supported-countries.json`). If a country is not yet supported, do not add it yourself — expanding geographic coverage requires maintainer and legal sign-off.*
2. **Attester Authorization:** Your attester handle must be configured in `attesters/<handle>.json` with the target country included in `countries`.
3. **Legal Assessment:** The payee must be legally permitted to receive stablecoins (USDC) in their jurisdiction.

---

## 3. Step 1: Check Payout Account Readiness

The payee must control a Stellar account configured to receive SAC USDC.

Run the readiness tool from the repository root:

```bash
pnpm check-attester-readiness <payout-address>
```

Example real execution output against a testnet payee account:

```
$ pnpm check-attester-readiness GCLMHF7LAR34TSELDNEREYPTNE4K7MMESPS62WXE7ZDLPWIJUF3MC5QM
Checking GCLMHF7LAR34TSELDNEREYPTNE4K7MMESPS62WXE7ZDLPWIJUF3MC5QM on testnet (token CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA)
✓ native XLM float: 9999.9647224 (need >= 2)
✓ USDC trustline authorized: true
✓ USDC trustline room: limit 9223372036854775807 > balance 80000000
Account and trustline checks pass. Next: complete a real test receive and test release through kinlock-app or the SDK, then check the remaining boxes in ATTESTER_CHECKLIST.md by hand.
```

### What this checks:
- **Native XLM float:** Confirms the account holds at least 2 XLM to cover base reserves and transaction fees.
- **USDC trustline authorization:** Confirms the trustline exists and has authorization flags enabled (`authorized: true`).
- **Trustline headroom:** Confirms the account has sufficient headroom below its trustline limit to receive payment tranches.

> [!IMPORTANT]
> **Manual Test Transaction:** `check-attester-readiness.ts` deliberately does **not** automate the "test receive and test release" step. Because testing involves real state transitions on Stellar, attesters must execute a test payment and release via `kinlock-app` or the `@kinlock/sdk` manually.

---

## 4. Step 2: Author the Payee Record

Create the payee record at:
```
payees/<country-lowercase>/<slug>.json
```
*(For testnet fixtures, the path is `fixtures/payees/<country-lowercase>/<slug>.json`)*

### Example Record Schema

```json
{
  "attester": "kinlock-testnet-attester-1",
  "category": "School",
  "city": "Nairobi",
  "country": "KE",
  "display_name": "Kinlock Test School (fixture)",
  "local_currency": "KES",
  "payout_address": "GCLMHF7LAR34TSELDNEREYPTNE4K7MMESPS62WXE7ZDLPWIJUF3MC5QM",
  "slug": "ke-kinlock-test-school",
  "verified_at": "2026-10-06"
}
```

### Field Requirements:
- `attester`: Your exact attester handle (must match an entry in `attesters/`).
- `category`: Must be either `"School"` or `"Rent"`.
- `city`: Public city name of the institution.
- `country`: Two-letter uppercase ISO 3166-1 alpha-2 code (e.g. `KE`, `NG`, `PH`).
- `display_name`: Clean, human-readable institution name.
- `local_currency`: Three-letter uppercase ISO 4217 currency code (e.g. `KES`, `NGN`, `PHP`).
- `payout_address`: Valid 56-character Stellar public key starting with `G`. Never invent or guess an address.
- `slug`: Unique lowercase slug matching `^[a-z]{2}-[a-z0-9-]+$` and matching the filename without `.json`.
- `verified_at`: ISO date formatted `YYYY-MM-DD`.

---

## 5. Step 3: Validate the Record

Run the registry validation suite locally:

```bash
pnpm validate
```

Example real execution output:

```
$ pnpm validate
3 payee file(s) checked, 0 problem(s)
```

The validator checks:
1. JSON schema compliance (`schemas/payee.schema.json`).
2. Directory structure match (`payees/<country>/<slug>.json`).
3. Attester authorization for that specific country.
4. Slug uniqueness across all registered payees.
5. Country and currency validity against ISO registries.

---

## 6. Step 4: Compute `meta_hash`

> [!CAUTION]
> **Never compute `meta_hash` by hand or using external hashing tools.**  
> The smart contract verifies canonical RFC 8785 JSON serialization. Computing the hash by hand will lead to hash mismatch errors on chain.

Run the repository hashing utility:

```bash
pnpm hash <path-to-payee-file>
```

Example real run output:

```
$ pnpm hash fixtures/payees/ke/ke-kinlock-test-school.json
payee_id  4485665bae55d2562f20ad82cec50c8aaa99ddf613b982509711a6b474ded0ba
meta_hash 4c62af9d86c73d0a0f3733c76741ae1d1206e439daf7d1ee7fa0d4f167b8ed24
```

- `meta_hash`: The SHA-256 hash of the canonically serialized record.
- `payee_id`: The identifier derived from `(attester, payout_address)` on chain.

---

## 7. Step 5: On-Chain Registration & Pull Request

1. **On-chain call:** Using your authorized attester key, invoke `register_payee` on the Kinlock contract with:
   - `payee_address`: The `payout_address` from the record.
   - `meta_hash`: The 32-byte hex hash output from `pnpm hash`.
2. **Open Pull Request:**
   - Commit the new JSON file to a branch and push to your fork.
   - Open a pull request against `Kinlock-Org/kinlock-registry`.
   - Title format: `payee(<country>): add <display_name>`
   - Link the on-chain testnet registration transaction in the PR description.
3. **Automated CI Review:**
   - GitHub Actions runs `pnpm lint`, `pnpm validate`, and `pnpm check-onchain`.
   - `pnpm check-onchain` verifies that the `meta_hash` in the repository exactly matches the hash registered on Stellar.
