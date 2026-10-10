import { TextInput, Button, Checkbox } from "@mantine/core";
import { Choice } from "../../ui/Choice";
import { DateField } from "../../ui/DateField";
const CENTS_PER_YUAN = 100;
import { useState } from "react";
import {
  BUDGET_PERIODS,
  type Budget,
  budgetProgress,
  categoryNames,
  cycleRange,
  money,
  saveBudget,
  type Ledger,
} from "@hamster-ledger/core";
import { parseAmount } from "@hamster-ledger/importers";
import { newEntityId } from "../../platform/browser/runtime";
interface Props {
  ledger: Ledger;
  month: string;
  onMonth: (month: string) => void;
  onCommit: (ledger: Ledger) => Promise<void>;
}
export function BudgetPage({
  ledger,
  month,
  onMonth,
  onCommit,
}: Props): React.JSX.Element {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] =
    useState<NonNullable<Budget["period"]>>("monthly");
  const [rollover, setRollover] = useState(false);
  const [threshold, setThreshold] = useState("80");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const budgets = budgetProgress(ledger, month);
  const range = cycleRange(month, ledger.preferences?.cycleStartDay ?? 1);
  async function save(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    try {
      const cents = parseAmount(amount);
      if (!cents || cents <= 0) throw new Error("预算应大于零。");
      await onCommit(
        saveBudget(ledger, {
          id: newEntityId(),
          month,
          category: category || null,
          amount: cents,
          period,
          rollover,
          alertPercent: Number(threshold),
        }),
      );
      setAmount("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  async function remove(id: string): Promise<void> {
    try {
      await onCommit({
        ...ledger,
        budgets: ledger.budgets?.filter((item) => item.id !== id),
      });
    } catch {
      setError("删除预算失败。");
    }
  }
  return (
    <section className="planning-page">
      <div className="page-heading">
        <h1>给生活留一点余量</h1>
        <p>按账期规划支出，退款会抵扣已用预算。</p>
      </div>
      <DateField
        label={<>预算月份</>}
        className="inline-field"
        type="month"
        value={month}
        onChange={(value) => value && onMonth(value)}
      />
      <p className="muted">
        账期 {range.start} 至 {range.end}（不含结束日）
      </p>
      <form className="panel inline-form" onSubmit={save}>
        <Choice
          label="预算周期"
          value={period}
          onChange={(value) => setPeriod(value as typeof period)}
        >
          {Object.entries(BUDGET_PERIODS).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </Choice>
        <Checkbox
          label="结转上期未使用预算"
          checked={rollover}
          onChange={(event) => setRollover(event.currentTarget.checked)}
        />
        <TextInput
          label="提醒阈值（1–100%）"
          value={threshold}
          onChange={(event) => setThreshold(event.currentTarget.value)}
          inputMode="numeric"
        />
        <Choice
          label={<>预算范围</>}
          value={category}
          onChange={(value) => setCategory(value)}
        >
          <option value="">总预算</option>
          {categoryNames(ledger, "支出").map((name) => (
            <option key={name}>{name}</option>
          ))}
        </Choice>
        <TextInput
          label={<>预算金额（元）</>}
          required
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="如：3000"
        />
        <Button
          variant="filled"
          type="submit"
          className="primary-button"
          disabled={isSaving}
        >
          保存预算
        </Button>
      </form>
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
      <div className="budget-grid">
        {budgets.map((budget) => (
          <article className="panel budget-card" key={budget.id}>
            <div className="section-heading">
              <h2>
                {BUDGET_PERIODS[budget.period ?? "monthly"]} ·{" "}
                {budget.category ?? "总预算"}
              </h2>
              <Button
                variant="subtle"
                type="submit"
                className="text-button"
                onClick={() => void remove(budget.id)}
              >
                删除
              </Button>
            </div>
            <p className="muted">
              {budget.start} 至 {budget.end}（不含结束日）
            </p>
            <strong>
              ¥ {money(budget.remaining)}
              <small>{budget.remaining < 0 ? " 超出预算" : " 剩余"}</small>
            </strong>
            <progress
              max={budget.available}
              value={Math.min(budget.spent, budget.available)}
              aria-label={`${budget.category ?? "整月"}预算已用`}
            />
            <p>
              已用 ¥{money(budget.spent)} / ¥{money(budget.available)} · 结转 ¥
              {money(budget.carried)}
            </p>
            <Button
              variant="outline"
              type="submit"
              className="secondary-button"
              onClick={() => {
                setCategory(budget.category ?? "");
                setAmount(String(budget.amount / CENTS_PER_YUAN));
                setPeriod(budget.period ?? "monthly");
                setRollover(budget.rollover ?? false);
                setThreshold(String(budget.alertPercent ?? 80));
              }}
            >
              调整预算
            </Button>
          </article>
        ))}
      </div>
      {!budgets.length ? (
        <div className="empty-panel">
          这个账期还没有预算，先设一个合适的金额。
        </div>
      ) : null}
    </section>
  );
}
