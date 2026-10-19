import { useEffect, useRef, useState } from "react";
import { STORAGE_PREFIX, type KeyValueStore } from "@hamster-ledger/core";
import type { ArchiveProgress } from "./attachment-store.js";
export function useArchiveProgress(store: KeyValueStore, bookId: string) {
  const cancelled = useRef(false);
  const active = useRef(true);
  const identity = useRef(bookId);
  identity.current = bookId;
  const [status, setStatus] = useState("");
  const [lastExport, setLastExport] = useState("");
  const key = `${STORAGE_PREFIX}backup.last.v1:${bookId}`;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      cancelled.current = true;
    };
  }, []);
  useEffect(() => {
    let stopped = false;
    setLastExport("");
    void store
      .getItem(key)
      .then((value) => {
        if (!stopped && value && Number.isFinite(Date.parse(value)))
          setLastExport(value);
      })
      .catch(() => {
        if (!stopped) setStatus("最近备份记录读取失败。");
      });
    return () => {
      stopped = true;
      cancelled.current = true;
    };
  }, [key, store]);
  const check = (): void => {
    if (cancelled.current || !active.current || identity.current !== bookId)
      throw new Error("操作已取消，原账本保持不变。");
  };
  const options: ArchiveProgress = {
    check,
    onProgress: (done, total) => {
      if (active.current)
        setStatus(total ? `附件 ${done} / ${total}` : "正在准备账本…");
    },
  };
  return {
    status,
    lastExport,
    options,
    check,
    begin: () => {
      cancelled.current = false;
      setStatus("正在准备…");
    },
    cancel: () => {
      cancelled.current = true;
      setStatus("正在取消，等待当前文件处理完成…");
    },
    finish: () => {
      if (active.current) setStatus("");
    },
    markExported: async () => {
      const time = new Date().toISOString();
      try {
        await store.setItem(key, time);
        if (active.current && identity.current === bookId) setLastExport(time);
      } catch {
        throw new Error("备份已生成，但最近导出时间未能保存。");
      }
    },
  };
}
