export type EntryState = "loading" | "account" | "ledger";
export interface EntryStateInput {
  isLedgerLoading: boolean;
  isAccountLoading: boolean;
  isIdentityCurrent?: boolean;
  needsEntry: boolean;
  mustChangePassword: boolean;
}
export function entryState(input: EntryStateInput): EntryState {
  if (
    input.isLedgerLoading ||
    input.isAccountLoading ||
    input.isIdentityCurrent === false
  )
    return "loading";
  return input.needsEntry || input.mustChangePassword ? "account" : "ledger";
}
