import { Button, Text, ProgressBar, List } from "react-native-paper";
import { money, type Ledger } from "@hamster-ledger/core";
import {
  goalForm,
  allocationForm,
  type PlanningPanelController,
} from "@hamster-ledger/ledger-react";
import { localNow, newEntityId } from "../platform/runtime";
import { Section } from "../ui/Screen";
export function GoalsList({
  ledger,
  panel,
}: {
  ledger: Ledger;
  panel: PlanningPanelController;
}): React.JSX.Element {
  return (
    <>
      <Button
        mode="contained"
        onPress={() => panel.setForm(goalForm(ledger, newEntityId()))}
      >
        新建储蓄目标
      </Button>
      <Text>分配资金只调整目标进度，实际转账可关联已有流水。</Text>
      {ledger.goals?.map((item) => {
        const allocated = item.allocations.reduce(
          (sum, value) => sum + value.amount,
          0,
        );
        return (
          <Section
            key={item.id}
            title={`${item.name}${item.isArchived ? " · 已归档" : ""}`}
          >
            <Text>
              已分配 ¥{money(allocated)} / ¥{money(item.target)}
              {item.dueDate ? ` · ${item.dueDate} 截止` : ""}
            </Text>
            <ProgressBar progress={Math.min(1, allocated / item.target)} />
            <Button
              onPress={() => panel.setForm(goalForm(ledger, item.id, item))}
            >
              编辑目标
            </Button>
            {!item.isArchived ? (
              <Button
                onPress={() =>
                  panel.setForm(
                    allocationForm(
                      ledger,
                      item,
                      newEntityId(),
                      localNow().slice(0, 10),
                    ),
                  )
                }
              >
                分配 / 取出资金
              </Button>
            ) : null}
            <Button
              onPress={() =>
                void panel.commit((current) => ({
                  ...current,
                  goals: current.goals?.map((goal) =>
                    goal.id === item.id
                      ? { ...goal, isArchived: !goal.isArchived }
                      : goal,
                  ),
                }))
              }
            >
              {item.isArchived ? "恢复展示" : "归档目标"}
            </Button>
            <List.Accordion title="资金分配记录">
              {item.allocations.map((allocation) => (
                <List.Item
                  key={allocation.id}
                  title={`${allocation.date} · ¥${money(allocation.amount)}`}
                  description={allocation.recordId ? "已关联转账" : undefined}
                />
              ))}
            </List.Accordion>
          </Section>
        );
      })}
    </>
  );
}
