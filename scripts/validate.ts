/**
 * Registry validation (roadmap M1-24, M1-29). Planned checks, each failing CI:
 * - payee and attester files match their JSON schemas
 * - files are canonically formatted
 * - payee.country is in supported-countries.json
 * - payee.attester exists and is authorized for payee.country
 * - payee file lives in payees/<lowercase country>/
 * - slug is globally unique and equals the file name
 * - attester handle equals the file name
 *
 * SCAFFOLD: not implemented. JSON Schema validator choice is pending (DEC-23).
 */
export {};
