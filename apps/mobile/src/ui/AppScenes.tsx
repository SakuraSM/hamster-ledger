import type { BillRecord } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { AssetsScreen } from "../screens/AssetsScreen";
import { PendingScreen } from "../screens/PendingScreen";
import { TransactionsScreen } from "../screens/TransactionsScreen";
import type { AppTool } from "./AuxiliaryPages";

export function AppScenes({
  route,
  controller,
  onRecord,
  onReview,
  onOpen,
}: {
  route: { key: string };
  controller: LedgerController;
  onRecord: (record: BillRecord) => void;
  onReview: () => void;
  onOpen: (tool: AppTool) => void;
}): React.JSX.Element {
  const pages: Record<string, React.JSX.Element> = {
    overview: (
      <PendingScreen
        ledger={controller.ledger}
        onReview={onReview}
        onAi={() => onOpen("ai")}
        onPayment={() => onOpen("payment-inbox")}
        onImport={() => onOpen("import")}
        onLater={() => onOpen("overview-home")}
      />
    ),
    records: (
      <TransactionsScreen
        key={controller.mode}
        controller={controller}
        onRecord={onRecord}
      />
    ),
    assets: (
      <AssetsScreen
        key={controller.mode}
        controller={controller}
        onRecord={onRecord}
      />
    ),
  };
  return pages[route.key];
}
