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
interface Props {
  sync: CloudController;
  controller: LedgerController;
  onNavigate: (page: PageId) => void;
}
export function ToolsPage({
  sync,
  controller,
  onNavigate,
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
          <button
            className="secondary-button"
            key={id}
            onClick={() => onNavigate(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="settings-grid">
        <BooksPanel controller={controller} />
        <PreferencesPanel
          key={controller.mode}
          ledger={ledger}
          onCommit={controller.commit}
        />
        <SyncPanel sync={sync} />
        <AccountSecurityPanel />
        <BackupPanel
          ledger={ledger}
          name={
            controller.books.find((book) => book.id === controller.mode)
              ?.name ?? "账本"
          }
          onRestore={controller.createBook}
        />
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
                <button
                  className="text-button"
                  onClick={() => void restore(restoreEntry(ledger, record.id))}
                >
                  恢复
                </button>
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
