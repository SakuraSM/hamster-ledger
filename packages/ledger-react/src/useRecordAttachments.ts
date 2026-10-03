import { useRef, useState } from "react";
import {
  migrateLedger,
  type Attachment,
  type AttachmentStore,
} from "@hamster-ledger/core";
import type { LedgerController } from "./ledger-controller.js";
export interface RecordAttachmentsController {
  ids: string[];
  viewing: Attachment | null;
  close: () => void;
  isBusy: boolean;
  error: string;
  add: (images: Attachment[]) => Promise<void>;
  view: (id: string) => Promise<void>;
  unlink: (id: string) => Promise<void>;
}
export function useRecordAttachments(input: {
  controller: LedgerController;
  recordId: string;
  store: AttachmentStore;
  storageId: string;
}): RecordAttachmentsController {
  const { controller, recordId, store, storageId } = input;
  const record = controller.ledger.records.find((item) => item.id === recordId);
  const [viewing, setViewing] = useState<Attachment | null>(null),
    [error, setError] = useState(""),
    [isBusy, setBusy] = useState(false);
  const locked = useRef(false),
    latest = useRef(input);
  latest.current = input;
  async function run(action: () => Promise<void>): Promise<void> {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "附件操作失败。");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function change(ids: string[]): ReturnType<typeof migrateLedger> {
    const ledger = migrateLedger(controller.ledger);
    return {
      ...ledger,
      records: ledger.records.map((item) =>
        item.id === recordId && item.detail
          ? { ...item, detail: { ...item.detail, attachmentIds: ids } }
          : item,
      ),
    };
  }
  const ids = record?.detail?.attachmentIds ?? [];
  return {
    ids,
    viewing,
    isBusy,
    error,
    close: () => setViewing(null),
    view: (id) =>
      run(async () => {
        const image = await store.get(storageId, id);
        if (latest.current.storageId === storageId) setViewing(image);
      }),
    add: (images) =>
      run(async () => {
        if (!record || record.isDeleted)
          throw new Error("账单不存在或已删除。");
        if (ids.length + images.length > 10)
          throw new Error("一笔账单最多关联 10 张凭证。");
        for (const image of images) await store.put(storageId, image);
        if (
          latest.current.controller.ledger !== controller.ledger ||
          latest.current.storageId !== storageId
        )
          throw new Error("账本已变化，请重新添加附件。");
        await controller.commit(
          change([...new Set([...ids, ...images.map((image) => image.id)])]),
        );
        controller.notify("凭证已关联，可撤销。");
      }),
    unlink: (id) =>
      run(async () => {
        await controller.commit(change(ids.filter((value) => value !== id)));
        controller.notify(
          "已解除凭证关联，可撤销；未引用的附件可在备份工具中清理。",
        );
      }),
  };
}
