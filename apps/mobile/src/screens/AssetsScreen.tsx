import { DATE_KEY_LENGTH } from "../constants";
import { useState } from "react";
import { Alert } from "react-native";
import { Button, Card, Text, List } from "react-native-paper";
import {
  archiveAssetAccount,
  assetTrendStart,
  money,
  type AssetAccount,
  type BillRecord,
} from "@hamster-ledger/core";
import {
  useAssetSummary,
  type LedgerController,
  type EntryDraft,
} from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { DateField } from "../ui/DateField";
import { Screen, ErrorMessage } from "../ui/Screen";
import { AccountEditor } from "./AccountEditor";
import { BalanceCalibration } from "./BalanceCalibration";
import { AssetAccountDetail } from "./AssetAccountDetail";
import { AssetAccountList } from "./AssetAccountList";
import { AdvancedEntryEditor } from "./AdvancedEntryEditor";
import { NetWorthReport } from "./NetWorthReport";
import { ValuationRates } from "./ValuationRates";
import { localNow } from "../platform/runtime";
interface AssetsScreenProps {
  controller: LedgerController;
  onRecord: (record: BillRecord) => void;
}
export function AssetsScreen({
  controller,
  onRecord,
}: AssetsScreenProps): React.JSX.Element {
  const [editor, setEditor] = useState<AssetAccount | "new" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<Partial<EntryDraft> | null>(null);
  const [error, setError] = useState("");
  const [valuationDate, setValuationDate] = useState(
    localNow().slice(0, DATE_KEY_LENGTH),
  );
  const ledger = controller.ledger;
  const currencies = ledger.accounts
    .filter((account) => !account.isArchived)
    .map((account) => account.currency ?? "CNY");
  const { totals, comparison, rates } = useAssetSummary({
    ledger,
    date: valuationDate,
    client: useNativeAccount().client,
  });
  const trendStart = assetTrendStart({ ledger, end: valuationDate });
  const through = valuationDate + " 23:59:59";
  const account = ledger.accounts.find((item) => item.id === selected);
  const calibrationAccount = ledger.accounts.find(
    (item) => item.id === calibration,
  );
  async function archive(item: AssetAccount): Promise<void> {
    try {
      await controller.commit(
        archiveAssetAccount({
          ledger,
          accountId: item.id,
          isArchived: !item.isArchived,
        }),
      );
      setSelected(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "归档失败");
    }
  }
  return (
    <>
      <Screen>
        <Text variant="headlineSmall" accessibilityRole="header">
          资产管理
        </Text>
        <Text>看清账户余额与每一笔变化</Text>
        <Card mode="contained">
          <Card.Content style={{ gap: 12 }}>
            <Text>
              {totals.missingCurrencies.length || totals.missingBaselines.length
                ? "已估值净资产"
                : "净资产"}{" "}
              · 截至 {valuationDate}
            </Text>
            <Text variant="displaySmall">¥{money(totals.netAssets)}</Text>
            <Text>
              总资产 ¥{money(totals.assets)} · 总负债 ¥
              {money(totals.liabilities)}
            </Text>
            <Text variant="titleMedium">
              本月变化{" "}
              {comparison.netChange === null
                ? "暂无可比数据"
                : `${comparison.netChange >= 0 ? "+" : ""}¥${money(comparison.netChange)}`}
            </Text>
            <Text variant="bodySmall">
              相比 {comparison.previousDate} · 含校准与汇率变化
            </Text>
          </Card.Content>
        </Card>
        {totals.missingCurrencies.length ? (
          <Text accessibilityRole="alert">
            {totals.missingCurrencies.join("、")} 缺少汇率；合计仅含已估值账户。
          </Text>
        ) : null}
        {totals.missingBaselines.length ? (
          <Text>
            {totals.missingBaselines.join("、")} 在此日期尚无基准，未计入合计。
          </Text>
        ) : null}
        {comparison.unavailableAccounts.length ? (
          <Text>
            {comparison.unavailableAccounts.join("、")} 缺少月初以前的余额基准。
          </Text>
        ) : null}
        <List.Accordion title="估值日与汇率">
          <DateField
            label="资产估值日"
            value={valuationDate}
            onChange={setValuationDate}
          />
          <ValuationRates controller={rates} currencies={currencies} />
        </List.Accordion>
        <Button icon="plus" mode="contained" onPress={() => setEditor("new")}>
          添加账户
        </Button>
        <ErrorMessage message={error} />
        <AssetAccountList
          ledger={ledger}
          through={through}
          changes={comparison.accountChanges}
          onSelect={setSelected}
        />
        {totals.balances.length && trendStart <= valuationDate ? (
          <NetWorthReport
            ledger={ledger}
            start={trendStart}
            end={valuationDate}
          />
        ) : null}
        <Text variant="bodySmall">
          余额由你维护基准，之后的已确认流水自动累计。账户间转账不计入收支，归档账户不计入净资产。
        </Text>
      </Screen>
      {account ? (
        <AssetAccountDetail
          account={account}
          ledger={ledger}
          through={through}
          isSaving={controller.isSaving}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setSelected(null);
            setEditor(account);
          }}
          onCalibrate={() => {
            setSelected(null);
            setCalibration(account.id);
          }}
          onTransfer={() => {
            setSelected(null);
            setTransfer(
              account.kind === "liability"
                ? {
                    type: "transfer",
                    destinationId: account.id,
                    accountId:
                      ledger.accounts.find(
                        (item) => !item.isArchived && item.kind === "asset",
                      )?.id ?? "",
                    merchant: "信用卡还款",
                  }
                : {
                    type: "transfer",
                    accountId: account.id,
                    merchant: "账户转账",
                  },
            );
          }}
          onArchive={() =>
            Alert.alert(
              account.isArchived ? "恢复账户" : "归档账户",
              "历史流水与账户关联会保留。",
              [
                { text: "取消", style: "cancel" },
                { text: "确认", onPress: () => void archive(account) },
              ],
            )
          }
          onRecord={(record) => {
            setSelected(null);
            onRecord(record);
          }}
        />
      ) : null}
      {editor ? (
        <AccountEditor
          account={editor === "new" ? undefined : editor}
          controller={controller}
          onClose={() => setEditor(null)}
        />
      ) : null}
      {calibrationAccount ? (
        <BalanceCalibration
          controller={controller}
          account={calibrationAccount}
          date={valuationDate}
          onClose={() => {
            setCalibration(null);
            setSelected(calibrationAccount.id);
          }}
        />
      ) : null}
      {transfer ? (
        <AdvancedEntryEditor
          ledger={ledger}
          initialDraft={transfer}
          onSave={async (next) => {
            await controller.commit(next);
            setTransfer(null);
          }}
          onClose={() => setTransfer(null)}
        />
      ) : null}
    </>
  );
}
