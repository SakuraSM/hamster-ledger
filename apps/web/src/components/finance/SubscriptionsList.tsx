import { Button, Group, Text, Stack, Badge } from "@mantine/core";
import {
  saveSubscription,
  skipSubscription,
  subscriptionCost,
  formatCurrency,
  type Ledger,
} from "@hamster-ledger/core";
import {
  subscriptionForm,
  subscriptionChargeForm,
  type PlanningPanelController,
} from "@hamster-ledger/ledger-react";
import { localNow, newEntityId } from "../../platform/browser/runtime";
const STATUS = {
  active: "使用中",
  trial: "试用中",
  paused: "已暂停",
  canceled: "已取消",
};
export function SubscriptionsList({
  ledger,
  panel,
}: {
  ledger: Ledger;
  panel: PlanningPanelController;
}): React.JSX.Element {
  const today = localNow().slice(0, 10);
  return (
    <Stack>
      <Button
        onClick={() =>
          panel.setForm(subscriptionForm(ledger, newEntityId(), today))
        }
      >
        新增订阅
      </Button>
      {!ledger.subscriptions?.length ? (
        <Text>记录固定服务费用，到期提醒，按需开启自动记账。</Text>
      ) : null}
      {ledger.subscriptions?.map((item) => {
        const cost = subscriptionCost(item);
        return (
          <article className="panel" key={item.id}>
            <Group justify="space-between">
              <h3>{item.name}</h3>
              <Badge>{item.isArchived ? "已归档" : STATUS[item.status]}</Badge>
            </Group>
            <Text>
              {formatCurrency({ minor: item.amount, currency: item.currency })}{" "}
              / 期 · 下次 {item.nextDate}
            </Text>
            <Text size="sm">
              月均{" "}
              {formatCurrency({ minor: cost.monthly, currency: item.currency })}{" "}
              · 年化{" "}
              {formatCurrency({ minor: cost.annual, currency: item.currency })}{" "}
              · {item.autoPost ? "自动记账" : "仅提醒"}
            </Text>
            <Group mt="sm">
              <Button
                variant="outline"
                onClick={() =>
                  panel.setForm(subscriptionForm(ledger, item.id, today, item))
                }
              >
                编辑
              </Button>
              {!item.isArchived &&
              !["paused", "canceled"].includes(item.status) ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => panel.setForm(subscriptionChargeForm(item))}
                  >
                    记录本期扣费
                  </Button>
                  <Button
                    variant="subtle"
                    onClick={() =>
                      void panel.commit((current) =>
                        skipSubscription(current, item.id),
                      )
                    }
                  >
                    跳过本期
                  </Button>
                </>
              ) : null}
              {item.status !== "canceled" ? (
                <Button
                  variant="subtle"
                  onClick={() =>
                    void panel.commit((current) =>
                      saveSubscription(current, {
                        ...item,
                        status: item.status === "paused" ? "active" : "paused",
                        nextDate:
                          item.status === "paused" && item.nextDate < today
                            ? today
                            : item.nextDate,
                      }),
                    )
                  }
                >
                  {item.status === "paused" ? "恢复订阅" : "暂停订阅"}
                </Button>
              ) : null}
              {item.status !== "canceled" ? (
                <Button
                  variant="subtle"
                  color="red"
                  onClick={() =>
                    void panel.commit((current) =>
                      saveSubscription(current, {
                        ...item,
                        status: "canceled",
                      }),
                    )
                  }
                >
                  取消订阅
                </Button>
              ) : null}
              <Button
                variant="subtle"
                onClick={() =>
                  void panel.commit((current) =>
                    saveSubscription(current, {
                      ...item,
                      isArchived: !item.isArchived,
                    }),
                  )
                }
              >
                {item.isArchived ? "恢复展示" : "归档"}
              </Button>
            </Group>
            <details>
              <summary>历史扣费</summary>
              {ledger.records
                .filter((record) => record.detail?.subscriptionId === item.id)
                .map((record) => (
                  <p key={record.id}>
                    {record.date.slice(0, 10)} ·{" "}
                    {record.isDeleted ? "已移入回收站 · " : ""}
                    {formatCurrency(record.detail!.original)}
                  </p>
                ))}
            </details>
          </article>
        );
      })}
    </Stack>
  );
}
