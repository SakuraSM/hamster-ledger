const CENTS_PER_YUAN = 100;
import { useState } from "react";
import {
  categoryNames,
  defaultCategory,
  type Ledger,
  type RecurringRule,
} from "@hamster-ledger/core";
import { parseAmount } from "@hamster-ledger/importers";
import { Dialog } from "../Dialog";
import { FREQUENCIES } from "./recurring-config";
interface EditorProps {
  rule: RecurringRule;
  ledger: Ledger;
  onSave: (rule: RecurringRule) => Promise<void>;
  onClose: () => void;
}
export function RecurringEditor({
  rule,
  ledger,
  onSave,
  onClose,
}: EditorProps): React.JSX.Element {
  const [draft, setDraft] = useState(rule);
  const [amount, setAmount] = useState(
    rule.amount ? String(rule.amount / CENTS_PER_YUAN) : "",
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  function update(patch: Partial<RecurringRule>): void {
    setDraft((current) => ({ ...current, ...patch }));
  }
  async function submit(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    try {
      const cents = parseAmount(amount);
      if (!cents || cents <= 0) throw new Error("金额应大于零。");
      if (
        !draft.category ||
        (!categoryNames(ledger, draft.kind).includes(draft.category) &&
          !(
            ledger.recurringRules?.some((item) => item.id === rule.id) &&
            rule.category === draft.category &&
            rule.kind === draft.kind
          ))
      )
        throw new Error("请选择有效分类，或先在更多功能中添加分类。");
      await onSave({
        ...draft,
        amount: cents,
        merchant: draft.name,
        transferToAccountId:
          draft.kind === "转账" ? draft.transferToAccountId : null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <Dialog title="周期记账规则" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            名称
            <input
              required
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
            />
          </label>
          <label>
            金额（元）
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label>
            交易类型
            <select
              value={draft.kind}
              onChange={(event) =>
                update({
                  kind: event.target.value as RecurringRule["kind"],
                  category: defaultCategory(ledger, {
                    kind: event.target.value as RecurringRule["kind"],
                  }),
                })
              }
            >
              <option>支出</option>
              <option>收入</option>
              <option>转账</option>
            </select>
          </label>
          <label>
            分类
            <select
              value={draft.category}
              onChange={(event) => update({ category: event.target.value })}
            >
              {!draft.category ? <option value="">请先添加分类</option> : null}
              {[
                ...new Set([
                  ...(rule.category ? [rule.category] : []),
                  ...categoryNames(ledger, draft.kind),
                ]),
              ].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            重复频率
            <select
              value={draft.frequency}
              onChange={(event) =>
                update({
                  frequency: event.target.value as RecurringRule["frequency"],
                })
              }
            >
              {Object.entries(FREQUENCIES).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            开始日期
            <input
              required
              type="date"
              value={draft.startDate}
              onChange={(event) => update({ startDate: event.target.value })}
            />
          </label>
          <label>
            结束日期（可选）
            <input
              type="date"
              value={draft.endDate ?? ""}
              onChange={(event) =>
                update({ endDate: event.target.value || undefined })
              }
            />
          </label>
          <label>
            收付款账户
            <select
              value={draft.accountId ?? ""}
              onChange={(event) =>
                update({ accountId: event.target.value || null })
              }
            >
              <option value="">不关联资产</option>
              {ledger.accounts
                .filter((item) => !item.isArchived)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          {draft.kind === "转账" ? (
            <label>
              转入账户
              <select
                value={draft.transferToAccountId ?? ""}
                onChange={(event) =>
                  update({ transferToAccountId: event.target.value || null })
                }
              >
                <option value="">请选择</option>
                {ledger.accounts
                  .filter(
                    (item) => !item.isArchived && item.id !== draft.accountId,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <label>
            备注
            <input
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
            />
          </label>
          <label>
            标签，逗号分隔
            <input
              value={draft.tags.join(",")}
              onChange={(event) =>
                update({
                  tags: event.target.value.split(/[,，]/).filter(Boolean),
                })
              }
            />
          </label>
        </div>
        <p className="muted">
          保存后立即补记开始日期至今天的到期账单。删除规则会保留已生成账单。
        </p>
        {error ? (
          <p role="alert" className="error-message">
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button" disabled={isSaving}>
            保存周期规则
          </button>
        </div>
      </form>
    </Dialog>
  );
}
