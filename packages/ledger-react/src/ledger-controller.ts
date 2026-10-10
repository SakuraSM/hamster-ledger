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
export interface LedgerController {
  books: Book[];
  createBook: (
    name: string,
    initial?: Ledger,
    cloud?: Book["cloud"],
    prepare?: (mode: LedgerMode) => Promise<void>,
  ) => Promise<LedgerMode>;
  network?: NetworkState;
  updateBooks: (books: Book[]) => Promise<void>;
  ledger: Ledger;
  personalLedger: Ledger;
  mode: LedgerMode;
  notice: string;
  error: string;
  isLoading: boolean;
  isSaving: boolean;
  canUndo: boolean;
  switchMode: (mode: LedgerMode) => void;
  commit: (ledger: Ledger, mode?: LedgerMode) => Promise<void>;
  decide: (review: Review, decision: "linked" | "separate") => void;
  undo: () => void;
  editRecord: (input: RecordEdit) => Promise<void>;
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
