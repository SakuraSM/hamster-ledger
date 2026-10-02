import type { CloudController } from "../hooks/useCloudSync";
import type { PageId } from "../app-config";
import type { LedgerController } from "../hooks/useLedger";
import { localNow, newEntityId } from "../platform/browser/runtime";
import { createDemoAccounts } from "../data/demo-accounts";
import {
  periodRecords,
  saveAssetAccount,
  archiveAssetAccount,
  type BillRecord,
  type Category,
  type Ledger,
} from "@hamster-ledger/core";
import { AssetsPage } from "./assets/AssetsPage";
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
  filter: BillFilter;
  onFilter: (filter: BillFilter) => void;
  onMonth: (month: string) => void;
  onNavigate: (page: PageId) => void;
  onSelect: (record: BillRecord) => void;
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
    filter,
    onFilter,
    onMonth,
    onNavigate,
    onSelect,
    onPreview,
    onCategory,
    onUnassigned,
    onImport,
    onAdd,
  } = props;
  const { ledger, mode } = controller;
  const pending = ledger.reviews.filter(
    (review) => review.state === "pending",
  ).length;
  const pages: Record<PageId, () => React.JSX.Element> = {
    overview: () => (
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
    ),
    transactions: () => (
      <Transactions
        records={
          recordMonth ? periodRecords(ledger, recordMonth) : ledger.records
        }
        filter={filter}
        accounts={ledger.accounts}
        onFilter={onFilter}
        onSelect={onSelect}
      />
    ),
    assets: () => (
      <AssetsPage
        ledger={ledger}
        isDemo={mode === "demo"}
        onSave={async (input) => {
          await controller.commit(
            saveAssetAccount({
              ledger,
              account: input.account,
              now: localNow(),
              checkpointId: newEntityId(),
              note: input.note,
            }),
          );
          controller.notify("账户已保存。");
        }}
        onArchive={async (input) => {
          await controller.commit(archiveAssetAccount({ ledger, ...input }));
        }}
        onRecord={onSelect}
        onLoadExamples={() =>
          controller.commit({ ...ledger, accounts: createDemoAccounts() })
        }
        onUnassigned={onUnassigned}
      />
    ),
    import: () => (
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
      <ReviewPage
        ledger={ledger}
        onDecide={controller.decide}
        onSelect={onSelect}
        canUndo={controller.canUndo}
        onUndo={controller.undo}
      />
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
    reports: () => <ReportsPage key={mode} ledger={ledger} month={month} />,
    recurring: () => (
      <RecurringPage ledger={ledger} onCommit={controller.commit} />
    ),
    tools: () => (
      <ToolsPage sync={sync} controller={controller} onNavigate={onNavigate} />
    ),
  };
  return pages[page]();
}
