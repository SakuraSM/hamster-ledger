import { TextInput, Checkbox, Button } from "@mantine/core";
import { Choice } from "../../ui/Choice";
import { DateField } from "../../ui/DateField";
import { useState } from "react";
import {
  DEFAULT_PREFERENCES,
  preferencesSchema,
  type Ledger,
  type LedgerPreferences,
} from "@hamster-ledger/core";
interface Props {
  ledger: Ledger;
  onCommit: (ledger: Ledger) => Promise<void>;
}
export function PreferencesPanel({
  ledger,
  onCommit,
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState<LedgerPreferences>(
    ledger.preferences ?? DEFAULT_PREFERENCES,
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function update(patch: Partial<LedgerPreferences>): void {
    setDraft((current) => ({ ...current, ...patch }));
  }
  async function save(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    try {
      await onCommit({
        ...ledger,
        preferences: preferencesSchema.parse(draft),
      });
      setMessage("偏好已保存。");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }
  }
  return (
    <section className="panel">
      <h2>记账偏好</h2>
      <form onSubmit={save}>
        <div className="form-grid">
          <TextInput
            label={<>每月账期开始日</>}
            type="number"
            min="1"
            max="31"
            required
            value={draft.cycleStartDay}
            onChange={(event) =>
              update({ cycleStartDay: Number(event.target.value) })
            }
          />
          <Choice
            label={<>主题</>}
            value={draft.theme}
            onChange={(value) =>
              update({
                theme: value as LedgerPreferences["theme"],
              })
            }
          >
            <option value="warm">奶油暖棕</option>
            <option value="sage">鼠尾草绿</option>
            <option value="night">深夜账本</option>
          </Choice>
          <Checkbox
            label={<>隐藏首页金额</>}
            className="checkbox-label"

            checked={draft.hideAmounts}
            onChange={(event) => update({ hideAmounts: event.target.checked })}
          />
          <Checkbox
            label={<>开启每日记账提醒</>}
            className="checkbox-label"

            checked={draft.reminderEnabled}
            onChange={(event) =>
              update({ reminderEnabled: event.target.checked })
            }
          />
          <DateField
            label={<>提醒时间</>}
            type="time"
            required
            value={draft.reminderTime}
            onChange={(value) => update({ reminderTime: value })}
          />
        </div>
        <p className="muted">
          提醒在页面打开且可见时出现。关闭网页后的系统通知需要原生客户端或推送服务。
        </p>
        <Button variant="outline" type="submit" className="secondary-button">
          保存偏好
        </Button>
        {message ? <p role="status">{message}</p> : null}
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
