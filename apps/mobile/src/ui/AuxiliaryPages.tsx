import type { BillRecord } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import type { NativeSyncController } from "../hooks/useNativeSync";
import { OverviewScreen } from "../screens/OverviewScreen";
import { ReportsScreen } from "../screens/ReportsScreen";
import { ToolPage } from "../screens/ToolPage";
import {
  ToolsScreen,
  TOOLS,
  type ToolPage as ToolPageName,
} from "../screens/ToolsScreen";

export type AppTool =
  ToolPageName | "tools-home" | "overview-home" | "reports-home";
interface AuxiliaryPagesProps {
  tool: AppTool;
  controller: LedgerController;
  sync: NativeSyncController;
  month: string;
  onMonth: (month: string) => void;
  onRecord: (record: BillRecord) => void;
  onReimburse?: (record: BillRecord) => void;
  onReview: () => void;
  onAssets: () => void;
  onAdd: (date: string) => void;
  onOpen: (tool: AppTool) => void;
}
export function auxiliaryPageTitle(tool: AppTool): string {
  if (tool === "overview-home") return "收支总览";
  if (tool === "reports-home") return "收支报表";
  if (tool === "tools-home") return "工具与设置";
  return TOOLS.find((item) => item.key === tool)?.title ?? "更多功能";
}
export function AuxiliaryPages({
  tool,
  controller,
  sync,
  month,
  onMonth,
  onRecord,
  onReimburse,
  onReview,
  onAssets,
  onAdd,
  onOpen,
}: AuxiliaryPagesProps): React.JSX.Element {
  if (tool === "tools-home")
    return (
      <ToolsScreen
        onSelect={onOpen}
        ledger={controller.ledger}
        onAssets={onAssets}
        onOverview={() => onOpen("overview-home")}
        onReports={() => onOpen("reports-home")}
        storageDescription={
          controller.network?.isConnected
            ? "家庭联网账本：修改保存在服务器；断网时仅可查看本机缓存。"
            : sync.link
              ? "个人同步账本：本机可离线编辑，应用在前台时尝试自动同步；冲突时保留双方版本。"
              : "本机账本：数据保存在此设备，可离线编辑；尚未连接云端同步。"
        }
      />
    );
  if (tool === "overview-home")
    return (
      <OverviewScreen
        ledger={controller.ledger}
        month={month}
        onMonth={onMonth}
        isDemo={controller.mode === "demo"}
        onRecord={onRecord}
        onReview={onReview}
        onAssets={onAssets}
      />
    );
  if (tool === "reports-home")
    return (
      <ReportsScreen
        key={controller.mode}
        ledger={controller.ledger}
        month={month}
        onRecord={onRecord}
        onReimburse={onReimburse}
        bookId={
          controller.books.find((book) => book.id === controller.mode)?.cloud
            ?.id
        }
      />
    );
  return (
    <ToolPage
      key={`${controller.mode}:${tool}`}
      page={tool}
      sync={sync}
      controller={controller}
      onRecord={onRecord}
      onAdd={onAdd}
      onReview={onReview}
    />
  );
}
