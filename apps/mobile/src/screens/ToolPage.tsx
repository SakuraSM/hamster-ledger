import type { LedgerController } from "@hamster-ledger/ledger-react";
import type { BillRecord } from "@hamster-ledger/core";
import type { ToolPage as ToolPageName } from "./ToolsScreen";
import { BooksScreen } from "./BooksScreen";
import { ImportScreen } from "./ImportScreen";
import { ReviewScreen } from "./ReviewScreen";
import { BudgetScreen } from "./BudgetScreen";
import { CalendarScreen } from "./CalendarScreen";
import { RecurringScreen } from "./RecurringScreen";
import { CategoriesScreen } from "./CategoriesScreen";
import { BackupScreen } from "./BackupScreen";
import { PreferencesScreen } from "./PreferencesScreen";
import { AccountScreen } from "./AccountScreen";
import { SyncScreen } from "./SyncScreen";
interface ToolPageProps {
  page: ToolPageName;
  controller: LedgerController;
  onRecord: (record: BillRecord) => void;
  onAdd: (date: string) => void;
  onReview: () => void;
}
export function ToolPage({
  page,
  controller,
  onRecord,
  onAdd,
  onReview,
}: ToolPageProps): React.JSX.Element {
  const pages: Record<ToolPageName, React.JSX.Element> = {
    account: <AccountScreen />,
    sync: <SyncScreen controller={controller} />,
    books: <BooksScreen controller={controller} />,
    import: <ImportScreen controller={controller} onReview={onReview} />,
    review: <ReviewScreen controller={controller} onRecord={onRecord} />,
    calendar: (
      <CalendarScreen
        ledger={controller.ledger}
        onRecord={onRecord}
        onAdd={onAdd}
      />
    ),
    budgets: <BudgetScreen controller={controller} />,
    recurring: <RecurringScreen controller={controller} />,
    categories: <CategoriesScreen controller={controller} />,
    backup: <BackupScreen controller={controller} />,
    preferences: <PreferencesScreen controller={controller} />,
  };
  return pages[page];
}
