/**
 * meta_hash = SHA-256 of the canonical JSON of a payee file:
 * keys sorted recursively, compact (no whitespace), UTF-8. Not RFC 8785 (ARCHITECTURE.md §5.3, O15).
 * Never compute hashes by hand; always use this script.
 */
import { createHash } from "node:crypto";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export function canonicalize(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k] as Json)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function metaHash(value: Json): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}
