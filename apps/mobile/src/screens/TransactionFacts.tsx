import { Text } from "react-native-paper";
import {
  TRANSACTION_LABELS,
  formatCurrency,
  money,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { useBookMembers } from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { Section } from "../ui/Screen";
export function TransactionFacts({
  record,
  ledger,
  bookId,
}: {
  record: BillRecord;
  ledger: Ledger;
  bookId?: string;
}): React.JSX.Element | null {
  const members = useBookMembers(useNativeAccount().client, bookId),
    detail = record.detail;
  if (!detail || detail.origin === "legacy") return null;
  const memberName = (id: string): string =>
    members.find((item) => item.id === id)?.username ?? id;
  return (
    <Section title={TRANSACTION_LABELS[detail.type]}>
      <Text>原币金额：{formatCurrency(detail.original)}</Text>
      {detail.original.currency !== "CNY" ? (
        <Text>
          1 {detail.original.currency} = ¥{detail.original.rate} ·{" "}
          {detail.original.date} ·{" "}
          {detail.original.source === "manual" ? "手动汇率" : "参考汇率"}
        </Text>
      ) : null}
      {detail.destination ? (
        <Text>实际转入：{formatCurrency(detail.destination)}</Text>
      ) : null}
      {detail.relatedId ? (
        <Text>
          关联原支出：
          {ledger.records.find((item) => item.id === detail.relatedId)
            ?.merchant ?? "历史记录"}
        </Text>
      ) : null}
      {detail.isReimbursable ? <Text>待报销支出，回款请关联本笔。</Text> : null}
      {detail.memberId ? (
        <Text>记账成员：{memberName(detail.memberId)}</Text>
      ) : null}
      {detail.splits.map((split) => (
        <Text key={split.memberId}>
          {memberName(split.memberId)} 承担 ¥{money(split.amount)}
        </Text>
      ))}
    </Section>
  );
}
