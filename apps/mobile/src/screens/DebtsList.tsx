import { Button, Text, List } from "react-native-paper";
import {
  debtRemaining,
  formatCurrency,
  type Ledger,
} from "@hamster-ledger/core";
import {
  debtForm,
  repaymentForm,
  type PlanningPanelController,
} from "@hamster-ledger/ledger-react";
import { localNow, newEntityId } from "../platform/runtime";
import { Section } from "../ui/Screen";
export function DebtsList({
  ledger,
  panel,
}: {
  ledger: Ledger;
  panel: PlanningPanelController;
}): React.JSX.Element {
  const today = localNow().slice(0, 10);
  return (
    <>
      <Button
        mode="contained"
        onPress={() => panel.setForm(debtForm(ledger, newEntityId(), today))}
      >
        新增借贷
      </Button>
      <Text>本金在收付款账户和应收 / 应付账户之间转移，利息单列。</Text>
      {ledger.debts?.map((item) => (
        <Section
          key={item.id}
          title={`${item.name} · ${item.direction === "receivable" ? "应收" : "应付"}${item.isArchived ? " · 已归档" : ""}`}
        >
          <Text>
            剩余本金{" "}
            {formatCurrency({
              minor: debtRemaining(ledger, item),
              currency: item.currency,
            })}{" "}
            /{" "}
            {formatCurrency({ minor: item.principal, currency: item.currency })}
          </Text>
          <Text>
            {item.openedOn} 起 ·{" "}
            {item.dueDate ? `${item.dueDate} 到期` : "未设置到期日"}
          </Text>
          {!item.isArchived && debtRemaining(ledger, item) > 0 ? (
            <Button
              onPress={() =>
                panel.setForm(repaymentForm(item, newEntityId(), today))
              }
            >
              {item.direction === "receivable" ? "收回借款" : "偿还借款"}
            </Button>
          ) : null}
          <Button
            onPress={() =>
              void panel.commit((current) => ({
                ...current,
                debts: current.debts?.map((debt) =>
                  debt.id === item.id
                    ? { ...debt, isArchived: !debt.isArchived }
                    : debt,
                ),
              }))
            }
          >
            {item.isArchived ? "恢复展示" : "归档台账"}
          </Button>
          <List.Accordion title="关联流水">
            {ledger.records
              .filter((record) => record.detail?.debtId === item.id)
              .map((record) => (
                <List.Item
                  key={record.id}
                  title={`${record.date.slice(0, 10)} · ${record.merchant}`}
                  description={`${record.isDeleted ? "已删除 · " : ""}${formatCurrency(record.detail!.original)}`}
                />
              ))}
          </List.Accordion>
        </Section>
      ))}
    </>
  );
}
