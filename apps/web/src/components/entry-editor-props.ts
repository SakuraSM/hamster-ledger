import type { EntryDraft } from "@hamster-ledger/ledger-react";
import type { Ledger, BillRecord, EntryInput } from "@hamster-ledger/core";
export interface EntryEditorProps {
  onAdvanced?: (draft: Partial<EntryDraft>) => void;
  ledger: Ledger;
  record?: BillRecord;
  date?: string;
  onSave: (input: EntryInput) => Promise<void>;
  onClose: () => void;
  onReload?: () => void;
}
