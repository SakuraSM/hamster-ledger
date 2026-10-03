import {
  useLedger as useSharedLedger,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import type { LedgerRepository } from "@hamster-ledger/core";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { ledgerRepository } from "../platform/browser/storage";
import { localNow, newEntityId } from "../platform/browser/runtime";
export type { LedgerController } from "@hamster-ledger/ledger-react";
export function useLedger(
  repository: LedgerRepository = ledgerRepository,
): LedgerController {
  return useSharedLedger({
    repository,
    createDemoLedger,
    localNow,
    newEntityId,
  });
}
