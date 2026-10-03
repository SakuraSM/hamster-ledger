import {
  useNetworkLedger,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { ledgerRepository } from "../platform/storage";
import { newEntityId } from "../platform/runtime";
export function useNetworkController(
  local: LedgerController,
): LedgerController {
  const account = useNativeAccount();
  return useNetworkLedger({
    local,
    client: account.client,
    userId: account.credentials?.user.id ?? null,
    server: account.server,
    repository: ledgerRepository,
    newId: newEntityId,
  });
}
