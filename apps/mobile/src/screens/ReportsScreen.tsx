import { DATE_KEY_LENGTH, MONTH_KEY_LENGTH } from "../constants";
import { useState } from "react";
import { View } from "react-native";
import { Text, SegmentedButtons, ProgressBar } from "react-native-paper";
import {
  reportGroups,
  reportTrend,
  summarize,
  money,
  type Ledger,
} from "@hamster-ledger/core";
import { Screen, Section } from "../ui/Screen";
import { DateField } from "../ui/DateField";
import { localNow } from "../platform/runtime";
interface ReportsScreenProps {
  ledger: Ledger;
}
export function ReportsScreen({
  ledger,
}: ReportsScreenProps): React.JSX.Element {
  const [start, setStart] = useState(
    localNow().slice(0, MONTH_KEY_LENGTH) + "-01",
  );
  const [end, setEnd] = useState(localNow().slice(0, DATE_KEY_LENGTH));
  const [dimension, setDimension] = useState<"category" | "tag">("category");
  const [kind, setKind] = useState<"支出" | "收入">("支出");
  const records = ledger.records.filter(
    (record) =>
      record.date.slice(0, DATE_KEY_LENGTH) >= start &&
      record.date.slice(0, DATE_KEY_LENGTH) <= end,
  );
  const groups = reportGroups({ records, dimension, kind });
  const maximum = Math.max(1, ...groups.map((group) => group.amount));
  const totals = summarize(records);
  const trend = start <= end ? reportTrend({ records, start, end }) : [];
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        收支报表
      </Text>
      <DateField label="开始日期" value={start} onChange={setStart} />
      <DateField label="结束日期" value={end} onChange={setEnd} />
      {start > end ? (
        <Text accessibilityLiveRegion="polite">结束日期不能早于开始日期。</Text>
      ) : (
        <>
          <Text variant="titleLarge">支出 ¥{money(totals.expense)}</Text>
          <Text variant="titleLarge">
            收入 ¥{money(totals.income)} · 结余 ¥{money(totals.net)}
          </Text>
          <SegmentedButtons
            value={kind}
            onValueChange={(value) => setKind(value as "支出" | "收入")}
            buttons={[
              { value: "支出", label: "支出" },
              { value: "收入", label: "收入" },
            ]}
          />
          <SegmentedButtons
            value={dimension}
            onValueChange={(value) => setDimension(value as "category" | "tag")}
            buttons={[
              { value: "category", label: "按分类" },
              { value: "tag", label: "按标签" },
            ]}
          />
          <Section title="金额分布">
            {groups.map((group) => (
              <View key={group.name} style={{ gap: 8 }}>
                <Text>
                  {group.name} · ¥{money(group.amount)}
                </Text>
                <ProgressBar progress={Math.max(0, group.amount / maximum)} />
              </View>
            ))}
          </Section>
          <Section title="每日收支">
            {trend
              .filter((day) => day.expense || day.income)
              .map((day) => (
                <Text key={day.date}>
                  {day.date} · 支出 ¥{money(day.expense)} · 收入 ¥
                  {money(day.income)}
                </Text>
              ))}
          </Section>
        </>
      )}
    </Screen>
  );
}
