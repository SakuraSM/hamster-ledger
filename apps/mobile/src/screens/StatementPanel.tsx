import { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import {
  statementMonths,
  addMinor,
  money,
  type Ledger,
} from "@hamster-ledger/core";
export function StatementPanel({
  ledger,
  month,
  onMonth,
}: {
  ledger: Ledger;
  month: string;
  onMonth: (m: string) => void;
}) {
  const { width, fontScale } = useWindowDimensions(),
    theme = useTheme(),
    stacked = width / fontScale < 330;
  const [annual, setAnnual] = useState(false),
    fmt = (v: number) =>
      ledger.preferences?.hideAmounts ? "••••" : "¥" + money(v);
  const rows = statementMonths(ledger, month.slice(0, 4)).filter(
    (r) => annual || r.month === month,
  );
  const summary = rows.reduce(
    (tot, r) => ({
      income: addMinor(tot.income, r.income),
      expense: addMinor(tot.expense, r.expense),
      net: addMinor(tot.net, r.net),
    }),
    { income: 0, expense: 0, net: 0 },
  );
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" variant="titleLarge">
        收支账单
      </Text>
      <View style={{ flexDirection: "row" }}>
        {["月账单", "年账单"].map((t, i) => (
          <Button
            key={t}
            accessibilityState={{ selected: annual === Boolean(i) }}
            mode={annual === Boolean(i) ? "contained-tonal" : "text"}
            onPress={() => setAnnual(Boolean(i))}
          >
            {t}
          </Button>
        ))}
      </View>
      {annual && (
        <Text variant="titleMedium">
          {month.slice(0, 4)} 年 · 收入 {fmt(summary.income)}　支出{" "}
          {fmt(summary.expense)}　结余 {fmt(summary.net)}
        </Text>
      )}

      {!stacked && (
        <View style={styles.row}>
          <Text style={styles.month}>月份</Text>
          {["收入", "支出", "结余"].map((t) => (
            <Text key={t} style={styles.cell}>
              {t}
            </Text>
          ))}
        </View>
      )}
      {[...rows].reverse().map((r) => (
        <Pressable
          key={r.month}
          accessibilityRole="button"
          accessibilityLabel={
            r.month +
            " 收入 " +
            fmt(r.income) +
            " 支出 " +
            fmt(r.expense) +
            " 结余 " +
            fmt(r.net)
          }
          onPress={() => {
            onMonth(r.month);
            setAnnual(false);
          }}
          style={[
            styles.row,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.outlineVariant,
            },
            stacked && styles.stack,
          ]}
        >
          <Text style={[styles.month, { color: theme.colors.primary }]}>
            {Number(r.month.slice(5))}月
          </Text>
          {(["income", "expense", "net"] as const).map((key, i) => (
            <Text key={key} style={stacked ? undefined : styles.cell}>
              {stacked ? ["收入 ", "支出 ", "结余 "][i] : ""}
              {fmt(r[key])}
            </Text>
          ))}
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { minHeight: 44, alignItems: "center", flexDirection: "row", gap: 4 },
  month: { minWidth: 40 },
  cell: { flex: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
  stack: {
    alignItems: "flex-start",
    flexDirection: "column",
    paddingVertical: 6,
  },
});
