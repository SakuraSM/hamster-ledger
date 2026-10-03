import { Alert, Button } from "@mantine/core";
import type { AttachmentStore } from "@hamster-ledger/core";
import { useAttachmentPreview } from "@hamster-ledger/ledger-react";
import { Dialog } from "../Dialog";
export function DraftAttachments({
  store,
  bookId,
  ids,
}: {
  store: AttachmentStore;
  bookId: string;
  ids: string[];
}): React.JSX.Element {
  const preview = useAttachmentPreview(store, bookId);
  return (
    <>
      <div className="button-row">
        {ids.map((id, index) => (
          <Button
            key={id}
            variant="outline"
            disabled={preview.isBusy}
            onClick={() => void preview.open(id)}
          >
            查看原始凭证 {index + 1}
          </Button>
        ))}
      </div>
      {preview.error ? (
        <Alert role="alert" color="red">
          {preview.error}
        </Alert>
      ) : null}
      {preview.image ? (
        <Dialog title={preview.image.name} onClose={preview.close}>
          <img
            src={`data:${preview.image.mime};base64,${preview.image.base64}`}
            alt={preview.image.name}
            style={{ maxWidth: "100%", height: "auto" }}
          />
        </Dialog>
      ) : null}
    </>
  );
}
