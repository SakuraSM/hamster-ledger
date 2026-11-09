import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { money, type BillRecord } from "@hamster-ledger/core";

const PAGE_SIZE = 8;
const DATE_KEY_LENGTH = 10;
interface ReportRecordListProps {
  records: BillRecord[];
  onRecord?: (record: BillRecord) => void;
}
export function ReportRecordList({
  records,
  onRecord,
}: ReportRecordListProps): React.JSX.Element {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  if (!records.length) return <Text>这一期没有已确认的收支账单。</Text>;
  return (
    <View style={styles.list}>
      {records
        .slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
        .map((record) =>
          onRecord ? (
            <Button
              key={record.id}
              mode="text"
              accessibilityLabel={`查看${record.merchant || "未填写商户"}账单`}
              onPress={() => onRecord(record)}
            >
              {record.date.slice(0, DATE_KEY_LENGTH)} ·{" "}
              {record.merchant || "未填写商户"} · {record.kind} ¥
              {money(record.amount)}
            </Button>
          ) : (
            <Text key={record.id}>
              {record.date.slice(0, DATE_KEY_LENGTH)} ·{" "}
              {record.merchant || "未填写商户"} · {record.kind} ¥
              {money(record.amount)}
            </Text>
          ),
        )}
      {pageCount > 1 ? (
        <View style={styles.pages}>
          <Button
            compact
            disabled={current === 0}
            onPress={() => setPage(current - 1)}
          >
            上一页
          </Button>
          <Text>
            {current + 1} / {pageCount}
          </Text>
          <Button
            compact
            disabled={current >= pageCount - 1}
            onPress={() => setPage(current + 1)}
          >
            下一页
          </Button>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  list: { gap: 6 },
  pages: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
});
