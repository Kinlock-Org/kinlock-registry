# Registry Validator Boundary Fixture Corpus

> Requirement `REG-boundary`, Roadmap row `M1-40` (`Kinlock-Org/kinlock-registry#15`).  
> Proves edge cases, decimal handling, Unicode / RTL compatibility, and schema rejection boundaries.

---

## 1. Corpus Purpose & Non-Personal Data Guarantee

In accordance with **Hard Rule 7 (Honest Wording)** and **Hard Rule 11 (Country-Agnostic Core)**:
- All institutions and addresses in this directory are fictional and created solely to test schema, hashing, and validator boundaries.
- **Zero real institutions, zero personal data, and zero live wallets.**
- Demonstrates multi-country support across Africa, Asia, Europe, and the Middle East (Japan, Bahrain, Egypt, France, Kenya, Nigeria, Philippines, Ghana) proving the validator has no hidden single-market assumptions.

---

## 2. Valid Boundary Fixtures (`valid/`)

| File | Boundary Tested | Key Attributes |
|---|---|---|
| `0-decimal-jpy.json` | 0-decimal currency | `local_currency: "JPY"`, `country: "JP"` |
| `3-decimal-bhd.json` | 3-decimal currency | `local_currency: "BHD"`, `country: "BH"` |
| `non-latin-japanese.json` | Non-Latin Unicode script | `display_name: "東京国際アカデミー (Tokyo International Academy Fixture)"` |
| `rtl-arabic.json` | Right-to-Left (RTL) script | `display_name: "مدرسة القاهرة النموذجية للاختبار"` |
| `diacritics-french.json` | Multi-word with diacritics | `display_name: "Lycée Français & Collège de Saint-Louis à Châteauneuf"` |
| `slug-exact-80-chars.json` | Maximum slug length limit | Exactly 80 characters: `ke-valid-boundary-school-slug-padding-segment-test-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |

All valid fixtures satisfy:
- RFC 8785 canonical hashing equivalence (`meta_hash` stability).
- JSON schema structure (`schemas/payee.schema.json`).

---

## 3. Invalid Boundary Fixtures (`invalid/`)

| File | Failure Condition | Expected Validator Rejection Message |
|---|---|---|
| `slug-81-chars.json` | Slug exceeds 80 chars (81 chars) | `data/slug must NOT have more than 80 characters` |
| `payout-address-short-55.json` | Wrong payout address length (55 chars) | `data/payout_address must match pattern "^[GC][A-Z2-7]{55}$"` |
| `payout-address-lowercase.json` | Payout address contains lowercase letter | `data/payout_address must match pattern "^[GC][A-Z2-7]{55}$"` |
| `payout-address-swapped-prefix.json` | Payout address starts with `S` (invalid prefix) | `data/payout_address must match pattern "^[GC][A-Z2-7]{55}$"` |
| `directory-country-mismatch.json` | File placed in directory `ph/` but `country: "KE"` | `country KE must live in payees/ke/` |
| `attester-unauthorized-country.json` | Attester not authorized for target country `GH` | `attester "kinlock-testnet-attester-1" is not authorized for GH` |
| `duplicate-slug-cross-country.json` | Slug already claimed by another country | `slug "ke-kinlock-test-school" is already used by` |

---

## 4. Verification in Test Suite

These fixtures are exercised in `scripts/boundary.test.ts` (and `scripts/registry.test.ts`), which asserts that:
- Every valid fixture passes without errors.
- Every invalid fixture fails and matches its exact expected rejection error pattern.
- Canonical JSON serialization and `metaHash` remain stable across non-Latin and RTL Unicode encodings.
