import { Button, Group, Text, Stack, Progress } from "@mantine/core";
import { money, type Ledger } from "@hamster-ledger/core";
import {
  goalForm,
  allocationForm,
  type PlanningPanelController,
} from "@hamster-ledger/ledger-react";
import { localNow, newEntityId } from "../../platform/browser/runtime";
export function GoalsList({
  ledger,
  panel,
}: {
  ledger: Ledger;
  panel: PlanningPanelController;
}): React.JSX.Element {
  return (
    <Stack>
      <Button onClick={() => panel.setForm(goalForm(ledger, newEntityId()))}>
        新建储蓄目标
      </Button>
      <Text size="sm">分配资金只调整目标进度，实际转账可关联已有流水。</Text>
      {ledger.goals?.map((item) => {
        const allocated = item.allocations.reduce(
          (sum, value) => sum + value.amount,
          0,
        );
        return (
          <article className="panel" key={item.id}>
            <h3>
              {item.name}
              {item.isArchived ? " · 已归档" : ""}
            </h3>
            <Text>
              已分配 ¥{money(allocated)} / ¥{money(item.target)}
              {item.dueDate ? ` · ${item.dueDate} 截止` : ""}
            </Text>
            <Progress
              value={Math.min(100, (allocated / item.target) * 100)}
              aria-label={`${item.name} 进度`}
            />
            <Group mt="sm">
              <Button
                variant="outline"
                onClick={() => panel.setForm(goalForm(ledger, item.id, item))}
              >
                编辑目标
              </Button>
              {!item.isArchived ? (
                <Button
                  variant="outline"
                  onClick={() =>
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
                variant="subtle"
                onClick={() =>
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
            </Group>
            <details>
              <summary>资金分配记录</summary>
              {item.allocations.map((allocation) => (
                <p key={allocation.id}>
                  {allocation.date} · ¥{money(allocation.amount)}
                  {allocation.recordId ? " · 已关联转账" : ""}
                </p>
              ))}
            </details>
          </article>
        );
      })}
    </Stack>
  );
}
