import { Button, Text, List } from "react-native-paper";
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
import { localNow, newEntityId } from "../platform/runtime";
import { Section } from "../ui/Screen";
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
    <>
      <Button
        mode="contained"
        onPress={() =>
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
          <Section
            key={item.id}
            title={`${item.name} · ${item.isArchived ? "已归档" : STATUS[item.status]}`}
          >
            <Text>
              {formatCurrency({ minor: item.amount, currency: item.currency })}{" "}
              / 期 · 下次 {item.nextDate}
            </Text>
            <Text>
              月均{" "}
              {formatCurrency({ minor: cost.monthly, currency: item.currency })}{" "}
              · 年化{" "}
              {formatCurrency({ minor: cost.annual, currency: item.currency })}{" "}
              · {item.autoPost ? "自动记账" : "仅提醒"}
            </Text>
            <Button
              onPress={() =>
                panel.setForm(subscriptionForm(ledger, item.id, today, item))
              }
            >
              编辑订阅
            </Button>
            {!item.isArchived &&
            !["paused", "canceled"].includes(item.status) ? (
              <>
                <Button
                  onPress={() => panel.setForm(subscriptionChargeForm(item))}
                >
                  记录本期扣费
                </Button>
                <Button
                  onPress={() =>
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
                onPress={() =>
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
                onPress={() =>
                  void panel.commit((current) =>
                    saveSubscription(current, { ...item, status: "canceled" }),
                  )
                }
              >
                取消订阅
              </Button>
            ) : null}
            <Button
              onPress={() =>
                void panel.commit((current) =>
                  saveSubscription(current, {
                    ...item,
                    isArchived: !item.isArchived,
                  }),
                )
              }
            >
              {item.isArchived ? "恢复展示" : "归档订阅"}
            </Button>
            <List.Accordion title="历史扣费">
              {ledger.records
                .filter((record) => record.detail?.subscriptionId === item.id)
                .map((record) => (
                  <List.Item
                    key={record.id}
                    title={`${record.date.slice(0, 10)} · ${formatCurrency(record.detail!.original)}`}
                    description={record.isDeleted ? "已移入回收站" : undefined}
                  />
                ))}
            </List.Accordion>
          </Section>
        );
      })}
    </>
  );
}
