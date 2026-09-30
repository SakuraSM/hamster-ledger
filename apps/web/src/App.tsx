import { DEFAULT_MONTH, type PageId } from "./app-config";
const MONTH_KEY_LENGTH = 7;
const YEAR_LENGTH = 4;
const MONTH_START = 5;
import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Overview } from "./components/Overview";
import { Transactions, type BillFilter } from "./components/Transactions";
import { ReviewPage } from "./components/ReviewPage";
import { ImportPage } from "./components/ImportPage";
import { RecordDetail } from "./components/RecordDetail";
import { LedgerSettings } from "./components/LedgerSettings";
import { Icons } from "./components/Icons";
import { Dialog } from "./components/Dialog";
import { useLedger } from "./hooks/useLedger";
import {
  type Source,
  type Category,
  type BillRecord,
  type Ledger,
  confirmedForMonth,
} from "@hamster-ledger/core";

const PAGE_LABELS: Record<PageId, string> = {
  overview: "总览",
  transactions: "全部账单",
  import: "导入账单",
  review: "重复核对",
};
export function App(): React.JSX.Element {
  const controller = useLedger();
  const { ledger, mode } = controller;
  const [page, setPage] = useState<PageId>("overview");
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [filter, setFilter] = useState<BillFilter>({
    source: "",
    category: "",
  });
  const [selected, setSelected] = useState<BillRecord | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<BillRecord | null>(null);
  const pending = ledger.reviews.filter(
    (review) => review.state === "pending",
  ).length;
  const months = [
    ...new Set([
      DEFAULT_MONTH,
      ...ledger.records.map((record) => record.date.slice(0, MONTH_KEY_LENGTH)),
    ]),
  ]
    .sort()
    .reverse();
  const monthRecords = ledger.records.filter((record) =>
    record.date.startsWith(month),
  );
  function navigate(next: PageId): void {
    setPage(next);
    setFilter({ source: "", category: "" });
    window.scrollTo({ top: 0 });
  }
  function showSource(source: Source): void {
    setFilter({ source, category: "" });
    setPage("transactions");
  }
  function showCategory(category: Category): void {
    setFilter({ source: "", category });
    setPage("transactions");
  }
  async function commitImported(next: Ledger): Promise<void> {
    await controller.commit(next, "personal");
    const latest = [...next.records].sort((left, right) =>
      right.date.localeCompare(left.date),
    )[0];
    if (latest) setMonth(latest.date.slice(0, MONTH_KEY_LENGTH));
  }
  const content: Record<PageId, () => React.JSX.Element> = {
    overview: () => (
      <Overview
        records={confirmedForMonth(ledger, month)}
        month={month}
        isDemo={mode === "demo"}
        pending={pending}
        onReview={() => navigate("review")}
        onAll={() => navigate("transactions")}
        onCategory={showCategory}
        onSelect={setSelected}
        onImport={() => navigate("import")}
      />
    ),
    transactions: () => (
      <Transactions
        records={monthRecords}
        filter={filter}
        onFilter={setFilter}
        onSelect={setSelected}
      />
    ),
    review: () => (
      <ReviewPage
        ledger={ledger}
        onDecide={controller.decide}
        onSelect={setSelected}
        canUndo={controller.canUndo}
        onUndo={controller.undo}
      />
    ),
    import: () => (
      <ImportPage
        personalLedger={controller.personalLedger}
        onCommit={commitImported}
        onReview={() => navigate("review")}
        onAll={() => navigate("transactions")}
        onSelect={setPreviewRecord}
      />
    ),
  };
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
        page={page}
        pending={pending}
        mode={mode}
        onNavigate={navigate}
        onSource={showSource}
        onSettings={() => setIsSettingsOpen(true)}
      />
      <main id="main-content" className="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              aria-label="切换账本"
              onClick={() => setIsSettingsOpen(true)}
            >
              {mode === "demo" ? "个人账本" : "我的账本"}
            </button>
            <span>/</span>
            <strong>{PAGE_LABELS[page]}</strong>
          </div>
          <div className="top-actions">
            {page === "overview" || page === "transactions" ? (
              <label className="month-picker">
                <Icons.Calendar size={20} />
                <select
                  aria-label="月份"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                >
                  {months.map((item) => (
                    <option key={item} value={item}>
                      {item.slice(0, YEAR_LENGTH)}年
                      {Number(item.slice(MONTH_START))}月
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="mode-label">
                {mode === "demo" ? "示例数据" : "我的账本"}
              </span>
            )}
            {page !== "import" ? (
              <button
                className="primary-button"
                onClick={() => navigate("import")}
              >
                <Icons.Upload size={20} />
                <span>导入账单</span>
              </button>
            ) : null}
          </div>
        </header>
        {controller.error ? (
          <p className="error-message" role="alert">
            {controller.error}
          </p>
        ) : null}
        {content[page]()}
      </main>
      {selected ? (
        <RecordDetail
          record={selected}
          onClose={() => setSelected(null)}
          onSave={controller.editRecord}
        />
      ) : null}
      {isSettingsOpen ? (
        <LedgerSettings
          mode={mode}
          ledger={ledger}
          onSwitch={controller.switchMode}
          onClose={() => setIsSettingsOpen(false)}
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
      {controller.notice ? (
        <div className="toast" role="status">
          <Icons.Check size={21} />
          <span>{controller.notice}</span>
          {controller.canUndo ? (
            <button onClick={controller.undo}>撤销</button>
          ) : null}
          <button
            aria-label="关闭提示"
            className="icon-button"
            onClick={controller.dismissNotice}
          >
            <Icons.Close size={18} />
          </button>
        </div>
      ) : null}
    </>
  );
}
