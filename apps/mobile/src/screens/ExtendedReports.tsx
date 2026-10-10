import { useState } from "react";
import { View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import Svg, { Polyline } from "react-native-svg";
import {
  categoryBreakdown,
  memberExpenses,
  money,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { useBookMembers, useReportData } from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { Section } from "../ui/Screen";
export function ExtendedReports({
  ledger,
  records,
  start,
  end,
  kind,
  bookId,
}: {
  ledger: Ledger;
  records: BillRecord[];
  start: string;
  end: string;
  kind: "支出" | "收入";
  bookId?: string;
}): React.JSX.Element {
  const { client } = useNativeAccount(),
    theme = useTheme();
  const members = useBookMembers(client, bookId),
    report = useReportData({ ledger, start, end, client });
  const [parentId, setParent] = useState<string>();
  const categories = categoryBreakdown({ ledger, records, kind, parentId }),
    shares = memberExpenses(ledger, records);
  const values = report.rows
      .map((row) => row.amount)
      .filter((value): value is number => value !== null),
    min = Math.min(0, ...values),
    max = Math.max(1, ...values);
  const segments: string[][] = [[]];
  report.rows.forEach((row, index) => {
    if (row.amount === null) {
      segments.push([]);
      return;
    }
    segments[segments.length - 1].push(
      `${10 + (index / Math.max(1, report.rows.length - 1)) * 300},${140 - ((row.amount - min) / (max - min)) * 130}`,
    );
  });
  return (
    <>
      <Section title="净资产曲线">
        <Text>各期末与起止日估值；归档账户不参与，缺汇率留空。</Text>
        {report.error ? (
          <Text accessibilityRole="alert">{report.error}</Text>
        ) : null}
        {report.isLoading ? <Text>正在查询参考汇率…</Text> : null}
        <View accessible accessibilityLabel="净资产曲线，详细金额见下方">
          <Svg width="100%" height={160} viewBox="0 0 320 160">
            {segments.map((points, index) => (
              <Polyline
                key={index}
                points={points.join(" ")}
                stroke={theme.colors.primary}
                strokeWidth={3}
                fill="none"
              />
            ))}
          </Svg>
        </View>
        {report.rows.map((row) => (
          <Text key={row.date}>
            {row.date} ·{" "}
            {row.amount === null
              ? `缺少 ${row.missing.join("、")} 汇率`
              : `¥${money(row.amount)}`}
          </Text>
        ))}
      </Section>
      <Section title="分类层级">
        {parentId ? (
          <Button onPress={() => setParent(undefined)}>返回一级分类</Button>
        ) : null}
        {categories.map((item) =>
          item.hasChildren ? (
            <Button key={item.id} onPress={() => setParent(item.id)}>
              {item.name} · ¥{money(item.amount)} · 查看子分类
            </Button>
          ) : (
            <Text key={item.id}>
              {item.name} · ¥{money(item.amount)}
            </Text>
          ),
        )}
      </Section>
      <Section title="成员承担额">
        <Text>家庭净支出按分摊归属；退款、报销抵减原分摊，AA 结算不计入。</Text>
        {shares.map((item) => (
          <Text key={item.memberId}>
            {item.memberId === "unassigned"
              ? "未分配成员"
              : (members.find((member) => member.id === item.memberId)
                  ?.username ?? item.memberId)}{" "}
            · ¥{money(item.amount)}
          </Text>
        ))}
        {!shares.length ? <Text>当前范围没有支出。</Text> : null}
      </Section>
    </>
  );
}
