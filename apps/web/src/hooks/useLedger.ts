import { cloudRequest } from "../platform/browser/cloud-request";
import {
  useLedger as useSharedLedger,
  loadDueRates,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { EMPTY_LEDGER, type LedgerRepository } from "@hamster-ledger/core";
import { ledgerRepository } from "../platform/browser/storage";
import { localNow, newEntityId } from "../platform/browser/runtime";
export type { LedgerController } from "@hamster-ledger/ledger-react";
export function useLedger(
  repository: LedgerRepository = ledgerRepository,
): LedgerController {
  return useSharedLedger({
    repository,
    createDemoLedger: () => EMPTY_LEDGER,
    localNow,
    newEntityId,
    loadRates: (requests) =>
      loadDueRates(
        { request: <T>(path: string) => cloudRequest<T>(path) },
        requests,
      ),
  });
}
