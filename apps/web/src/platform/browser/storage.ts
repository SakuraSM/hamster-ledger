import { createLedgerRepository } from "@hamster-ledger/core";
import { protectedStore } from "./vault";
export const ledgerRepository = createLedgerRepository(protectedStore);
