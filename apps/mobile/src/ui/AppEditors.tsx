import { saveEntry, type BillRecord } from "@hamster-ledger/core";
import type {
  EntryDraft,
  LedgerController,
} from "@hamster-ledger/ledger-react";
import { MONTH_KEY_LENGTH } from "../constants";
import { EntryEditor } from "../screens/EntryEditor";
import { RecordDetail } from "../screens/RecordDetail";
import { RecordMetadataEditor } from "../screens/RecordMetadataEditor";

export interface MobileEditorState {
  record?: BillRecord;
  date?: string;
  initialDraft?: Partial<EntryDraft>;
}
interface AppEditorsProps {
  controller: LedgerController;
  detail: BillRecord | null;
  editor: MobileEditorState | null;
  metadata: BillRecord | null;
  onCloseDetail: () => void;
  onEdit: (record: BillRecord) => void;
  onCloseEditor: () => void;
  onCloseMetadata: () => void;
  onMonth: (month: string) => void;
}
export function AppEditors({
  controller,
  detail,
  editor,
  metadata,
  onCloseDetail,
  onEdit,
  onCloseEditor,
  onCloseMetadata,
  onMonth,
}: AppEditorsProps): React.JSX.Element {
  return (
    <>
      {detail ? (
        <RecordDetail
          controller={controller}
          record={detail}
          onClose={onCloseDetail}
          onEdit={onEdit}
        />
      ) : null}
      {editor ? (
        <EntryEditor
          bookId={
            controller.books.find((book) => book.id === controller.mode)?.cloud
              ?.id
          }
          onCommit={async (next, date) => {
            await controller.commit(next);
            onMonth(date.slice(0, MONTH_KEY_LENGTH));
            controller.notify("账单已保存。");
          }}
          ledger={controller.ledger}
          record={editor.record}
          initialDraft={editor.initialDraft}
          date={editor.date}
          onClose={onCloseEditor}
          onSave={async (input) => {
            await controller.commit(saveEntry(controller.ledger, input));
            onMonth(input.date.slice(0, MONTH_KEY_LENGTH));
            controller.notify("账单已保存");
          }}
        />
      ) : null}
      {metadata ? (
        <RecordMetadataEditor
          record={metadata}
          controller={controller}
          onClose={onCloseMetadata}
        />
      ) : null}
    </>
  );
}
