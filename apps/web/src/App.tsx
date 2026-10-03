import { RecordAttachments } from "./components/ai/RecordAttachments";
import { Button } from "@mantine/core";
import { LedgerNotice } from "./ui/LedgerNotice";
import { useAuth } from "./auth/auth-context";
import { loginPath, navigateAuth } from "./platform/browser/auth-navigation";
import { useCloudSync } from "./hooks/useCloudSync";
import { AppPages } from "./components/AppPages";
import { EntryEditor } from "./components/EntryEditor";
import { usePreferences } from "./hooks/usePreferences";
import { AppHeader } from "./components/AppHeader";
import { DEFAULT_MONTH, type PageId } from "./app-config";
const MONTH_KEY_LENGTH = 7;
import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { type BillFilter } from "./components/Transactions";
import { RecordDetail } from "./components/RecordDetail";
import { Dialog } from "./components/Dialog";
import { useLedger } from "./hooks/useLedger";
import { useNetworkController } from "./hooks/useNetworkController";
import {
  type Source,
  type Category,
  type BillRecord,
  type Ledger,
  UNASSIGNED_ACCOUNT_FILTER,
  saveEntry,
  cycleMonthForDate,
  deleteEntry,
} from "@hamster-ledger/core";

export function App(): React.JSX.Element {
  const auth = useAuth();
  const local = useLedger();
  const controller = useNetworkController(local);
  const { ledger, mode } = controller;
  const sync = useCloudSync(controller);
  const [page, setPage] = useState<PageId>(() =>
    new URLSearchParams(location.search).get("page") === "tools"
      ? "tools"
      : "overview",
  );
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [recordMonth, setRecordMonth] = useState(DEFAULT_MONTH);
  useEffect(() => {
    const selected =
      mode === "demo"
        ? DEFAULT_MONTH
        : new Date().toLocaleDateString("sv-SE").slice(0, MONTH_KEY_LENGTH);
    setMonth(selected);
    setRecordMonth(selected);
  }, [mode]);
  const [filter, setFilter] = useState<BillFilter>({
    source: "",
    category: "",
  });
  const [selected, setSelected] = useState<BillRecord | null>(null);
  const [editor, setEditor] = useState<{
    record?: BillRecord;
    date?: string;
    revision?: number;
  } | null>(() =>
    new URLSearchParams(window.location.search).get("action") === "add"
      ? {}
      : null,
  );
  usePreferences({ ledger, mode, notify: controller.notify });
  const [previewRecord, setPreviewRecord] = useState<BillRecord | null>(null);
  const pending = ledger.reviews.filter(
    (review) => review.state === "pending",
  ).length;
  const months = [
    ...new Set([
      DEFAULT_MONTH,
      new Date().toLocaleDateString("sv-SE").slice(0, MONTH_KEY_LENGTH),
      ...ledger.records.map((record) =>
        cycleMonthForDate(record.date, ledger.preferences?.cycleStartDay ?? 1),
      ),
      ...ledger.records.map((record) => record.date.slice(0, MONTH_KEY_LENGTH)),
    ]),
  ]
    .sort()
    .reverse();
  function navigate(next: PageId): void {
    if (next === "transactions") setRecordMonth(month);
    setPage(next);
    setFilter({ source: "", category: "" });
    window.scrollTo({ top: 0 });
  }
  function showSource(source: Source): void {
    setRecordMonth(month);
    setFilter({ source, category: "" });
    setPage("transactions");
  }
  function showCategory(category: Category): void {
    setRecordMonth(month);
    setFilter({ source: "", category });
    setPage("transactions");
  }
  async function commitImported(next: Ledger): Promise<void> {
    await controller.commit(next, mode === "demo" ? "personal" : mode);
    const latest = [...next.records].sort((left, right) =>
      right.date.localeCompare(left.date),
    )[0];
    if (latest)
      setMonth(
        cycleMonthForDate(latest.date, next.preferences?.cycleStartDay ?? 1),
      );
  }
  if (controller.isLoading)
    return (
      <main className="loading-state" aria-busy={!controller.error}>
        <img src="/assets/hamster-logo.png" alt="" width="56" />
        <h1>仓鼠记账</h1>
        <p role={controller.error ? "alert" : "status"}>
          {controller.error || "正在打开本地账本…"}
        </p>
      </main>
    );
  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <Sidebar
        isNetwork={controller.network?.isConnected}
        bookName={
          controller.books.find((book) => book.id === mode)?.name ?? "我的账本"
        }
        page={page}
        pending={pending}
        mode={mode}
        onNavigate={navigate}
        onSource={showSource}
        onSettings={() => navigate("tools")}
      />
      <main id="main-content" className="main-content" tabIndex={-1}>
        <AppHeader
          page={page}
          mode={mode}
          months={months}
          month={page === "transactions" ? recordMonth : month}
          onMonth={page === "transactions" ? setRecordMonth : setMonth}
          onSettings={() => navigate("tools")}
          bookName={
            controller.books.find((book) => book.id === mode)?.name ?? "账本"
          }
          onAdd={() => setEditor({})}
          onImport={() => navigate("import")}
        />
        {!auth.user && !auth.isLocalOnly && auth.error ? (
          <div className="auth-session-notice" role="status">
            <span>{auth.error}</span>
            <Button
              variant="subtle"
              type="button"
              className="text-button"
              onClick={() => navigateAuth(loginPath())}
            >
              重新登录
            </Button>
          </div>
        ) : null}
        {controller.error ? (
          <p className="error-message" role="alert">
            {controller.error}
          </p>
        ) : null}
        <AppPages
          sync={sync}
          controller={controller}
          page={page}
          month={month}
          recordMonth={recordMonth}
          filter={filter}
          onFilter={setFilter}
          onMonth={setMonth}
          onNavigate={navigate}
          onSelect={setSelected}
          onPreview={setPreviewRecord}
          onCategory={showCategory}
          onUnassigned={() => {
            setRecordMonth("");
            setFilter({
              source: "",
              category: "",
              accountId: UNASSIGNED_ACCOUNT_FILTER,
            });
            setPage("transactions");
          }}
          onImport={commitImported}
          onAdd={(date) => setEditor({ date })}
        />
      </main>
      {selected ? (
        <RecordDetail
          attachmentPanel={
            <RecordAttachments controller={controller} recordId={selected.id} />
          }
          bookId={
            controller.books.find((book) => book.id === controller.mode)?.cloud
              ?.id
          }
          key={selected.id}
          ledger={ledger}
          onRelated={setSelected}
          record={selected}
          onClose={() => setSelected(null)}
          onSave={controller.editRecord}
          onEdit={() => {
            setEditor({ record: selected });
            setSelected(null);
          }}
          onDelete={async () => {
            await controller.commit(deleteEntry(ledger, selected.id));
            setSelected(null);
            controller.notify("账单已移入回收站，关联流水一同保留。");
          }}
        />
      ) : null}
      {editor ? (
        <EntryEditor
          bookId={
            controller.books.find((book) => book.id === controller.mode)?.cloud
              ?.id
          }
          onCommit={async (next, date) => {
            await controller.commit(next);
            setMonth(
              cycleMonthForDate(date, ledger.preferences?.cycleStartDay ?? 1),
            );
            controller.notify("账单已保存。");
          }}
          key={editor.revision ?? 0}
          onReload={() => {
            const latest = ledger.records.find(
              (record) => record.id === editor.record?.id && !record.isDeleted,
            );
            if (!latest) {
              setEditor(null);
              controller.notify("账单已被删除，请从回收站查看。");
              return;
            }
            setEditor({ record: latest, revision: (editor.revision ?? 0) + 1 });
          }}
          ledger={ledger}
          record={editor.record}
          date={editor.date}
          onClose={() => setEditor(null)}
          onSave={async (input) => {
            await controller.commit(saveEntry(ledger, input));
            setMonth(
              cycleMonthForDate(
                input.date,
                ledger.preferences?.cycleStartDay ?? 1,
              ),
            );
            controller.notify("账单已保存。");
          }}
        />
      ) : null}
      {previewRecord ? (
        <Dialog
          title="导入预览 · 原始字段"
          onClose={() => setPreviewRecord(null)}
        >
          <dl className="raw-preview">
            {Object.entries(previewRecord.raw).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="muted">导入完成后可编辑分类与账户。</p>
        </Dialog>
      ) : null}
      <LedgerNotice
        message={controller.notice}
        canUndo={controller.canUndo}
        onUndo={controller.undo}
        onDismiss={controller.dismissNotice}
      />
    </>
  );
}
