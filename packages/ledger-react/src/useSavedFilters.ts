import { useEffect, useRef, useState } from "react";
import {
  STORAGE_PREFIX,
  savedFiltersSchema,
  savedViewSchema,
  type KeyValueStore,
  type SavedFilters,
  type SavedTransactionView,
  type TransactionFilter,
} from "@hamster-ledger/core";
const queues = new WeakMap<KeyValueStore, Promise<void>>();
interface Session {
  key: string;
  data: SavedFilters;
  view: SavedTransactionView;
  ready: boolean;
}
export function useSavedFilters(input: {
  store: KeyValueStore;
  bookId: string;
  filter: TransactionFilter;
  position: number;
  onApply: (view: SavedTransactionView) => void;
  restoreLast?: boolean;
}) {
  const [presets, setPresets] = useState<SavedFilters["presets"]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const latest = useRef(input);
  latest.current = input;
  const session = useRef<Session | null>(null);
  const key = `${STORAGE_PREFIX}saved-filters.v1:${input.bookId}`;
  const view = savedViewSchema.parse({
    filter: input.filter,
    position: input.position,
  });
  const serialized = JSON.stringify(view);
  if (session.current?.key === key) session.current.view = view;
  function persist(
    target: Session,
    transform?: (value: SavedFilters) => SavedFilters,
  ): Promise<void> {
    const write = (queues.get(input.store) ?? Promise.resolve()).then(
      async () => {
        const value = savedFiltersSchema.parse(
          transform
            ? transform(target.data)
            : { ...target.data, last: target.view },
        );
        await input.store.setItem(target.key, JSON.stringify(value));
        target.data = value;
      },
    );
    queues.set(
      input.store,
      write.catch(() => {}),
    );
    return write;
  }
  useEffect(() => {
    let active = true;
    const target: Session = {
      key,
      data: { version: 1, presets: [] },
      view,
      ready: false,
    };
    session.current = target;
    const original = JSON.stringify(view);
    setReady(false);
    setError("");
    setPresets([]);
    void (queues.get(input.store) ?? Promise.resolve())
      .then(() => input.store.getItem(key))
      .then((raw) => {
        if (!active) return;
        const parsed = raw
          ? savedFiltersSchema.parse(JSON.parse(raw))
          : { version: 1 as const, presets: [] };
        target.data = parsed;
        setPresets(parsed.presets);
        if (
          parsed.last &&
          latest.current.restoreLast !== false &&
          JSON.stringify(target.view) === original
        )
          latest.current.onApply(parsed.last);
        target.ready = true;
        setReady(true);
      })
      .catch(() => {
        if (active) setError("无法读取已保存的筛选方案，原有设置未被覆盖。");
      });
    return () => {
      active = false;
      if (target.ready) void persist(target).catch(() => {});
    };
  }, [key, input.store]);
  useEffect(() => {
    const target = session.current;
    if (!ready || !target?.ready || target.key !== key) return;
    const timer = setTimeout(() => {
      void persist(target).catch(() =>
        setError("筛选位置未能保存，请检查本机存储。"),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [serialized, ready, key]);
  async function update(
    transform: (presets: SavedFilters["presets"]) => SavedFilters["presets"],
  ): Promise<void> {
    const target = session.current;
    if (!target?.ready || target.key !== key) return;
    try {
      await persist(target, (value) => ({
        ...value,
        presets: transform(value.presets),
        last: target.view,
      }));
      if (session.current === target) {
        setPresets(target.data.presets);
        setError("");
      }
    } catch {
      if (session.current === target)
        setError("筛选方案保存失败；名称限 1–40 字，最多保存 20 个方案。");
    }
  }
  return {
    presets,
    error,
    ready,
    save: (name: string) => {
      const filter = savedViewSchema.parse({
        filter: latest.current.filter,
      }).filter;
      return update((items) => [
        ...items.filter((item) => item.name !== name.trim()),
        { name: name.trim(), filter },
      ]);
    },
    remove: (name: string) =>
      update((items) => items.filter((item) => item.name !== name)),
  };
}
