# Security

Please report vulnerabilities privately. Policy: [Kinlock-Org/.github SECURITY.md](https://github.com/Kinlock-Org/.github/blob/main/SECURITY.md).

## Reporting a Vulnerability

Kinlock maintains an immutable registry binding off-chain payee metadata to Soroban smart contracts. If you discover a security vulnerability, schema evasion, or privacy defect, **do not open a public issue.** Report it privately through GitHub's "Report a vulnerability" (Private Security Advisories) on this repository, or email the maintainers directly:
- `adenikeajala2018@gmail.com`
- `Yazarayobami76@gmail.com`

## Response & Disclosure Timelines

- **Initial Acknowledgement:** We acknowledge receipt of vulnerability reports within **48 hours**.
- **Triage & Assessment:** We assess severity and provide a remediation plan or status update within **5 business days**.
- **Coordinated Disclosure:** Security patches will be prepared, verified, and released in coordinated disclosure with the reporter. We ask reporters to follow responsible disclosure practices and refrain from public disclosure until patches have landed.

## Scope

In scope for this repository:
- Payee metadata schema validation (Draft-07 JSON Schema).
- Canonical JSON hashing (`meta_hash = sha256(canonical_json)`, `payee_id = sha256(slug)`).
- Strict exclusion of personal data (PII) from registry records and git history.
- Verification scripts (`scripts/check-attester-readiness.ts`, `scripts/validate.ts`).
