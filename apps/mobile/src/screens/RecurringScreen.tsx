import { useState } from "react";
import { Button, Card, Text } from "react-native-paper";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { money, type RecurringRule } from "@hamster-ledger/core";
import { Screen, ErrorMessage } from "../ui/Screen";
import { RecurringEditor } from "./RecurringEditor";
interface RecurringScreenProps {
  controller: LedgerController;
}
const FREQUENCY_LABEL = {
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年",
};
export function RecurringScreen({
  controller,
}: RecurringScreenProps): React.JSX.Element {
  const [editor, setEditor] = useState<RecurringRule | "new" | null>(null);
  const [error, setError] = useState("");
  async function pause(rule: RecurringRule): Promise<void> {
    try {
      await controller.commit({
        ...controller.ledger,
        recurringRules: controller.ledger.recurringRules?.map((item) =>
          item.id === rule.id ? { ...item, isPaused: !item.isPaused } : item,
        ),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新规则失败");
    }
  }
  return (
    <>
      <Screen>
        <Text variant="headlineSmall" accessibilityRole="header">
          周期记账
        </Text>
        <Text>
          在账本打开时补齐到期账单。同一次周期只生成一笔，暂停后保留历史账单。
        </Text>
        <Button mode="contained" icon="plus" onPress={() => setEditor("new")}>
          新增周期规则
        </Button>
        <ErrorMessage message={error} />
        {controller.ledger.recurringRules?.map((rule) => (
          <Card key={rule.id} mode="outlined">
            <Card.Content>
              <Text variant="titleMedium">
                {rule.name}
                {rule.isPaused ? " · 已暂停" : ""}
              </Text>
              <Text>
                {FREQUENCY_LABEL[rule.frequency]} · {rule.kind} ¥
                {money(rule.amount)}
              </Text>
              <Text>
                {rule.startDate} 至 {rule.endDate || "长期"}
              </Text>
              <Button onPress={() => setEditor(rule)}>编辑规则</Button>
              <Button
                disabled={controller.isSaving}
                onPress={() => void pause(rule)}
              >
                {rule.isPaused ? "恢复规则" : "暂停规则"}
              </Button>
            </Card.Content>
          </Card>
        ))}
      </Screen>
      {editor ? (
        <RecurringEditor
          controller={controller}
          rule={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </>
  );
}
