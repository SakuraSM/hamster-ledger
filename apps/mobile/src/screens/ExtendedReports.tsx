import { AmountText } from "../ui/AmountText";
import { useState } from "react";
import { Button, Text } from "react-native-paper";
import {
  categoryBreakdown,
  memberExpenses,
  money,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { useBookMembers } from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { Section } from "../ui/Screen";
export function ExtendedReports({
  ledger,
  records,
  kind,
  bookId,
}: {
  ledger: Ledger;
  records: BillRecord[];
  kind: "支出" | "收入";
  bookId?: string;
}): React.JSX.Element {
  const { client } = useNativeAccount();
  const members = useBookMembers(client, bookId);
  const [parentId, setParent] = useState<string>();
  const categories = categoryBreakdown({ ledger, records, kind, parentId }),
    shares = memberExpenses(ledger, records);
  return (
    <>
      <Section title="分类层级">
        {parentId ? (
          <Button onPress={() => setParent(undefined)}>返回一级分类</Button>
        ) : null}
        {categories.map((item) =>
          item.hasChildren ? (
            <Button key={item.id} onPress={() => setParent(item.id)}>
              {item.name} ·{" "}
              <AmountText
                variant="labelLarge"
                amount={item.amount}
                tone={kind === "支出" ? "expense" : "income"}
              >
                ¥{money(item.amount)}
              </AmountText>{" "}
              · 查看子分类
            </Button>
          ) : (
            <Text key={item.id}>
              {item.name} ·{" "}
              <AmountText
                amount={item.amount}
                tone={kind === "支出" ? "expense" : "income"}
              >
                ¥{money(item.amount)}
              </AmountText>
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
            ·{" "}
            <AmountText amount={item.amount} tone="expense">
              ¥{money(item.amount)}
            </AmountText>
          </Text>
        ))}
        {!shares.length ? <Text>当前范围没有支出。</Text> : null}
      </Section>
    </>
  );
}
