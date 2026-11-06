import { memo } from "react";
import { AmountText, useAmountColors } from "../ui/AmountText";
import { ExtendedReports } from "./ExtendedReports";
import { NetWorthReport } from "./NetWorthReport";
import { ReportRangePresets } from "../ui/ReportRangePresets";
import { DATE_KEY_LENGTH, MONTH_KEY_LENGTH } from "../constants";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Text,
  SegmentedButtons,
  ProgressBar,
} from "react-native-paper";
import {
  reportGroups,
  reportTrend,
  summarize,
  money,
  reimbursementReport,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { Screen, Section } from "../ui/Screen";
import { DateField } from "../ui/DateField";
import { localNow } from "../platform/runtime";
interface ReportsScreenProps {
  ledger: Ledger;
  bookId?: string;
  onRecord?: (record: BillRecord) => void;
  onReimburse?: (record: BillRecord) => void;
}
export const ReportsScreen = memo(function ReportsScreen({
  ledger,
  bookId,
  onRecord,
  onReimburse,
}: ReportsScreenProps): React.JSX.Element {
  const colors = useAmountColors();
  const isAmountHidden = Boolean(ledger.preferences?.hideAmounts);
  const amount = (value: number): string =>
    isAmountHidden ? "••••" : `¥${money(value)}`;
  const reimbursementAmount = (value: number | null): string =>
    value === null ? "数据状态需核对" : amount(value);
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
  const reimbursement = reimbursementReport({ ledger, start, end });
  function changeRange(nextStart: string, nextEnd: string): void {
    setStart(nextStart);
    setEnd(nextEnd);
  }
  return (
    <Screen>
      <Text
        variant="headlineLarge"
        accessibilityRole="header"
        style={{ fontWeight: "700" }}
      >
        花在了哪里
      </Text>
      <Text>仅统计已确认收支，转账不计入。</Text>
      <ReportRangePresets
        today={localNow().slice(0, DATE_KEY_LENGTH)}
        start={start}
        end={end}
        onChange={changeRange}
      />
      <DateField label="开始日期" value={start} onChange={setStart} />
      <DateField label="结束日期" value={end} onChange={setEnd} />
      {start > end ? (
        <Text accessibilityLiveRegion="polite">结束日期不能早于开始日期。</Text>
      ) : (
        <>
          <Text>本期净支出</Text>
          <AmountText
            variant="displaySmall"
            amount={totals.expense}
            tone="expense"
            isMuted={isAmountHidden}
          >
            {amount(totals.expense)}
          </AmountText>
          <Text variant="titleLarge">
            收入{" "}
            <AmountText
              variant="titleLarge"
              amount={totals.income}
              tone="income"
              isMuted={isAmountHidden}
            >
              {amount(totals.income)}
            </AmountText>{" "}
            · 结余{" "}
            <AmountText
              variant="titleLarge"
              amount={totals.net}
              tone="neutral"
              isMuted={isAmountHidden}
            >
              {amount(totals.net)}
            </AmountText>
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
            {!isAmountHidden
              ? groups.map((group) => (
                  <View key={group.name} style={{ gap: 8 }}>
                    <Text>
                      {group.name} ·{" "}
                      <AmountText
                        amount={group.amount}
                        tone={kind === "支出" ? "expense" : "income"}
                      >
                        ¥{money(group.amount)}
                      </AmountText>
                    </Text>
                    <ProgressBar
                      color={kind === "支出" ? colors.expense : colors.income}
                      progress={Math.max(0, group.amount / maximum)}
                    />
                  </View>
                ))
              : null}
          </Section>
          <Section title="每日收支">
            {!isAmountHidden
              ? trend
                  .filter((day) => day.expense || day.income)
                  .map((day) => (
                    <Text key={day.date}>
                      {day.date} · 支出{" "}
                      <AmountText amount={day.expense} tone="expense">
                        ¥{money(day.expense)}
                      </AmountText>{" "}
                      · 收入{" "}
                      <AmountText amount={day.income} tone="income">
                        ¥{money(day.income)}
                      </AmountText>
                    </Text>
                  ))
              : null}
          </Section>
          <Section title="回款与分摊">
            <Text>
              统计 {start} 至 {end}{" "}
              的已确认、未删除且非重复的可报销支出；已确认关联退款和报销回款按截至{" "}
              {end}{" "}
              抵减。当前可继续记录上限按全部已确认关联回款计算，金额为人民币记账金额。
            </Text>
            <Text>
              待回款 · {reimbursementAmount(reimbursement.outstanding)}
            </Text>
            <Text>已回款 · {reimbursementAmount(reimbursement.received)}</Text>
            {reimbursement.rows.map((row, index) => (
              <View key={row.record.id}>
                <Text>
                  {isAmountHidden || row.hasConflict
                    ? `原支出 ${index + 1}`
                    : row.record.merchant}
                </Text>
                {row.hasConflict ? (
                  <>
                    <Text>数据状态需核对</Text>
                    <Text>
                      存在重复关联或交易类型不一致，请检查原支出及异常关联。
                    </Text>
                  </>
                ) : (
                  <>
                    <Text>
                      原金额 {amount(row.record.amount)} · 已回款{" "}
                      {reimbursementAmount(row.received)} · 待回款{" "}
                      {reimbursementAmount(row.outstanding)}
                    </Text>
                    <Text>
                      当前可继续记录上限：
                      {reimbursementAmount(row.currentAvailable)}
                    </Text>
                  </>
                )}
                {onRecord ? (
                  <Button
                    accessibilityLabel={`查看原支出 ${index + 1}`}
                    onPress={() => onRecord(row.record)}
                  >
                    查看原支出
                  </Button>
                ) : null}
                {row.returns.map((record, returnIndex) =>
                  onRecord ? (
                    <Button
                      key={record.id}
                      accessibilityLabel={`查看回款 ${index + 1}-${returnIndex + 1}`}
                      onPress={() => onRecord(record)}
                    >
                      查看回款 {returnIndex + 1}
                    </Button>
                  ) : null,
                )}
                {row.laterReturns.map((record, returnIndex) =>
                  onRecord ? (
                    <Button
                      key={record.id}
                      accessibilityLabel={`查看截止日后回款 ${index + 1}-${returnIndex + 1}`}
                      onPress={() => onRecord(record)}
                    >
                      查看截止日后回款 {returnIndex + 1}
                    </Button>
                  ) : null,
                )}
                {row.anomalies.map((record, returnIndex) =>
                  onRecord ? (
                    <Button
                      key={record.id}
                      accessibilityLabel={`查看异常关联 ${index + 1}-${returnIndex + 1}`}
                      onPress={() => onRecord(record)}
                    >
                      查看异常关联 {returnIndex + 1}
                    </Button>
                  ) : null,
                )}
                {onReimburse &&
                row.currentAvailable !== null &&
                row.currentAvailable > 0 ? (
                  <Button
                    accessibilityLabel={`记录回款 ${index + 1}`}
                    onPress={() => onReimburse(row.record)}
                  >
                    记录回款
                  </Button>
                ) : null}
              </View>
            ))}
            {!reimbursement.rows.length ? (
              <Text>当前范围没有可报销支出。</Text>
            ) : null}
          </Section>
          {!isAmountHidden ? (
            <NetWorthReport
              key={`${start}:${end}`}
              ledger={ledger}
              start={start}
              end={end}
            />
          ) : (
            <Text>金额已隐藏，图表和明细暂不展示。</Text>
          )}
          {!isAmountHidden ? (
            <ExtendedReports
              ledger={ledger}
              records={records}
              kind={kind}
              bookId={bookId}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
});
