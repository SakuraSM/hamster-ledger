import { View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import {
  formatCurrency,
  type AssetAccount,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { useAccountHistory } from "@hamster-ledger/ledger-react";
import { ChoiceField } from "../ui/ChoiceField";
import { styles } from "../ui/Screen";
import { RecordRow } from "./RecordRow";
interface AccountRecordListProps {
  ledger: Ledger;
  account: AssetAccount;
  through: string;
  onRecord: (record: BillRecord) => void;
}
export function AccountRecordList({
  ledger,
  account,
  through,
  onRecord,
}: AccountRecordListProps): React.JSX.Element {
  const history = useAccountHistory({ ledger, account, through });
  const amount = (minor: number): string =>
    formatCurrency({ minor, currency: account.currency ?? "CNY" });
  return (
    <>
      <ChoiceField
        label="账户账期"
        value={history.month}
        options={[
          { value: "", label: "全部账期" },
          ...history.months.map((value) => ({ value, label: value })),
        ]}
        onChange={history.setMonth}
      />
      <View style={styles.row}>
        <Button
          mode={history.mode === "changes" ? "contained" : "outlined"}
          onPress={() => history.setMode("changes")}
        >
          余额变动
        </Button>
        <Button
          mode={history.mode === "records" ? "contained" : "outlined"}
          onPress={() => history.setMode("records")}
        >
          关联账单
        </Button>
      </View>
      <Text variant="bodySmall">
        {history.mode === "changes"
          ? "按账户原币展示已生效变动。负数表示余额减少；负债减少表示还款。"
          : "包含待确认及基准之前的账单，这些记录不会再次叠加到当前余额。"}
      </Text>
      {history.mode === "records"
        ? history.records.map((record) => (
            <RecordRow key={record.id} record={record} onPress={onRecord} />
          ))
        : history.activities.map((row) => (
            <Card key={row.id} mode="outlined">
              <Card.Content style={{ gap: 6 }}>
                <Text variant="labelMedium">
                  {row.label} · {row.at}
                </Text>
                <Text variant="titleMedium">{row.description}</Text>
                <Text variant="titleLarge">
                  {row.change === null
                    ? "初始余额"
                    : `${row.change >= 0 ? "+" : ""}${amount(row.change)}`}
                </Text>
                <Text>变动后 {amount(row.balance)}</Text>
              </Card.Content>
              {row.record ? (
                <Card.Actions>
                  <Button
                    accessibilityLabel={`查看${row.record.merchant}账单详情`}
                    onPress={() => row.record && onRecord(row.record)}
                  >
                    查看账单
                  </Button>
                </Card.Actions>
              ) : null}
            </Card>
          ))}
      {!history.count ? (
        <Text>
          所选账期暂无{history.mode === "changes" ? "余额变动" : "关联账单"}。
        </Text>
      ) : null}
      <Text>
        共 {history.count} 条 · 第 {history.page} / {history.pages} 页
      </Text>
      <View style={styles.row}>
        <Button
          disabled={history.page <= 1}
          onPress={() => history.setPage(history.page - 1)}
        >
          上一页
        </Button>
        <Button
          disabled={history.page >= history.pages}
          onPress={() => history.setPage(history.page + 1)}
        >
          下一页
        </Button>
      </View>
    </>
  );
}
