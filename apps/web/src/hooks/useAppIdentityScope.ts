import { useState } from "react";
import type { BillRecord } from "@hamster-ledger/core";
import type {
  EntryDraft,
  LedgerController,
} from "@hamster-ledger/ledger-react";
import type { BillFilter } from "../components/Transactions";

interface EditorState {
  record?: BillRecord;
  date?: string;
  revision?: number;
  initialDraft?: Partial<EntryDraft>;
}
interface IdentityState {
  identity: string;
  generation: number;
  hasLoadedIdentity: boolean;
  selected: BillRecord | null;
  editor: EditorState | null;
  previewRecord: BillRecord | null;
  filter: BillFilter;
}
interface AppIdentityScopeInput {
  controller: Pick<LedgerController, "mode" | "books" | "isLoading">;
  userId: string | null;
}
interface AppIdentityScope {
  identity: string;
  selected: BillRecord | null;
  editor: EditorState | null;
  previewRecord: BillRecord | null;
  filter: BillFilter;
  setSelected: (record: BillRecord | null) => void;
  setEditor: (value: EditorState | null) => void;
  setPreviewRecord: (record: BillRecord | null) => void;
  setFilter: (value: BillFilter) => void;
}
export function useAppIdentityScope({
  controller,
  userId,
}: AppIdentityScopeInput): AppIdentityScope {
  const { mode, books, isLoading } = controller;
  const cloud = books.find((book) => book.id === mode)?.cloud;
  const identity = JSON.stringify([
    mode,
    userId,
    cloud?.id ?? null,
    cloud?.userId ?? null,
    cloud?.server ?? null,
  ]);
  const [scope, setScope] = useState<IdentityState>(() => ({
    identity,
    generation: 0,
    hasLoadedIdentity: !isLoading,
    filter: { source: "", category: "" },
    selected: null,
    editor:
      new URLSearchParams(window.location.search).get("action") === "add"
        ? {}
        : null,
    previewRecord: null,
  }));
  const isCurrentIdentity =
    !scope.hasLoadedIdentity || scope.identity === identity;
  if (!scope.hasLoadedIdentity && !isLoading)
    setScope({ ...scope, identity, hasLoadedIdentity: true });
  else if (!isCurrentIdentity)
    setScope({
      identity,
      generation: scope.generation + 1,
      hasLoadedIdentity: true,
      filter: { source: "", category: "" },
      selected: null,
      editor: null,
      previewRecord: null,
    });
  function updateScope<
    Key extends "selected" | "editor" | "previewRecord" | "filter",
  >(key: Key, value: IdentityState[Key]): void {
    setScope((current) =>
      current.identity === identity && current.generation === scope.generation
        ? { ...current, [key]: value }
        : current,
    );
  }
  return {
    identity,
    selected: isCurrentIdentity ? scope.selected : null,
    editor: isCurrentIdentity ? scope.editor : null,
    previewRecord: isCurrentIdentity ? scope.previewRecord : null,
    filter: isCurrentIdentity ? scope.filter : { source: "", category: "" },
    setSelected: (record) => updateScope("selected", record),
    setEditor: (value) => updateScope("editor", value),
    setPreviewRecord: (record) => updateScope("previewRecord", record),
    setFilter: (value) => updateScope("filter", value),
  };
}
