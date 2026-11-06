import { DATE_KEY_LENGTH } from "../constants";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import {
  projectAccountBalance,
  formatCurrency,
  type AssetAccount,
  type Ledger,
  type BillRecord,
} from "@hamster-ledger/core";
import type {
  AccountHistoryMode,
  RateQuote,
} from "@hamster-ledger/ledger-react";
import { FormSheet } from "../ui/FormSheet";
import { AccountRecordList } from "./AccountRecordList";
import { AssetAccountContext } from "./AssetAccountContext";

interface AssetAccountDetailProps {
  account: AssetAccount;
  ledger: Ledger;
  through: string;
  rate?: RateQuote;
  isSaving: boolean;
  initialHistoryMode?: AccountHistoryMode;
  isAmountHidden: boolean;
  onReveal: () => void;
  onClose: () => void;
  onEdit: () => void;
  onCalibrate: () => void;
  onTransfer: () => void;
  onManageRates: () => void;
  onArchive: () => void;
  onRecord: (record: BillRecord) => void;
}
export function AssetAccountDetail({
  account,
  ledger,
  through,
  rate,
  isSaving,
  initialHistoryMode = "changes",
  isAmountHidden,
  onReveal,
  onClose,
  onEdit,
  onCalibrate,
  onTransfer,
  onManageRates,
  onArchive,
  onRecord,
}: AssetAccountDetailProps): React.JSX.Element {
  const theme = useTheme();
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const balance = projectAccountBalance({ account, ledger, through });
  const currency = account.currency ?? "CNY";
  const accountLabel = isAmountHidden ? "账户详情" : account.name;
  const amount = (minor: number): string =>
    isAmountHidden ? "••••" : formatCurrency({ minor, currency });
  const label =
    account.kind === "asset"
      ? "当前账户余额"
      : balance.balance < 0
        ? "预存余额"
        : "剩余负债";
  const formattedBalance = balance.baseline
    ? amount(
        account.kind === "liability"
          ? Math.abs(balance.balance)
          : balance.balance,
      )
    : "尚无余额基准";
  return (
    <FormSheet title={accountLabel} onClose={onClose}>
      <Text
        variant="headlineLarge"
        accessibilityRole="header"
        style={styles.strong}
      >
        {accountLabel}
      </Text>
      <Text style={{ color: theme.colors.onSurfaceVariant }}>
        {account.kind === "asset" ? "资产" : "负债"} · {account.type} ·{" "}
        {currency} / 截至 {through.slice(0, DATE_KEY_LENGTH)}
        {account.isArchived ? " · 已归档" : ""}
      </Text>
      <View style={styles.summary}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
        <Text variant="displaySmall" style={styles.mainAmount}>
          {formattedBalance}
        </Text>
        {balance.baseline ? (
          <View
            style={[
              styles.metrics,
              { borderColor: theme.colors.outlineVariant },
            ]}
          >
            <View style={styles.metric}>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>
                余额基准
              </Text>
              <Text variant="titleLarge" style={styles.strong}>
                {amount(balance.baseline.balance)}
              </Text>
              <Text variant="bodySmall">{balance.baseline.at}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>
                已确认变动
              </Text>
              <Text variant="titleLarge" style={styles.strong}>
                {!isAmountHidden && balance.change >= 0 ? "+" : ""}
                {amount(balance.change)}
              </Text>
              <Text variant="bodySmall">{balance.movementCount} 笔</Text>
            </View>
          </View>
        ) : (
          <Text>该估值日之前没有余额基准，可校准余额建立基准。</Text>
        )}
      </View>
      <AssetAccountContext
        account={account}
        rate={rate}
        balance={balance.baseline ? balance.balance : null}
        isAmountHidden={isAmountHidden}
        onManageRates={onManageRates}
      />
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        余额来自基准之后的已确认流水。待确认、重复及基准以前的账单不会重复累计。
      </Text>
      {isAmountHidden ? (
        <Button contentStyle={styles.touch} onPress={onReveal}>
          显示资产金额后查看明细
        </Button>
      ) : null}
      <AccountRecordList
        ledger={ledger}
        account={account}
        through={through}
        initialMode={initialHistoryMode}
        isAmountHidden={isAmountHidden}
        onRecord={onRecord}
      />
      <Button
        icon="history"
        mode="outlined"
        contentStyle={styles.touch}
        onPress={() => setHistoryOpen(true)}
      >
        余额基准与历史
      </Button>
      {!account.isArchived && account.kind === "liability" ? (
        <Button
          mode="contained"
          contentStyle={styles.touch}
          onPress={onTransfer}
        >
          {account.type === "信用卡" ? "记录信用卡还款" : "记录还款"}
        </Button>
      ) : null}
      <Button
        mode={account.kind === "asset" ? "contained" : "outlined"}
        contentStyle={styles.touch}
        onPress={onCalibrate}
      >
        核对实际余额
      </Button>
      {!account.isArchived && account.kind === "asset" ? (
        <Button
          mode="outlined"
          contentStyle={styles.touch}
          onPress={onTransfer}
        >
          账户转账
        </Button>
      ) : null}
      <Button contentStyle={styles.touch} onPress={onEdit}>
        编辑账户
      </Button>
      <Text variant="bodySmall">
        匹配别名：
        {isAmountHidden ? "已隐藏" : account.aliases.join("、") || "无"}
      </Text>
      <Button
        disabled={isSaving}
        contentStyle={styles.touch}
        onPress={onArchive}
      >
        {account.isArchived ? "恢复账户" : "归档账户"}
      </Button>
      <Text variant="bodySmall">
        归档保留历史流水，归档后的账户不计入净资产。
      </Text>
      {isHistoryOpen ? (
        <FormSheet title="余额基准与历史" onClose={() => setHistoryOpen(false)}>
          <Text variant="headlineSmall" accessibilityRole="header">
            余额的来龙去脉
          </Text>
          <Text>{accountLabel} · 历史基准与状态</Text>
          {isAmountHidden ? (
            <Button contentStyle={styles.touch} onPress={onReveal}>
              显示资产金额后查看历史
            </Button>
          ) : null}
          <AccountRecordList
            ledger={ledger}
            account={account}
            through={through}
            isAmountHidden={isAmountHidden}
            onRecord={(record) => {
              setHistoryOpen(false);
              onRecord(record);
            }}
          />
          {account.archiveHistory?.map((event) => (
            <Text key={`${event.at}:${event.isArchived}`}>
              {event.at} · {event.isArchived ? "账户归档" : "恢复账户"}
            </Text>
          ))}
          <Text>归档从确认的时间起生效，之前的净资产曲线继续保留。</Text>
          <Button
            mode="contained"
            contentStyle={styles.touch}
            onPress={() => setHistoryOpen(false)}
          >
            返回账户
          </Button>
        </FormSheet>
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 8 },
  mainAmount: { fontWeight: "800", fontVariant: ["tabular-nums"] },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metric: { flexGrow: 1, gap: 4 },
  strong: { fontWeight: "700" },
  touch: { minHeight: 48 },
});
