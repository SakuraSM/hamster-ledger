import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import {
  PLANNING_TABS,
  usePlanningPanel,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { FinanceFormDialog } from "./FinanceFormDialog";
import { SubscriptionsList } from "./SubscriptionsList";
import { DebtsList } from "./DebtsList";
import { GoalsList } from "./GoalsList";
export function PlanningPanel({
  controller,
}: {
  controller: LedgerController;
}): React.JSX.Element {
  const panel = usePlanningPanel(controller),
    ledger = controller.ledger;
  const unread =
    ledger.notifications?.filter((item) => !item.isRead).length ?? 0;
  return (
    <section className="panel" style={{ gridColumn: "1 / -1" }}>
      <Stack>
        <h2>生活计划与提醒</h2>
        <Group>
          {Object.entries(PLANNING_TABS).map(([value, label]) => (
            <Button
              key={value}
              variant={panel.tab === value ? "filled" : "outline"}
              onClick={() => panel.setTab(value as typeof panel.tab)}
            >
              {label}
              {value === "notifications" && unread ? `（${unread}）` : ""}
            </Button>
          ))}
        </Group>
        {panel.error ? (
          <Alert color="red" role="alert">
            {panel.error}
          </Alert>
        ) : null}
        {panel.tab === "subscriptions" ? (
          <SubscriptionsList ledger={ledger} panel={panel} />
        ) : panel.tab === "debts" ? (
          <DebtsList ledger={ledger} panel={panel} />
        ) : panel.tab === "goals" ? (
          <GoalsList ledger={ledger} panel={panel} />
        ) : (
          <>
            <Button
              variant="outline"
              disabled={!unread}
              onClick={() =>
                void panel.commit((current) => ({
                  ...current,
                  notifications: current.notifications?.map((item) => ({
                    ...item,
                    isRead: true,
                  })),
                }))
              }
            >
              全部标为已读
            </Button>
            {!ledger.notifications?.length ? <Text>暂时没有提醒。</Text> : null}
            {[...(ledger.notifications ?? [])].reverse().map((item) => (
              <article className="panel" key={item.id}>
                <h3>
                  {item.title}
                  {item.isRead ? " · 已读" : ""}
                </h3>
                <Text>{item.body}</Text>
                <Text size="sm">{item.date}</Text>
                {!item.isRead ? (
                  <Button
                    variant="subtle"
                    onClick={() =>
                      void panel.commit((current) => ({
                        ...current,
                        notifications: current.notifications?.map((notice) =>
                          notice.id === item.id
                            ? { ...notice, isRead: true }
                            : notice,
                        ),
                      }))
                    }
                  >
                    标为已读
                  </Button>
                ) : null}
              </article>
            ))}
          </>
        )}
      </Stack>
      {panel.form ? (
        <FinanceFormDialog
          form={panel.form}
          ledger={ledger}
          onSave={async (next) => {
            await controller.commit(next);
            controller.notify("计划已保存，可撤销本次修改。");
          }}
          onClose={() => panel.setForm(null)}
        />
      ) : null}
    </section>
  );
}
