const LIST_PAGE_SIZE = 30;
import { DeferredPanel } from "./DeferredPanel";
import { AiPanel } from "../ai/AiPanel";
import { PlanningPanel } from "../finance/PlanningPanel";
import { Button } from "@mantine/core";
import { AccountSecurityPanel } from "../auth/AccountSecurityPanel";
const DATE_KEY_LENGTH = 10;
import type { CloudController } from "../../hooks/useCloudSync";
import { useState } from "react";
import {
  restoreEntry,
  pendingReviewCount,
  type Ledger,
} from "@hamster-ledger/core";
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
  const [section, setSection] = useState("books");
  const [trashLimit, setTrashLimit] = useState(LIST_PAGE_SIZE);
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
        <p>
          {controller.network?.isConnected
            ? "家庭联网账本：修改保存在服务器；断网时仅可查看本机缓存。"
            : sync.isLinked
              ? "个人同步账本：本机可离线编辑，页面打开时尝试自动同步；冲突时保留双方版本。"
              : "本机账本：数据保存在此浏览器，可离线编辑；尚未连接云端同步。"}
        </p>
        {!ledger.accounts.length && (
          <Button variant="outline" onClick={() => onNavigate("assets")}>
            建立首个账户与余额基准
          </Button>
        )}
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
      <section
        className="panel"
        aria-label="待处理事项"
        style={{ marginBottom: 24 }}
      >
        <h2>待处理</h2>
        <div className="button-row">
          <Button variant="outline" onClick={() => onNavigate("review")}>
            账单核对 · {pendingReviewCount(ledger)}
          </Button>
          <Button variant="outline" onClick={() => setSection("ai")}>
            AI 草稿 ·{" "}
            {ledger.aiDrafts?.filter((item) => item.state === "pending")
              .length ?? 0}
          </Button>
          {controller.canUndo ? (
            <Button variant="subtle" onClick={controller.undo}>
              撤销上一步
            </Button>
          ) : null}
        </div>
      </section>
      <nav className="tools-shortcuts" aria-label="工具分类">
        {[
          ["books", "账本管理"],
          ["ai", "AI 记账与凭证"],
          ["planning", "生活计划与提醒"],
          ["network", "家庭与联网账本"],
          ["sync", "云端同步"],
          ["backup", "备份与导出"],
          ["categories", "分类管理"],
          ["preferences", "记账偏好"],
          ["account", "账号安全"],
          ["privacy", "隐私保护"],
          ["trash", "回收站"],
        ].map(([id, title]) => (
          <Button
            key={id}
            variant={section === id ? "filled" : "outline"}
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            {title}
          </Button>
        ))}
      </nav>
      <div
        className="settings-grid"
        style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        <DeferredPanel active={section === "ai"}>
          <AiPanel
            key={`ai:${controller.mode}`}
            controller={controller}
            onMonth={onMonth}
          />
        </DeferredPanel>
        <DeferredPanel active={section === "planning"}>
          <PlanningPanel key={controller.mode} controller={controller} />
        </DeferredPanel>
        <DeferredPanel active={section === "network"}>
          <NetworkPanel controller={controller} />
        </DeferredPanel>
        <DeferredPanel active={section === "books"}>
          <BooksPanel controller={controller} />
        </DeferredPanel>
        <DeferredPanel active={section === "preferences"}>
          <PreferencesPanel
            key={controller.mode}
            ledger={ledger}
            onCommit={controller.commit}
          />
        </DeferredPanel>
        <DeferredPanel active={section === "sync"}>
          {controller.network?.isConnected ? (
            <section className="panel">
              <h2>联网账本保存</h2>
              <p>
                修改通过联网操作接口保存到服务器。共享成员和连接状态见「家庭与联网账本」。
              </p>
            </section>
          ) : (
            <SyncPanel sync={sync} />
          )}
        </DeferredPanel>
        <DeferredPanel active={section === "account"}>
          <AccountSecurityPanel />
        </DeferredPanel>
        <DeferredPanel active={section === "backup"}>
          <BackupPanel key={controller.mode} controller={controller} />
        </DeferredPanel>
        <DeferredPanel active={section === "categories"}>
          <CategoriesPanel ledger={ledger} onCommit={controller.commit} />
        </DeferredPanel>
        <DeferredPanel active={section === "privacy"}>
          <PrivacyPanel />
        </DeferredPanel>
        <DeferredPanel active={section === "trash"}>
          <section className="panel">
            <h2>回收站</h2>
            <p className="muted">
              删除的账单保留在本机，可随时恢复。关联流水一起恢复。
            </p>
            {ledger.records
              .filter(
                (record) => record.isDeleted && record.status !== "duplicate",
              )
              .slice(0, trashLimit)
              .map((record) => (
                <div className="stat-row" key={record.id}>
                  <span>
                    {record.date.slice(0, DATE_KEY_LENGTH)} · {record.merchant}
                  </span>
                  <Button
                    variant="subtle"
                    type="submit"
                    className="text-button"
                    onClick={() =>
                      void restore(restoreEntry(ledger, record.id))
                    }
                  >
                    恢复
                  </Button>
                </div>
              ))}
            {ledger.records.filter(
              (record) => record.isDeleted && record.status !== "duplicate",
            ).length > trashLimit && (
              <Button
                variant="outline"
                onClick={() => setTrashLimit((count) => count + LIST_PAGE_SIZE)}
              >
                加载更多已删除账单
              </Button>
            )}
            {error ? (
              <p role="alert" className="error-message">
                {error}
              </p>
            ) : null}
          </section>
        </DeferredPanel>
      </div>
    </section>
  );
}
