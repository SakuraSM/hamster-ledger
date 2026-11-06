import type { Book, LedgerMode } from "@hamster-ledger/core";

export function navigationIdentity(input: {
  mode: LedgerMode;
  server: string;
  userId?: string;
  cloud?: Book["cloud"];
}): string {
  return JSON.stringify([
    input.mode,
    input.server,
    input.userId ?? null,
    input.cloud?.id ?? null,
    input.cloud?.userId ?? null,
    input.cloud?.server ?? null,
  ]);
}
