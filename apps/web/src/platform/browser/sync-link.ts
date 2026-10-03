import { STORAGE_PREFIX, type LedgerMode } from "@hamster-ledger/core";
const HEX_RADIX = 16;
const HEX_BYTE_LENGTH = 2;
export interface Link {
  id: string;
  revision: number;
  fingerprint: string;
}
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  return value;
}
export async function fingerprint(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonicalize(value))),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(HEX_RADIX).padStart(HEX_BYTE_LENGTH, "0"),
  ).join("");
}
export const linkKey = (userId: string, mode: LedgerMode): string =>
  STORAGE_PREFIX + "sync." + userId + "." + mode;
