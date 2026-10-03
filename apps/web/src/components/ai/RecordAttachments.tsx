import { useMemo, useState } from "react";
import { Alert, Button, FileInput } from "@mantine/core";
import {
  remoteAttachments,
  useRecordAttachments,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import {
  browserAttachments,
  imageAttachment,
} from "../../platform/browser/attachments";
import { useNetworkClient } from "../../hooks/useNetworkController";
import { Dialog } from "../Dialog";
export function RecordAttachments({
  controller,
  recordId,
}: {
  controller: LedgerController;
  recordId: string;
}): React.JSX.Element {
  const client = useNetworkClient(),
    remote = useMemo(() => remoteAttachments(client), [client]),
    bookId = controller.books.find((book) => book.id === controller.mode)?.cloud
      ?.id;
  const form = useRecordAttachments({
    controller,
    recordId,
    store: bookId ? remote : browserAttachments,
    storageId: bookId ?? controller.mode,
  });
  const [error, setError] = useState("");
  async function upload(files: File[]): Promise<void> {
    try {
      setError("");
      if (files.length > 10) throw new Error("一笔账单最多 10 张凭证。");
      await form.add(await Promise.all(files.map(imageAttachment)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "图片读取失败。");
    }
  }
  return (
    <section>
      <h3>附件凭证</h3>
      <FileInput
        label="为这笔账单添加凭证"
        placeholder="选择凭证图片"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        value={[]}
        disabled={form.isBusy}
        onChange={(files) => void upload(files)}
      />
      {form.ids.map((id, index) => (
        <div key={id} className="button-row">
          <Button
            variant="outline"
            disabled={form.isBusy}
            onClick={() => void form.view(id)}
          >
            查看凭证 {index + 1}
          </Button>
          <Button
            variant="subtle"
            disabled={form.isBusy}
            onClick={() => void form.unlink(id)}
            aria-label={`解除凭证 ${index + 1} 的关联`}
          >
            解除关联
          </Button>
        </div>
      ))}
      {form.error || error ? (
        <Alert role="alert" color="red">
          {form.error || error}
        </Alert>
      ) : null}
      {form.viewing ? (
        <Dialog title={form.viewing.name} onClose={form.close}>
          <img
            src={`data:${form.viewing.mime};base64,${form.viewing.base64}`}
            alt={form.viewing.name}
            style={{ maxWidth: "100%", height: "auto" }}
          />
        </Dialog>
      ) : null}
    </section>
  );
}
