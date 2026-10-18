const DATE_KEY_LENGTH = 10;
import { useAssetSummary } from "@hamster-ledger/ledger-react";
import { useNetworkClient } from "../../hooks/useNetworkController";
import { DateField } from "../../ui/DateField";
import { ValuationRates } from "./ValuationRates";
import { UnstyledButton, Button, Checkbox, TextInput } from "@mantine/core";
import { useState } from "react";
import {
  projectAccountBalance,
  resolveAssetAccount,
  type AssetAccount,
  type Ledger,
  type BillRecord,
} from "@hamster-ledger/core";
import { localNow } from "../../platform/browser/runtime";
import { AccountEditor, type AccountSave } from "./AccountEditor";
import { AccountGroup } from "./AccountGroup";
import { AccountDetail } from "./AccountDetail";
import { BalanceCalibration } from "./BalanceCalibration";
import { AssetTotals } from "./AssetTotals";
import { AssetTrend } from "./AssetTrend";
import { AdvancedEntryEditor } from "../finance/AdvancedEntryEditor";
import type { EntryDraft } from "@hamster-ledger/ledger-react";
import { Icons } from "../Icons";
interface AssetsPageProps {
  ledger: Ledger;
  isDemo: boolean;
  onSave: (input: AccountSave) => Promise<void>;
  onArchive: (input: {
    accountId: string;
    isArchived: boolean;
  }) => Promise<void>;
  onRecord: (record: BillRecord) => void;
  onUnassigned: () => void;
  onLoadExamples: () => Promise<void>;
  onCommit: (ledger: Ledger) => Promise<void>;
  canUndo?: boolean;
  onUndo?: () => void;
}
export function AssetsPage({
  ledger,
  isDemo,
  onSave,
  onArchive,
  onRecord,
  onUnassigned,
  onLoadExamples,
  onCommit,
  canUndo = false,
  onUndo,
}: AssetsPageProps): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    account?: AssetAccount;
    isCalibration?: boolean;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [transfer, setTransfer] = useState<Partial<EntryDraft> | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [actionError, setActionError] = useState("");
  async function loadExamples(): Promise<void> {
    try {
      await onLoadExamples();
      setActionError("");
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "示例账户载入失败。",
      );
    }
  }
  const [valuationDate, setValuationDate] = useState(
    localNow().slice(0, DATE_KEY_LENGTH),
  );
  const through = valuationDate + " 23:59:59";
  const currencies = ledger.accounts
    .filter((account) => !account.isArchived)
    .map((account) => account.currency ?? "CNY");
  const { rates, totals, comparison } = useAssetSummary({
    ledger,
    date: valuationDate,
    client: useNetworkClient(),
  });
  const selected = ledger.accounts.find((account) => account.id === selectedId);
  const displayed = (
    showArchived
      ? ledger.accounts.map((account) =>
          projectAccountBalance({ account, ledger, through }),
        )
      : totals.balances
  ).filter(({ account }) =>
    [account.name, account.type, ...account.aliases].some((value) =>
      value.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  );
  const unassigned = ledger.records.filter(
    (record) =>
      !record.isDeleted &&
      record.status === "confirmed" &&
      (record.kind === "收入" ||
        record.kind === "支出" ||
        record.kind === "退款") &&
      !record.detail?.movements.length &&
      !resolveAssetAccount(record, ledger.accounts),
  ).length;
  return (
    <>
      {actionError ? (
        <p className="error-message" role="alert">
          {actionError}
        </p>
      ) : null}
      {canUndo && onUndo ? (
        <Button variant="subtle" className="asset-undo" onClick={onUndo}>
          撤销上一次修改
        </Button>
      ) : null}
      <div className="assets-page">
        {selected ? (
          <AccountDetail
            account={selected}
            ledger={ledger}
            through={through}
            onBack={() => setSelectedId(null)}
            onEdit={() => setEditor({ account: selected })}
            onCalibrate={() =>
              setEditor({ account: selected, isCalibration: true })
            }
            onTransfer={() =>
              setTransfer(
                selected.kind === "liability"
                  ? {
                      type: "transfer",
                      destinationId: selected.id,
                      accountId:
                        ledger.accounts.find(
                          (item) => !item.isArchived && item.kind === "asset",
                        )?.id ?? "",
                      merchant: "信用卡还款",
                    }
                  : {
                      type: "transfer",
                      accountId: selected.id,
                      merchant: "账户转账",
                    },
              )
            }
            onArchive={() =>
              onArchive({
                accountId: selected.id,
                isArchived: !selected.isArchived,
              })
            }
            onRecord={onRecord}
          />
        ) : (
          <>
            <div className="page-heading heading-with-action">
              <div>
                <h1>资产管理</h1>
                <p>看清每个账户的余额，也看清钱的变化</p>
              </div>
              <Button
                variant="filled"
                type="submit"
                className="primary-button"
                onClick={() => setEditor({})}
              >
                <Icons.Plus size={19} />
                添加账户
              </Button>
            </div>
            <DateField
              className="asset-valuation-date"
              max={localNow().slice(0, DATE_KEY_LENGTH)}
              label="资产估值日"
              type="date"
              value={valuationDate}
              onChange={(value) => {
                if (value) setValuationDate(value);
              }}
            />
            <ValuationRates controller={rates} currencies={currencies} />
            <AssetTotals
              totals={totals}
              comparison={comparison}
              isDemo={isDemo}
              through={through}
            />
            {!ledger.accounts.length ? (
              <div className="asset-onboarding">
                <Icons.Wallet size={42} weight="duotone" />
                <h2>先添加一个资产或负债账户</h2>
                <p>
                  填写某时点的余额，并设置导入账单的账户别名。之后的已确认流水会更新账户余额。
                </p>
                <Button
                  variant="filled"
                  type="submit"
                  className="primary-button"
                  onClick={() => setEditor({})}
                >
                  添加第一个账户
                </Button>
                {isDemo ? (
                  <Button
                    variant="subtle"
                    type="submit"
                    className="text-button"
                    onClick={loadExamples}
                  >
                    载入虚拟资产示例
                  </Button>
                ) : null}
              </div>
            ) : null}
            {unassigned > 0 ? (
              <UnstyledButton
                type="submit"
                className="account-link-reminder"
                onClick={onUnassigned}
              >
                <Icons.Link size={20} />
                {unassigned} 条账单尚未关联资产账户
                <Icons.Arrow size={18} />
              </UnstyledButton>
            ) : null}
            <TextInput
              label="查找账户"
              placeholder="账户名称、类型或别名"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            {search && !displayed.length ? (
              <p role="status">没有匹配的账户。</p>
            ) : null}
            <div className="asset-groups">
              <AccountGroup
                title="资产账户"
                accounts={displayed.filter(
                  (item) => item.account.kind === "asset",
                )}
                changes={comparison.accountChanges}
                onSelect={setSelectedId}
              />
              <AccountGroup
                title="负债账户"
                accounts={displayed.filter(
                  (item) => item.account.kind === "liability",
                )}
                changes={comparison.accountChanges}
                onSelect={setSelectedId}
              />
            </div>
            <Checkbox
              label={<>显示已归档账户</>}
              className="checkbox-label"

              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            <AssetTrend ledger={ledger} end={valuationDate} />
            <p className="muted small asset-explanation">
              账户余额需要你维护基准。收入/退款增加资产余额，支出减少资产余额；信用卡支出增加负债，退款与还款减少负债。余额未接入银行实时查询。
            </p>
          </>
        )}
      </div>
      {editor?.isCalibration && editor.account ? (
        <BalanceCalibration
          account={editor.account}
          ledger={ledger}
          date={valuationDate}
          onSave={onSave}
          onClose={() => setEditor(null)}
        />
      ) : editor ? (
        <AccountEditor
          account={editor.account}
          onSave={onSave}
          onClose={() => setEditor(null)}
        />
      ) : null}
      {transfer ? (
        <AdvancedEntryEditor
          ledger={ledger}
          initialDraft={transfer}
          onSave={async (next) => {
            await onCommit(next);
            setTransfer(null);
          }}
          onClose={() => setTransfer(null)}
        />
      ) : null}
    </>
  );
}
