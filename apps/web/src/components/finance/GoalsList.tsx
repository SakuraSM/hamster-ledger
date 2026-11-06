import { Button, Group, Text, Stack, Progress } from "@mantine/core";
import { useState } from "react";
import { PlanningActionConfirm } from "./PlanningActionConfirm";
import { money, type Ledger } from "@hamster-ledger/core";
import {
  goalForm,
  allocationForm,
  type PlanningPanelController,
} from "@hamster-ledger/ledger-react";
import { localNow, newEntityId } from "../../platform/browser/runtime";
const DATE_KEY_LENGTH = 10;
const PERCENT_SCALE = 100;

export function GoalsList({
  ledger,
  panel,
}: {
  ledger: Ledger;
  panel: PlanningPanelController;
}): React.JSX.Element {
  const isHidden = Boolean(ledger.preferences?.hideAmounts);
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    name: string;
    isArchived: boolean;
  } | null>(null);
  const amount = (minor: number): string =>
    isHidden ? "••••" : `¥${money(minor)}`;
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
              已分配 {amount(allocated)} / {amount(item.target)}
              {item.dueDate ? ` · ${item.dueDate} 截止` : ""}
            </Text>
            {!isHidden ? (
              <Progress
                value={Math.min(
                  PERCENT_SCALE,
                  (allocated / item.target) * PERCENT_SCALE,
                )}
                aria-label={`${item.name} 进度`}
              />
            ) : null}
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
                        localNow().slice(0, DATE_KEY_LENGTH),
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
                  setArchiveTarget({
                    id: item.id,
                    name: item.name,
                    isArchived: item.isArchived,
                  })
                }
              >
                {item.isArchived ? "恢复展示" : "归档目标"}
              </Button>
            </Group>
            <details>
              <summary>资金分配记录</summary>
              {item.allocations.map((allocation) => (
                <p key={allocation.id}>
                  {allocation.date} · {amount(allocation.amount)}
                  {allocation.recordId ? " · 已关联转账" : ""}
                </p>
              ))}
            </details>
          </article>
        );
      })}
      {archiveTarget ? (
        <PlanningActionConfirm
          title={archiveTarget.isArchived ? "恢复目标" : "归档目标"}
          description={
            archiveTarget.isArchived
              ? `恢复“${archiveTarget.name}”的展示。`
              : `归档“${archiveTarget.name}”后保留分配记录，可随时恢复。`
          }
          confirmLabel={archiveTarget.isArchived ? "确认恢复" : "确认归档"}
          isBusy={panel.isBusy}
          onClose={() => setArchiveTarget(null)}
          onConfirm={async () => {
            await panel.commit((current) => ({
              ...current,
              goals: current.goals?.map((goal) =>
                goal.id === archiveTarget.id
                  ? { ...goal, isArchived: !archiveTarget.isArchived }
                  : goal,
              ),
            }));
            setArchiveTarget(null);
          }}
        />
      ) : null}
    </Stack>
  );
}
