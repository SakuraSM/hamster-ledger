import { Button, Group, Text, Stack, Badge } from "@mantine/core";
import { useState } from "react";
import { PlanningActionConfirm } from "./PlanningActionConfirm";
import {
  saveSubscription,
  skipSubscription,
  subscriptionCost,
  formatCurrency,
  type Ledger,
  type Currency,
  type Subscription,
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
const DATE_KEY_LENGTH = 10;

export function SubscriptionsList({
  ledger,
  panel,
}: {
  ledger: Ledger;
  panel: PlanningPanelController;
}): React.JSX.Element {
  const today = localNow().slice(0, DATE_KEY_LENGTH);
  const isHidden = Boolean(ledger.preferences?.hideAmounts);
  const [confirmation, setConfirmation] = useState<{
    item: Subscription;
    action: "skip" | "cancel" | "archive";
  } | null>(null);
  const amount = (minor: number, currency: Currency): string =>
    isHidden ? "••••" : formatCurrency({ minor, currency });
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
              {amount(item.amount, item.currency)} / 期 · 下次 {item.nextDate}
            </Text>
            <Text size="sm">
              月均 {amount(cost.monthly, item.currency)} · 年化{" "}
              {amount(cost.annual, item.currency)} ·{" "}
              {item.autoPost ? "自动记账" : "仅提醒"}
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
                    onClick={() => setConfirmation({ item, action: "skip" })}
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
                  onClick={() => setConfirmation({ item, action: "cancel" })}
                >
                  取消订阅
                </Button>
              ) : null}
              <Button
                variant="subtle"
                onClick={() => setConfirmation({ item, action: "archive" })}
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
                    {record.date.slice(0, DATE_KEY_LENGTH)} ·{" "}
                    {record.isDeleted ? "已移入回收站 · " : ""}
                    {isHidden
                      ? "••••"
                      : formatCurrency(record.detail!.original)}
                  </p>
                ))}
            </details>
          </article>
        );
      })}
      {confirmation ? (
        <PlanningActionConfirm
          title={
            confirmation.action === "skip"
              ? "跳过本期"
              : confirmation.action === "cancel"
                ? "取消订阅"
                : confirmation.item.isArchived
                  ? "恢复订阅展示"
                  : "归档订阅"
          }
          description={
            confirmation.action === "skip"
              ? `跳过“${confirmation.item.name}”的 ${confirmation.item.nextDate} 这一期，不会删除历史扣费。`
              : confirmation.action === "cancel"
                ? `取消“${confirmation.item.name}”后不再按此订阅自动记账，历史扣费会保留。`
                : confirmation.item.isArchived
                  ? `恢复“${confirmation.item.name}”的展示。`
                  : `归档“${confirmation.item.name}”后停止展示，历史扣费会保留，可随时恢复。`
          }
          confirmLabel={
            confirmation.action === "skip"
              ? "确认跳过"
              : confirmation.action === "cancel"
                ? "确认取消订阅"
                : confirmation.item.isArchived
                  ? "确认恢复"
                  : "确认归档"
          }
          isBusy={panel.isBusy}
          onClose={() => setConfirmation(null)}
          onConfirm={async () => {
            await panel.commit((current) => {
              if (confirmation.action === "skip")
                return skipSubscription(current, confirmation.item.id);
              const latest = current.subscriptions?.find(
                (item) => item.id === confirmation.item.id,
              );
              if (!latest) throw new Error("订阅已不存在，请刷新后重试。");
              return saveSubscription(current, {
                ...latest,
                ...(confirmation.action === "cancel"
                  ? { status: "canceled" as const }
                  : { isArchived: !confirmation.item.isArchived }),
              });
            });
            setConfirmation(null);
          }}
        />
      ) : null}
    </Stack>
  );
}
