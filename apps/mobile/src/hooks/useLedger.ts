import {
  useLedger as useSharedLedger,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { ledgerRepository } from "../platform/storage";
import { localNow, newEntityId } from "../platform/runtime";
export function useLedger(): LedgerController {
  return useSharedLedger({
    repository: ledgerRepository,
    createDemoLedger,
    localNow,
    newEntityId,
  });
}
