import { MONTH_KEY_LENGTH } from "../constants";
const RECENT_RECORD_LIMIT = 5;
const MIN_SUMMARY_METRIC_WIDTH = 132;
import { View, useWindowDimensions } from "react-native";
import { Button, Card, Text, ProgressBar } from "react-native-paper";
import {
  money,
  summarize,
  periodRecords,
  reportGroups,
  type Ledger,
  type BillRecord,
} from "@hamster-ledger/core";
import { Screen, Section, styles } from "../ui/Screen";
import { ChoiceField } from "../ui/ChoiceField";
import { AmountText, useAmountColors } from "../ui/AmountText";
import { balanceAmountTone } from "../ui/amount-tones";
import { RecordRow } from "./RecordRow";
import { localNow } from "../platform/runtime";
interface OverviewScreenProps {
  ledger: Ledger;
  month: string;
  onMonth: (month: string) => void;
  isDemo: boolean;
  onRecord: (record: BillRecord) => void;
  onReview: () => void;
}
export function OverviewScreen({
  ledger,
  month,
  onMonth,
  isDemo,
  onRecord,
  onReview,
}: OverviewScreenProps): React.JSX.Element {
  const colors = useAmountColors();
  const { fontScale } = useWindowDimensions();
  const metricStyle = {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: MIN_SUMMARY_METRIC_WIDTH * fontScale,
  };
  const isAmountHidden = Boolean(ledger.preferences?.hideAmounts);
  const records = periodRecords(ledger, month);
  const summary = summarize(records);
  const groups = reportGroups({ records, dimension: "category", kind: "支出" });
  const pending = ledger.reviews.filter(
    (review) => review.state === "pending",
  ).length;
  const months = [
    ...new Set([
      month,
      localNow().slice(0, MONTH_KEY_LENGTH),
      ...ledger.records.map((record) => record.date.slice(0, MONTH_KEY_LENGTH)),
    ]),
  ]
    .sort()
    .reverse();
  const amount = (value: number): string =>
    ledger.preferences?.hideAmounts ? "••••" : `¥${money(value)}`;
  return (
    <Screen>
      <Text variant="headlineMedium" accessibilityRole="header">
        把每一笔，存进小日子
      </Text>
      {isDemo ? <Text>示例账本 · 以下均为虚拟数据</Text> : null}
      <ChoiceField
        label="账期"
        value={month}
        options={months.map((value) => ({ value, label: value }))}
        onChange={onMonth}
      />
      <Card mode="contained">
        <Card.Content style={{ gap: 12 }}>
          <Text variant="titleMedium">本期支出</Text>
          <AmountText
            variant="displayMedium"
            style={styles.amount}
            amount={summary.expense}
            tone="expense"
            isMuted={isAmountHidden}
          >
            {amount(summary.expense)}
          </AmountText>
          <View style={[styles.row, { alignItems: "flex-start" }]}>
            <View style={metricStyle}>
              <Text>收入</Text>
              <AmountText
                variant="titleLarge"
                amount={summary.income}
                tone="income"
                isMuted={isAmountHidden}
              >
                {amount(summary.income)}
              </AmountText>
            </View>
            <View style={metricStyle}>
              <Text>结余</Text>
              <AmountText
                variant="titleLarge"
                amount={summary.net}
                tone={balanceAmountTone(summary.net)}
                isMuted={isAmountHidden}
              >
                {amount(summary.net)}
              </AmountText>
            </View>
          </View>
          <Text variant="bodySmall">已确认账单，转账不计入收支</Text>
        </Card.Content>
      </Card>
      {pending ? (
        <Button icon="content-duplicate" mode="outlined" onPress={onReview}>
          {pending} 组疑似重复待核对
        </Button>
      ) : null}
      <Section title="支出分类">
        {groups.length ? (
          groups.map((group) => (
            <View key={group.name} style={{ gap: 6 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text>{group.name}</Text>
                <AmountText
                  amount={group.amount}
                  tone="expense"
                  isMuted={isAmountHidden}
                >
                  {amount(group.amount)}
                </AmountText>
              </View>
              <ProgressBar
                color={colors.expense}
                progress={
                  summary.expense > 0
                    ? Math.max(0, Math.min(1, group.amount / summary.expense))
                    : 0
                }
              />
            </View>
          ))
        ) : (
          <Text>本期还没有已确认的支出。</Text>
        )}
      </Section>
      <Section title="最近账单">
        {records
          .filter((record) => record.status !== "duplicate")
          .sort((left, right) => right.date.localeCompare(left.date))
          .slice(0, RECENT_RECORD_LIMIT)
          .map((record) => (
            <RecordRow key={record.id} record={record} onPress={onRecord} />
          ))}
      </Section>
    </Screen>
  );
}
