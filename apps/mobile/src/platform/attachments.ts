import * as Crypto from "expo-crypto";
import {
  attachmentSchema,
  type Attachment,
  type AttachmentStore,
} from "@hamster-ledger/core";
import { nativeStore } from "./storage";
const prefix = (bookId: string): string =>
  `hamster-ledger.v1.attachments:${bookId}`;
let queue: Promise<void> = Promise.resolve();
function serial<Result>(action: () => Promise<Result>): Promise<Result> {
  const operation = queue.then(action);
  queue = operation.then(
    () => {},
    () => {},
  );
  return operation;
}
async function ids(bookId: string): Promise<string[]> {
  return JSON.parse(
    (await nativeStore.getItem(prefix(bookId))) ?? "[]",
  ) as string[];
}
export async function verifyAttachment(
  attachment: Attachment,
): Promise<Attachment> {
  const parsed = attachmentSchema.parse(attachment);
  const bytes = Uint8Array.from(atob(parsed.base64), (character) =>
    character.charCodeAt(0),
  );
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytes,
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== parsed.hash) throw new Error("附件校验失败，内容已损坏。");
  return parsed;
}
export const nativeAttachments: AttachmentStore = {
  async list(bookId) {
    return serial(async () =>
      Promise.all(
        (await ids(bookId)).map(async (id) => {
          const item = attachmentSchema.parse(
            JSON.parse(
              (await nativeStore.getItem(`${prefix(bookId)}:${id}`)) ?? "null",
            ),
          );
          const { base64, ...metadata } = item;
          void base64;
          return metadata;
        }),
      ),
    );
  },
  async get(bookId, id) {
    return serial(async () =>
      verifyAttachment(
        attachmentSchema.parse(
          JSON.parse(
            (await nativeStore.getItem(`${prefix(bookId)}:${id}`)) ?? "null",
          ),
        ),
      ),
    );
  },
  async put(bookId, attachment) {
    return serial(async () => {
      const value = await verifyAttachment(attachment);
      const list = await ids(bookId);
      await nativeStore.setItems({
        [`${prefix(bookId)}:${value.id}`]: JSON.stringify(value),
        [prefix(bookId)]: JSON.stringify([...new Set([...list, value.id])]),
      });
    });
  },
  async remove(bookId, id) {
    return serial(async () => {
      const list = await ids(bookId);
      await nativeStore.setItems({
        [prefix(bookId)]: JSON.stringify(list.filter((item) => item !== id)),
        [`${prefix(bookId)}:${id}`]: null,
      });
    });
  },
};
