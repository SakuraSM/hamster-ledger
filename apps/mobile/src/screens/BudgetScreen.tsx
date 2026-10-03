import { MONTH_KEY_LENGTH, CENTS_PER_YUAN } from "../constants";
import { useState } from "react";
import { Button, Card, ProgressBar, Text, TextInput } from "react-native-paper";
import {
  budgetProgress,
  categoryNames,
  money,
  saveBudget,
} from "@hamster-ledger/core";
import { parseAmount } from "@hamster-ledger/importers";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { Screen, ErrorMessage, Section } from "../ui/Screen";
import { ChoiceField } from "../ui/ChoiceField";
import { DateField } from "../ui/DateField";
import { localNow, newEntityId } from "../platform/runtime";
interface BudgetScreenProps {
  controller: LedgerController;
}
export function BudgetScreen({
  controller,
}: BudgetScreenProps): React.JSX.Element {
  const [month, setMonth] = useState(localNow().slice(0, MONTH_KEY_LENGTH));
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const budgets = budgetProgress(controller.ledger, month);
  async function save(): Promise<void> {
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) {
      setError("预算金额需大于零，最多两位小数。");
      return;
    }
    try {
      await controller.commit(
        saveBudget(controller.ledger, {
          id: newEntityId(),
          month,
          category: category || null,
          amount: cents,
        }),
      );
      setAmount("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存预算失败");
    }
  }
  async function remove(id: string): Promise<void> {
    try {
      await controller.commit({
        ...controller.ledger,
        budgets: controller.ledger.budgets?.filter(
          (budget) => budget.id !== id,
        ),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败");
    }
  }
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        预算管理
      </Text>
      <DateField
        label="预算月份"
        value={month + "-01"}
        onChange={(value) => setMonth(value.slice(0, MONTH_KEY_LENGTH))}
      />
      {budgets.map((budget) => (
        <Card key={budget.id} mode="outlined">
          <Card.Content style={{ gap: 10 }}>
            <Text variant="titleMedium">
              {budget.category ?? "总预算"} · ¥{money(budget.amount)}
            </Text>
            <ProgressBar
              progress={Math.min(1, budget.ratio)}
              color={budget.remaining < 0 ? "#a43222" : undefined}
            />
            <Text>
              已用 ¥{money(budget.spent)} ·{" "}
              {budget.remaining >= 0 ? "剩余" : "超出"} ¥
              {money(Math.abs(budget.remaining))}
            </Text>
            <Button
              onPress={() => {
                setCategory(budget.category ?? "");
                setAmount(String(budget.amount / CENTS_PER_YUAN));
              }}
            >
              调整金额
            </Button>
            <Button
              disabled={controller.isSaving}
              onPress={() => void remove(budget.id)}
            >
              删除预算
            </Button>
          </Card.Content>
        </Card>
      ))}
      <Section title="设置预算">
        <ChoiceField
          label="预算范围"
          value={category}
          options={[
            { value: "", label: "总预算" },
            ...categoryNames(controller.ledger, "支出").map((value) => ({
              value,
              label: value,
            })),
          ]}
          onChange={setCategory}
        />
        <TextInput
          accessibilityLabel="预算金额（元）"
          mode="outlined"
          label="预算金额（元）"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <ErrorMessage message={error} />
        <Button
          mode="contained"
          loading={controller.isSaving}
          disabled={controller.isSaving}
          onPress={() => void save()}
        >
          保存预算
        </Button>
      </Section>
    </Screen>
  );
}
