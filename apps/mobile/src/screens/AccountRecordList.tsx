import { useLayoutEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import {
  formatCurrency,
  type AssetAccount,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import {
  useAccountHistory,
  type AccountHistoryMode,
} from "@hamster-ledger/ledger-react";
import { ChoiceField } from "../ui/ChoiceField";
import { styles as screenStyles } from "../ui/Screen";
import { RecordRow } from "./RecordRow";

interface AccountRecordListProps {
  ledger: Ledger;
  account: AssetAccount;
  through: string;
  initialMode?: AccountHistoryMode;
  isAmountHidden?: boolean;
  onRecord: (record: BillRecord) => void;
}
export function AccountRecordList({
  ledger,
  account,
  through,
  initialMode = "changes",
  isAmountHidden = false,
  onRecord,
}: AccountRecordListProps): React.JSX.Element {
  const history = useAccountHistory({ ledger, account, through });
  const initialModeRef = useRef(initialMode);
  const setModeRef = useRef(history.setMode);
  setModeRef.current = history.setMode;
  useLayoutEffect(() => {
    if (initialModeRef.current !== "changes")
      setModeRef.current(initialModeRef.current);
  }, []);
  const theme = useTheme();
  const amount = (minor: number): string =>
    isAmountHidden
      ? "••••"
      : formatCurrency({ minor, currency: account.currency ?? "CNY" });
  return (
    <>
      <View style={screenStyles.row}>
        <Button
          mode={history.mode === "changes" ? "contained" : "outlined"}
          contentStyle={styles.touch}
          onPress={() => history.setMode("changes")}
        >
          余额变动
        </Button>
        <Button
          mode={history.mode === "records" ? "contained" : "outlined"}
          contentStyle={styles.touch}
          onPress={() => history.setMode("records")}
        >
          关联账单
        </Button>
      </View>
      <ChoiceField
        label="账户账期"
        value={history.month}
        options={[
          { value: "", label: "全部账期" },
          ...history.months.map((value) => ({ value, label: value })),
        ]}
        onChange={history.setMonth}
      />
      <Text variant="bodySmall">
        {history.mode === "changes"
          ? "按账户原币展示已生效变动。负数表示余额减少；负债减少表示还款。"
          : "包含待确认及基准之前的账单，这些记录不会再次叠加到当前余额。"}
      </Text>
      {history.mode === "records"
        ? history.records.map((record) => (
            <RecordRow
              key={record.id}
              record={record}
              isAmountHidden={isAmountHidden}
              onPress={onRecord}
            />
          ))
        : history.activities.map((row) => (
            <View
              key={row.id}
              style={[
                styles.activity,
                { borderColor: theme.colors.outlineVariant },
              ]}
            >
              <View style={styles.activityHeading}>
                <View style={styles.activityText}>
                  <Text variant="titleMedium" style={styles.strong}>
                    {isAmountHidden ? "余额记录" : row.description}
                  </Text>
                  <Text variant="bodySmall">
                    {row.label} · {row.at}
                  </Text>
                </View>
                <Text variant="titleMedium" style={styles.strong}>
                  {row.change === null
                    ? amount(row.balance)
                    : `${!isAmountHidden && row.change >= 0 ? "+" : ""}${amount(row.change)}`}
                </Text>
              </View>
              <Text variant="bodySmall">
                {row.change === null
                  ? "初始余额"
                  : `变动后 ${amount(row.balance)}`}
              </Text>
              {row.record ? (
                <Button
                  accessibilityLabel={
                    isAmountHidden
                      ? "查看账单详情，金额已隐藏"
                      : `查看${row.record.merchant}账单详情`
                  }
                  contentStyle={styles.touch}
                  onPress={() => row.record && onRecord(row.record)}
                >
                  查看账单
                </Button>
              ) : null}
            </View>
          ))}
      {!history.count ? (
        <Text>
          所选账期暂无{history.mode === "changes" ? "余额变动" : "关联账单"}。
        </Text>
      ) : null}
      <Text>
        共 {history.count} 条 · 第 {history.page} / {history.pages} 页
      </Text>
      <View style={screenStyles.row}>
        <Button
          contentStyle={styles.touch}
          disabled={history.page <= 1}
          onPress={() => history.setPage(history.page - 1)}
        >
          上一页
        </Button>
        <Button
          contentStyle={styles.touch}
          disabled={history.page >= history.pages}
          onPress={() => history.setPage(history.page + 1)}
        >
          下一页
        </Button>
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  activity: {
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  activityText: { flexGrow: 1, flexShrink: 1, gap: 4 },
  strong: { fontWeight: "700" },
  touch: { minHeight: 48 },
});
