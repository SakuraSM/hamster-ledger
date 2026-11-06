import type { CloudController } from "../hooks/useCloudSync";
import { Button } from "@mantine/core";
import { useMemo } from "react";
import type { PageId } from "../app-config";
import type { LedgerController } from "../hooks/useLedger";
import { localNow, newEntityId } from "../platform/browser/runtime";
import { createDemoAccounts } from "../data/demo-accounts";
import {
  periodRecords,
  pendingReviewCount,
  saveAssetAccount,
  archiveAssetAccount,
  type BillRecord,
  type Category,
  type Ledger,
} from "@hamster-ledger/core";
import { AssetsPage } from "./assets/AssetsPage";
import { isSameAssetBook, type AssetBookContext } from "./assets/AccountEditor";
import { InboxWorkspace } from "./InboxWorkspace";
import { AssetSnapshot } from "./assets/AssetSnapshot";
import { Overview } from "./Overview";
import { Transactions, type BillFilter } from "./Transactions";
import { ImportPage } from "./ImportPage";
import { ReviewPage } from "./ReviewPage";
import { CalendarPage } from "./planning/CalendarPage";
import { BudgetPage } from "./planning/BudgetPage";
import { ReportsPage } from "./planning/ReportsPage";
import { RecurringPage } from "./planning/RecurringPage";
import { ToolsPage } from "./settings/ToolsPage";
interface Props {
  sync: CloudController;
  controller: LedgerController;
  page: PageId;
  month: string;
  recordMonth: string;
  onRecordMonth: (month: string) => void;
  filter: BillFilter;
  onFilter: (filter: BillFilter) => void;
  onMonth: (month: string) => void;
  onNavigate: (page: PageId) => void;
  onSelect: (record: BillRecord) => void;
  onReimburse?: (record: BillRecord) => void;
  onPreview: (record: BillRecord) => void;
  onCategory: (category: Category) => void;
  onUnassigned: () => void;
  onImport: (ledger: Ledger) => Promise<void>;
  onAdd: (date?: string) => void;
}
export function AppPages(props: Props): React.JSX.Element {
  const {
    sync,
    controller,
    page,
    month,
    recordMonth,
    onRecordMonth,
    filter,
    onFilter,
    onMonth,
    onNavigate,
    onSelect,
    onReimburse,
    onPreview,
    onCategory,
    onUnassigned,
    onImport,
    onAdd,
  } = props;
  const { ledger, mode } = controller;
  const transactionRecords = useMemo(
    () => (recordMonth ? periodRecords(ledger, recordMonth) : ledger.records),
    [ledger, recordMonth],
  );
  const pending = pendingReviewCount(ledger);
  const personalBook = controller.books.find((book) => book.id === "personal");
  const needsImportBook =
    mode === "demo" &&
    (!personalBook || personalBook.isArchived || Boolean(personalBook.cloud));
  const cloud = controller.books.find((book) => book.id === mode)?.cloud;
  const bookContext: AssetBookContext = {
    mode,
    cloud: cloud
      ? { id: cloud.id, userId: cloud.userId, server: cloud.server }
      : null,
    isNetwork: Boolean(controller.network?.isConnected),
    revision: controller.network?.revision,
  };
  function commitAsset(next: Ledger, guard?: AssetBookContext): Promise<void> {
    if (
      guard &&
      (!isSameAssetBook(guard, bookContext) ||
        guard.revision !== bookContext.revision)
    )
      return Promise.reject(new Error("账本已变化，请重新核对后再确认。"));
    const snapshot = guard ?? bookContext;
    if (snapshot.isNetwork || snapshot.cloud) {
      if (
        !snapshot.isNetwork ||
        !snapshot.cloud ||
        snapshot.revision === undefined
      )
        return Promise.reject(
          new Error("联网账本身份或版本不可用，请刷新后重试。"),
        );
      return controller.commit(next, {
        mode: snapshot.mode,
        expectedRevision: snapshot.revision,
        expectedCloud: snapshot.cloud,
      });
    }
    return controller.commit(next);
  }
  const pages: Record<PageId, () => React.JSX.Element> = {
    inbox: () => (
      <InboxWorkspace
        key={mode}
        controller={controller}
        month={month}
        onMonth={onMonth}
        onReview={() => onNavigate("review")}
        onImport={() => onNavigate("import")}
        onLater={() => onNavigate("overview")}
      />
    ),
    overview: () => (
      <>
        <AssetSnapshot ledger={ledger} onOpen={() => onNavigate("assets")} />
        <Overview
          accounts={ledger.accounts}
          records={periodRecords(ledger, month).filter(
            (record) => record.status === "confirmed",
          )}
          month={month}
          isDemo={mode === "demo"}
          hideAmounts={ledger.preferences?.hideAmounts ?? false}
          cycleStartDay={ledger.preferences?.cycleStartDay ?? 1}
          pending={pending}
          onReview={() => onNavigate("review")}
          onAll={() => onNavigate("transactions")}
          onCategory={onCategory}
          onSelect={onSelect}
          onImport={() => onNavigate("import")}
        />
      </>
    ),
    transactions: () => (
      <Transactions
        key={mode}
        controller={controller}
        records={transactionRecords}
        onClearPeriod={() => onRecordMonth("")}
        filter={filter}
        accounts={ledger.accounts}
        onFilter={onFilter}
        onSelect={onSelect}
      />
    ),
    assets: () => (
      <AssetsPage
        key={mode}
        onCommit={commitAsset}
        bookContext={bookContext}
        canUndo={controller.canUndo}
        onUndo={controller.undo}
        ledger={ledger}
        isDemo={mode === "demo"}
        onSave={async (input) => {
          if (
            input.expectedBook &&
            !isSameAssetBook(input.expectedBook, bookContext)
          )
            throw new Error("账本或绑定身份已变化，请重新打开后重试。");
          await commitAsset(
            saveAssetAccount({
              ledger,
              account: input.account,
              now: localNow(),
              checkpointId: newEntityId(),
              note: input.note,
              expectedAccount: input.expectedAccount,
            }),
            input.previewGuard,
          );
          controller.notify("账户已保存。");
        }}
        onArchive={async (input) => {
          await commitAsset(
            archiveAssetAccount({ ledger, ...input, at: localNow() }),
          );
        }}
        onRecord={onSelect}
        onLoadExamples={() =>
          commitAsset({ ...ledger, accounts: createDemoAccounts() })
        }
        onUnassigned={onUnassigned}
      />
    ),
    import: () =>
      needsImportBook ? (
        <section className="import-page">
          <div className="page-heading">
            <h1>账单放进来，收支理清楚</h1>
            <p>当前不能从示例账本导入，请先在账本管理中切换到可用账本。</p>
          </div>
          <Button onClick={() => onNavigate("tools")}>进入账本管理</Button>
        </section>
      ) : (
        <ImportPage
          targetBookName={
            controller.books.find(
              (book) => book.id === (mode === "demo" ? "personal" : mode),
            )?.name ?? "我的账本"
          }
          targetLedger={mode === "demo" ? controller.personalLedger : ledger}
          onCommit={onImport}
          onReview={() => onNavigate("review")}
          onAll={() => onNavigate("transactions")}
          onSelect={onPreview}
        />
      ),
    review: () => (
      <ReviewPage key={mode} controller={controller} onSelect={onSelect} />
    ),
    calendar: () => (
      <CalendarPage
        ledger={ledger}
        month={month}
        onMonth={onMonth}
        onSelect={onSelect}
        onAdd={onAdd}
      />
    ),
    budgets: () => (
      <BudgetPage
        ledger={ledger}
        month={month}
        onMonth={onMonth}
        onCommit={controller.commit}
      />
    ),
    reports: () => (
      <ReportsPage
        key={mode}
        ledger={ledger}
        month={month}
        onRecord={onSelect}
        onReimburse={onReimburse}
        bookId={controller.books.find((book) => book.id === mode)?.cloud?.id}
      />
    ),
    recurring: () => (
      <RecurringPage ledger={ledger} onCommit={controller.commit} />
    ),
    tools: () => (
      <ToolsPage
        sync={sync}
        controller={controller}
        onNavigate={onNavigate}
        onMonth={onMonth}
      />
    ),
  };
  return pages[page]();
}
