import { expect, it, vi } from "vitest";
import {
  EMPTY_LEDGER,
  type Attachment,
  type AttachmentStore,
} from "@hamster-ledger/core";
import { exportArchive, restoreArchive } from "@hamster-ledger/ledger-react";
const attachment: Attachment = {
  id: "image",
  name: "synthetic.png",
  mime: "image/png",
  base64: "YWJj",
  hash: "a".repeat(64),
  createdAt: 1,
};
function store(): AttachmentStore {
  return {
    list: vi.fn(async () => []),
    get: vi.fn(async () => attachment),
    put: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
}
it("checks cancellation before creating an export even without attachments", async () => {
  await expect(
    exportArchive(store(), "personal", EMPTY_LEDGER, {
      check: () => {
        throw new Error("cancelled");
      },
    }),
  ).rejects.toThrow("cancelled");
});
it("cleans staged attachments and never persists a book when restore is cancelled", async () => {
  const images = store();
  let cancelled = false;
  const persist = vi.fn();
  await expect(
    restoreArchive({
      store: images,
      ledger: EMPTY_LEDGER,
      attachments: [attachment],
      verify: async (image) => image,
      progress: {
        onProgress: (done) => {
          if (done === 1) cancelled = true;
        },
        check: () => {
          if (cancelled) throw new Error("cancelled");
        },
      },
      createBook: async (_name, _ledger, _cloud, prepare) => {
        await prepare?.("personal");
        persist();
        return "personal";
      },
    }),
  ).rejects.toThrow("cancelled");
  expect(images.put).toHaveBeenCalledOnce();
  expect(images.remove).toHaveBeenCalledWith("personal", "image");
  expect(persist).not.toHaveBeenCalled();
});
