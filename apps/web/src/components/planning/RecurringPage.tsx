import { Button } from "@mantine/core";
const DATE_KEY_LENGTH = 10;
import { useState } from "react";
import {
  applyRecurring,
  defaultCategory,
  money,
  saveRecurring,
  type Ledger,
  type RecurringRule,
} from "@hamster-ledger/core";
import { localNow, newEntityId } from "../../platform/browser/runtime";
import { RecurringEditor } from "./RecurringEditor";
import { FREQUENCIES } from "./recurring-config";
interface Props {
  ledger: Ledger;
  onCommit: (ledger: Ledger) => Promise<void>;
}
export function RecurringPage({ ledger, onCommit }: Props): React.JSX.Element {
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [error, setError] = useState("");
  function add(): void {
    setEditing({
      id: newEntityId(),
      name: "",
      merchant: "",
      amount: 0,
      kind: "支出",
      category: defaultCategory(ledger, {
        kind: "支出",
        preferredId: "builtin:居住",
      }),
      accountId: null,
      description: "",
      tags: [],
      frequency: "monthly",
      startDate: localNow().slice(0, DATE_KEY_LENGTH),
      isPaused: false,
    });
  }
  async function commit(next: Ledger): Promise<void> {
    try {
      await onCommit(next);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }
  }
  return (
    <section className="planning-page">
      <div className="page-heading heading-with-action">
        <div>
          <h1>固定的支出，交给日历</h1>
          <p>打开账本时自动补记到期账单，每个日期只生成一次。</p>
        </div>
        <Button
          variant="filled"
          type="submit"
          className="primary-button"
          onClick={add}
        >
          新建周期规则
        </Button>
      </div>
      <p className="notice">
        月末和闰日自动落在当月最后一天。暂停期间不生成；恢复后会补记暂停期间的到期账单。关联账户归档时停止生成。
      </p>
      {error ? (
        <p role="alert" className="error-message">
          {error}
        </p>
      ) : null}
      <div className="budget-grid">
        {(ledger.recurringRules ?? []).map((rule) => (
          <article className="panel" key={rule.id}>
            <h2>{rule.name}</h2>
            <p className="large-amount">¥ {money(rule.amount)}</p>
            <p>
              {FREQUENCIES[rule.frequency]} · {rule.kind} ·{" "}
              {rule.isPaused ? "已暂停" : "进行中"}
            </p>
            <p className="muted">
              {rule.startDate} 起{rule.endDate ? `，至 ${rule.endDate}` : ""}
            </p>
            <div className="button-row">
              <Button
                variant="outline"
                type="submit"
                className="secondary-button"
                onClick={() => setEditing(rule)}
              >
                编辑
              </Button>
              <Button
                variant="outline"
                type="submit"
                className="secondary-button"
                onClick={() =>
                  void commit(
                    saveRecurring(ledger, {
                      ...rule,
                      isPaused: !rule.isPaused,
                    }),
                  )
                }
              >
                {rule.isPaused ? "恢复" : "暂停"}
              </Button>
              <Button
                variant="subtle"
                type="submit"
                className="text-button"
                onClick={() =>
                  void commit({
                    ...ledger,
                    recurringRules: ledger.recurringRules?.filter(
                      (item) => item.id !== rule.id,
                    ),
                  })
                }
              >
                删除规则
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!ledger.recurringRules?.length ? (
        <div className="empty-panel">
          房租、工资、订阅会员，都可以设为周期账单。
        </div>
      ) : null}
      {editing ? (
        <RecurringEditor
          key={editing.id}
          rule={editing}
          ledger={ledger}
          onClose={() => setEditing(null)}
          onSave={async (rule) => {
            await onCommit(
              applyRecurring(
                saveRecurring(ledger, rule),
                localNow().slice(0, DATE_KEY_LENGTH),
              ),
            );
            setEditing(null);
          }}
        />
      ) : null}
    </section>
  );
}
