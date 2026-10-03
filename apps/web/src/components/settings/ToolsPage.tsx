import { AiPanel } from "../ai/AiPanel";
import { PlanningPanel } from "../finance/PlanningPanel";
import { Button } from "@mantine/core";
import { AccountSecurityPanel } from "../auth/AccountSecurityPanel";
const DATE_KEY_LENGTH = 10;
import type { CloudController } from "../../hooks/useCloudSync";
import { useState } from "react";
import { restoreEntry, type Ledger } from "@hamster-ledger/core";
import type { LedgerController } from "../../hooks/useLedger";
import type { PageId } from "../../app-config";
import { BooksPanel } from "./BooksPanel";
import { BackupPanel } from "./BackupPanel";
import { CategoriesPanel } from "./CategoriesPanel";
import { PreferencesPanel } from "./PreferencesPanel";
import { PrivacyPanel } from "./PrivacyPanel";
import { SyncPanel } from "./SyncPanel";
import { NetworkPanel } from "./NetworkPanel";
interface Props {
  sync: CloudController;
  controller: LedgerController;
  onNavigate: (page: PageId) => void;
  onMonth: (month: string) => void;
}
export function ToolsPage({
  sync,
  controller,
  onNavigate,
  onMonth,
}: Props): React.JSX.Element {
  const [error, setError] = useState("");
  const { ledger } = controller;
  async function restore(next: Ledger): Promise<void> {
    try {
      await controller.commit(next);
      setError("");
    } catch {
      setError("恢复失败，请重试。");
    }
  }
  return (
    <section className="planning-page">
      <div className="page-heading">
        <h1>让账本更合你的习惯</h1>
        <p>管理账本、备份与同步。</p>
      </div>
      <div className="tools-shortcuts">
        {(
          [
            ["calendar", "账单日历"],
            ["budgets", "预算管理"],
            ["recurring", "周期记账"],
            ["import", "导入账单"],
            ["review", "重复核对"],
          ] as const
        ).map(([id, label]) => (
          <Button
            variant="outline"
            type="submit"
            className="secondary-button"
            key={id}
            onClick={() => onNavigate(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="settings-grid">
        <AiPanel
          key={`ai:${controller.mode}`}
          controller={controller}
          onMonth={onMonth}
        />
        <PlanningPanel key={controller.mode} controller={controller} />
        <NetworkPanel controller={controller} />
        <BooksPanel controller={controller} />
        <PreferencesPanel
          key={controller.mode}
          ledger={ledger}
          onCommit={controller.commit}
        />
        {controller.network?.isConnected ? (
          <section className="panel">
            <h2>联网账本保存</h2>
            <p>
              修改已通过联网操作接口保存到服务器。共享成员和连接状态见「家庭与联网账本」。
            </p>
          </section>
        ) : (
          <SyncPanel sync={sync} />
        )}
        <AccountSecurityPanel />
        <BackupPanel controller={controller} />
        <CategoriesPanel ledger={ledger} onCommit={controller.commit} />
        <PrivacyPanel />
        <section className="panel">
          <h2>回收站</h2>
          <p className="muted">
            删除的账单保留在本机，可随时恢复。关联流水一起恢复。
          </p>
          {ledger.records
            .filter(
              (record) => record.isDeleted && record.status !== "duplicate",
            )
            .map((record) => (
              <div className="stat-row" key={record.id}>
                <span>
                  {record.date.slice(0, DATE_KEY_LENGTH)} · {record.merchant}
                </span>
                <Button
                  variant="subtle"
                  type="submit"
                  className="text-button"
                  onClick={() => void restore(restoreEntry(ledger, record.id))}
                >
                  恢复
                </Button>
              </div>
            ))}
          {error ? (
            <p role="alert" className="error-message">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </section>
  );
}
