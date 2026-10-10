import { useState } from "react";
import type { Ledger } from "@hamster-ledger/core";
import type { EntryDraft } from "@hamster-ledger/ledger-react";
import { SimpleEntryEditor, type EntryEditorProps } from "./SimpleEntryEditor";
import { AdvancedEntryEditor } from "./finance/AdvancedEntryEditor";
export function EntryEditor(
  props: EntryEditorProps & {
    bookId?: string;
    onCommit: (ledger: Ledger, date: string) => Promise<void>;
  },
): React.JSX.Element {
  const [advanced, setAdvanced] = useState<Partial<EntryDraft> | null>(
    props.record?.detail && props.record.detail.origin !== "legacy" ? {} : null,
  );
  return advanced ? (
    <AdvancedEntryEditor
      ledger={props.ledger}
      record={props.record}
      date={props.date}
      bookId={props.bookId}
      initialDraft={advanced}
      onSave={props.onCommit}
      onClose={props.onClose}
    />
  ) : (
    <SimpleEntryEditor {...props} onAdvanced={setAdvanced} />
  );
}
