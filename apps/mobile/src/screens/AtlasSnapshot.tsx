import { cycleMonthForDate } from "@hamster-ledger/core";
import { useMemo } from "react";
import { View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import {
  assetActivity,
  signedMoney,
  money,
  type Ledger,
  type BillRecord,
} from "@hamster-ledger/core";
export function AtlasSnapshot({
  ledger,
  date,
  hidden,
  onRecord,
  onBudget,
}: {
  onBudget?: (month: string) => void;
  ledger: Ledger;
  date: string;
  hidden: boolean;
  onRecord: (r: BillRecord) => void;
}) {
  const theme = useTheme(),
    { budget, recent } = useMemo(
      () => assetActivity(ledger, date),
      [ledger, date],
    );
  return (
    <View
      style={{
        gap: 6,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding: 12,
      }}
    >
      {onBudget && (
        <Button
          onPress={() =>
            onBudget(
              cycleMonthForDate(date, ledger.preferences?.cycleStartDay ?? 1),
            )
          }
        >
          {budget ? "查看本期预算" : "设置本期预算"}
        </Button>
      )}
      {budget && (
        <Text>
          本期预算剩余　{hidden ? "••••" : "¥" + money(budget.remaining)}
        </Text>
      )}
      <Text variant="titleMedium" accessibilityRole="header">
        最近流水
      </Text>
      {recent.length ? (
        recent.map((r) => (
          <Button key={r.id} onPress={() => onRecord(r)}>
            {r.date.slice(5, 10)}　
            {hidden
              ? "账单　••••"
              : (r.merchant || r.category) + "　" + signedMoney(r)}
          </Button>
        ))
      ) : (
        <Text>暂无已确认流水</Text>
      )}
    </View>
  );
}
