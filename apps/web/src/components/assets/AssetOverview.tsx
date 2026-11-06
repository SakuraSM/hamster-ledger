import { Button, Checkbox, TextInput, UnstyledButton } from "@mantine/core";
import { useEffect, useRef } from "react";
import {
  accountActiveAt,
  projectAccountBalance,
  resolveAssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import type { AssetSummaryController } from "@hamster-ledger/ledger-react";
import { localNow } from "../../platform/browser/runtime";
import { DateField } from "../../ui/DateField";
import { Icons } from "../Icons";
import { AccountGroup } from "./AccountGroup";
import { AssetTotals } from "./AssetTotals";
import { AssetTrend } from "./AssetTrend";
import { ValuationRates } from "./ValuationRates";

const DATE_KEY_LENGTH = 10;
interface AssetOverviewProps {
  ledger: Ledger;
  isDemo: boolean;
  isHidden: boolean;
  valuationDate: string;
  summary: AssetSummaryController;
  search: string;
  showArchived: boolean;
  showTrend: boolean;
  isLoadingExamples: boolean;
  focusAccounts: boolean;
  settingsTarget: "date" | "rates" | null;
  onAccountsFocused: () => void;
  onSettingsOpened: () => void;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onTransfer: () => void;
  onUnassigned: () => void;
  onLoadExamples: () => void;
  onSearch: (value: string) => void;
  onToggleAmounts: () => void;
  onShowArchived: (value: boolean) => void;
  onShowTrend: (value: boolean) => void;
  onDate: (value: string) => void;
}

export function AssetOverview({
  ledger,
  isDemo,
  isHidden,
  valuationDate,
  summary,
  search,
  showArchived,
  showTrend,
  isLoadingExamples,
  focusAccounts,
  settingsTarget,
  onAccountsFocused,
  onSettingsOpened,
  onAdd,
  onSelect,
  onTransfer,
  onUnassigned,
  onLoadExamples,
  onSearch,
  onToggleAmounts,
  onShowArchived,
  onShowTrend,
  onDate,
}: AssetOverviewProps): React.JSX.Element {
  const accountsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!focusAccounts) return;
    accountsRef.current?.focus();
    onAccountsFocused();
  }, [focusAccounts, onAccountsFocused]);
  useEffect(() => {
    if (!settingsTarget || !settingsRef.current) return;
    const settings = settingsRef.current;
    settings.open = true;
    const ratesPanel =
      settings.querySelector<HTMLDetailsElement>(".asset-rates");
    if (settingsTarget === "rates" && ratesPanel) {
      ratesPanel.open = true;
      ratesPanel.querySelector<HTMLElement>("summary")?.focus();
    } else {
      settings
        .querySelector<HTMLElement>(
          settingsTarget === "date" ? "input" : "summary",
        )
        ?.focus();
    }
    onSettingsOpened();
  }, [settingsTarget, onSettingsOpened]);
  const { rates, totals, comparison } = summary;
  const through = valuationDate + " 23:59:59";
  const currencies = ledger.accounts
    .filter((account) => accountActiveAt(account, through))
    .map((account) => account.currency ?? "CNY");
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
      <div className="page-heading heading-with-action asset-heading">
        <div>
          <h1>资产</h1>
          <p>截至 {valuationDate}</p>
        </div>
        <Button className="asset-add-button" variant="subtle" onClick={onAdd}>
          <Icons.Plus size={19} /> 添加账户
        </Button>
      </div>
      <AssetTotals
        totals={totals}
        comparison={comparison}
        isDemo={isDemo}
        isHidden={isHidden}
        through={through}
        onToggleAmounts={onToggleAmounts}
      />
      <div ref={accountsRef} tabIndex={-1} className="asset-accounts-focus">
        {!ledger.accounts.length ? (
          <div className="asset-onboarding">
            <Icons.Wallet size={42} weight="duotone" />
            <h2>先添加一个资产或负债账户</h2>
            <p>
              填写某时点的余额，并设置导入账单的账户别名。之后的已确认流水会更新账户余额。
            </p>
            <Button className="primary-button" onClick={onAdd}>
              添加第一个账户
            </Button>
            {isDemo ? (
              <Button
                variant="subtle"
                loading={isLoadingExamples}
                onClick={onLoadExamples}
              >
                载入虚拟资产示例
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <TextInput
              className="asset-search"
              label="查找账户"
              placeholder="账户名称、类型或别名"
              value={search}
              onChange={(event) => onSearch(event.currentTarget.value)}
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
                allAccounts={ledger.accounts}
                changes={comparison.accountChanges}
                isHidden={isHidden}
                onSelect={onSelect}
              />
              <AccountGroup
                title="负债账户"
                accounts={displayed.filter(
                  (item) => item.account.kind === "liability",
                )}
                allAccounts={ledger.accounts}
                changes={comparison.accountChanges}
                isHidden={isHidden}
                onSelect={onSelect}
              />
            </div>
            <Checkbox
              label="显示已归档账户"
              className="checkbox-label asset-archived-toggle"
              checked={showArchived}
              onChange={(event) => onShowArchived(event.currentTarget.checked)}
            />
          </>
        )}
      </div>
      {unassigned > 0 ? (
        <UnstyledButton
          type="button"
          className="account-link-reminder"
          onClick={onUnassigned}
        >
          <Icons.Link size={20} />
          {unassigned} 条账单尚未关联资产账户
          <Icons.Caret size={18} />
        </UnstyledButton>
      ) : null}
      {ledger.accounts.length ? (
        <div className="asset-primary-actions">
          <Button className="primary-button" onClick={onTransfer}>
            账户间转账
          </Button>
          <Button
            variant="subtle"
            aria-expanded={showTrend}
            onClick={() => onShowTrend(!showTrend)}
          >
            {showTrend ? "收起净资产趋势" : "查看净资产趋势"}
          </Button>
        </div>
      ) : null}
      {showTrend ? (
        <AssetTrend ledger={ledger} end={valuationDate} isHidden={isHidden} />
      ) : null}
      <details className="asset-settings" ref={settingsRef}>
        <summary>估值日期与汇率</summary>
        <DateField
          className="asset-valuation-date"
          max={localNow().slice(0, DATE_KEY_LENGTH)}
          label="资产估值日"
          type="date"
          value={valuationDate}
          onChange={(value) => {
            if (value) onDate(value);
          }}
        />
        {currencies.some((currency) => currency !== "CNY") ? (
          <ValuationRates controller={rates} currencies={currencies} />
        ) : (
          <p className="account-form-help">
            当前范围没有外币账户，无需估值汇率。
          </p>
        )}
      </details>
      <p className="muted small asset-explanation">
        账户余额需要你维护基准。收入和退款增加资产余额，支出减少资产余额；信用卡支出增加负债，退款与还款减少负债。余额未接入银行实时查询。
      </p>
    </>
  );
}
