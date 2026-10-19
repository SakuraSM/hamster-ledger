import {
  attachmentSchema,
  attachmentReferences,
  createArchive,
  type Attachment,
  type AttachmentStore,
  type Ledger,
  type LedgerMode,
} from "@hamster-ledger/core";
import type { LedgerController } from "./ledger-controller.js";
import type { NetworkClient } from "./network-model.js";
export function remoteAttachments(client: NetworkClient): AttachmentStore {
  const path = (bookId: string): string =>
    `/network/books/${bookId}/attachments`;
  return {
    async list(bookId) {
      return (
        await client.request<{
          attachments: Array<Omit<Attachment, "base64">>;
        }>(path(bookId))
      ).attachments;
    },
    async get(bookId, id) {
      return attachmentSchema.parse(
        await client.request(`${path(bookId)}/${id}`),
      );
    },
    async put(bookId, attachment) {
      const result = await client.request<{ id: string }>(path(bookId), {
        method: "POST",
        body: attachment,
      });
      if (result.id !== attachment.id) throw new Error("附件 ID 不匹配。");
    },
    async remove(bookId, id) {
      await client.request(`${path(bookId)}/${id}`, {
        method: "DELETE",
        body: {},
      });
    },
  };
}
export interface ArchiveProgress {
  check?: () => void;
  onProgress?: (completed: number, total: number) => void;
}
export async function exportArchive(
  store: AttachmentStore,
  bookId: string,
  ledger: Ledger,
  progress: ArchiveProgress = {},
): Promise<string> {
  const images: Attachment[] = [];
  const ids = attachmentReferences(ledger);
  progress.onProgress?.(0, ids.length);
  for (const id of ids) {
    progress.check?.();
    images.push(await store.get(bookId, id));
    progress.onProgress?.(images.length, ids.length);
  }
  progress.check?.();
  return createArchive(ledger, images);
}
export async function restoreArchive(input: {
  store: AttachmentStore;
  ledger: Ledger;
  attachments: Attachment[];
  verify: (attachment: Attachment) => Promise<Attachment>;
  createBook: LedgerController["createBook"];
  progress?: ArchiveProgress;
}): Promise<LedgerMode> {
  createArchive(input.ledger, input.attachments);
  input.progress?.check?.();
  for (const attachment of input.attachments) {
    input.progress?.check?.();
    await input.verify(attachment);
  }
  input.progress?.check?.();
  let destination: LedgerMode | undefined;
  try {
    return await input.createBook(
      "恢复的账本",
      input.ledger,
      undefined,
      async (mode) => {
        destination = mode;
        input.progress?.onProgress?.(0, input.attachments.length);
        let completed = 0;
        for (const attachment of input.attachments) {
          input.progress?.check?.();
          await input.store.put(mode, attachment);
          input.progress?.onProgress?.(++completed, input.attachments.length);
        }
        input.progress?.check?.();
      },
    );
  } catch (error) {
    if (destination)
      for (const attachment of input.attachments)
        await input.store.remove(destination, attachment.id).catch(() => {});
    throw error;
  }
}
export async function cleanupAttachments(
  store: AttachmentStore,
  bookId: string,
  ledger: Ledger,
  now: number,
): Promise<number> {
  const used = new Set(attachmentReferences(ledger));
  let removed = 0;
  for (const item of await store.list(bookId))
    if (!used.has(item.id) && item.createdAt < now - 86400000) {
      await store.remove(bookId, item.id);
      removed++;
    }
  return removed;
}

export async function prepareAttachmentConversion(input: {
  store: AttachmentStore;
  mode: string;
  ledger: Ledger;
  client: NetworkClient;
  newId: () => string;
}): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const id of attachmentReferences(input.ledger)) {
    const image = await input.store.get(input.mode, id);
    const uploaded = await input.client.request<{ id: string }>(
      "/attachments",
      { method: "POST", body: { ...image, id: input.newId() } },
    );
    map[id] = uploaded.id;
  }
  return map;
}
