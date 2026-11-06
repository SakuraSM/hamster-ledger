import type {
  Book,
  Currency,
  ExchangeRate,
  Ledger,
  LedgerMode,
  LedgerRepository,
  Review,
} from "@hamster-ledger/core";
import type { RecordEdit } from "./ledger-actions.js";
import type { NetworkState } from "./network-model.js";
export interface CreateBookPreparation {
  (mode: LedgerMode): Promise<void>;
  assertCurrent?: () => void;
}
export interface LedgerController {
  books: Book[];
  createBook: (
    name: string,
    initial?: Ledger,
    cloud?: Book["cloud"],
    prepare?: CreateBookPreparation,
  ) => Promise<LedgerMode>;
  network?: NetworkState;
  updateBooks: (
    books: Book[],
    options?: { expectedBooks?: Book[]; assertCurrent?: () => void },
  ) => Promise<void>;
  ledger: Ledger;
  personalLedger: Ledger;
  mode: LedgerMode;
  notice: string;
  error: string;
  isLoading: boolean;
  isSaving: boolean;
  canUndo: boolean;
  switchMode: (mode: LedgerMode) => void;
  commit: (
    ledger: Ledger,
    modeOrOptions?:
      | LedgerMode
      | {
          mode?: LedgerMode;
          expectedRevision?: number;
          expectedCloud?: { id: string; userId: string; server: string };
          assertCurrent?: () => void;
        },
  ) => Promise<void>;
  decide: (
    review: Review,
    decision: "linked" | "separate",
    options?: { assertCurrent?: () => void },
  ) => void;
  undo: () => void;
  undoWithGuard?: (assertCurrent: () => void) => void;
  editRecord: (
    input: RecordEdit,
    options?: { assertCurrent?: () => void },
  ) => Promise<void>;
  dismissNotice: () => void;
  notify: (message: string) => void;
}
export interface LedgerEnvironment {
  loadRates?: (
    requests: Array<{ currency: Currency; date: string }>,
  ) => Promise<ExchangeRate[]>;
  repository: LedgerRepository;
  createDemoLedger: () => Ledger;
  localNow: () => string;
  newEntityId: () => string;
}
