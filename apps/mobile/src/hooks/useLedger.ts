import { useNativeAccount } from "../auth/NativeAccount";
import {
  useLedger as useSharedLedger,
  loadDueRates,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { ledgerRepository } from "../platform/storage";
import { localNow, newEntityId } from "../platform/runtime";
export function useLedger(): LedgerController {
  const account = useNativeAccount();
  return useSharedLedger({
    repository: ledgerRepository,
    createDemoLedger,
    localNow,
    newEntityId,
    loadRates: (requests) => loadDueRates(account.client, requests),
  });
}
