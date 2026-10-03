import { useEffect, useRef, useState } from "react";
import type { Attachment, AttachmentStore } from "@hamster-ledger/core";
export function useAttachmentPreview(
  store: AttachmentStore,
  bookId: string,
): {
  image: Attachment | null;
  error: string;
  isBusy: boolean;
  open: (id: string) => Promise<void>;
  close: () => void;
} {
  const [image, setImage] = useState<Attachment | null>(null),
    [error, setError] = useState(""),
    [isBusy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setImage(null);
    setBusy(false);
    return () => {
      generation.current++;
    };
  }, [bookId, store]);
  return {
    image,
    error,
    isBusy,
    close: () => {
      generation.current++;
      setImage(null);
      setBusy(false);
    },
    open: async (id) => {
      const current = generation.current;
      setBusy(true);
      setError("");
      try {
        const value = await store.get(bookId, id);
        if (current === generation.current) setImage(value);
      } catch (cause) {
        if (current === generation.current)
          setError(cause instanceof Error ? cause.message : "读取附件失败。");
      } finally {
        if (current === generation.current) setBusy(false);
      }
    },
  };
}
