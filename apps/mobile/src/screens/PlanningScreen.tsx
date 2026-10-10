import { Button, Text } from "react-native-paper";
import {
  PLANNING_TABS,
  usePlanningPanel,
  type LedgerController,
  type PlanningTab,
} from "@hamster-ledger/ledger-react";
import { ChoiceField } from "../ui/ChoiceField";
import { Screen, Section, ErrorMessage } from "../ui/Screen";
import { FinanceFormSheet } from "./FinanceFormSheet";
import { SubscriptionsList } from "./SubscriptionsList";
import { DebtsList } from "./DebtsList";
import { GoalsList } from "./GoalsList";
export function PlanningScreen({
  controller,
  initialTab,
}: {
  controller: LedgerController;
  initialTab?: PlanningTab;
}): React.JSX.Element {
  const panel = usePlanningPanel(controller, initialTab),
    ledger = controller.ledger;
  const unread =
    ledger.notifications?.filter((item) => !item.isRead).length ?? 0;
  return (
    <>
      <Screen>
        <Text variant="headlineSmall">生活计划与提醒</Text>
        <ChoiceField
          label="查看内容"
          value={panel.tab}
          options={Object.entries(PLANNING_TABS).map(([value, label]) => ({
            value,
            label: value === "notifications" ? `${label}（${unread}）` : label,
          }))}
          onChange={(value) => panel.setTab(value as PlanningTab)}
        />
        <ErrorMessage message={panel.error} />
        {panel.tab === "subscriptions" ? (
          <SubscriptionsList ledger={ledger} panel={panel} />
        ) : panel.tab === "debts" ? (
          <DebtsList ledger={ledger} panel={panel} />
        ) : panel.tab === "goals" ? (
          <GoalsList ledger={ledger} panel={panel} />
        ) : (
          <>
            <Button
              disabled={!unread}
              onPress={() =>
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
              <Section
                key={item.id}
                title={`${item.title}${item.isRead ? " · 已读" : ""}`}
              >
                <Text>{item.body}</Text>
                <Text>{item.date}</Text>
                {!item.isRead ? (
                  <Button
                    onPress={() =>
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
              </Section>
            ))}
          </>
        )}
      </Screen>
      {panel.form ? (
        <FinanceFormSheet
          form={panel.form}
          ledger={ledger}
          onSave={async (next) => {
            await controller.commit(next);
            controller.notify("计划已保存，可撤销本次修改。");
          }}
          onClose={() => panel.setForm(null)}
        />
      ) : null}
    </>
  );
}
