const MINUTE_PRECISION_LENGTH = 16;
const DATE_KEY_LENGTH = 10;
import { Button, TextInput } from "@mantine/core";
import {
  formatCurrency,
  type AssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import { useBalanceCalibration } from "@hamster-ledger/ledger-react";
import { localNow } from "../../platform/browser/runtime";
import { DateField } from "../../ui/DateField";
import { Dialog } from "../Dialog";
import type { AccountSave } from "./AccountEditor";

interface BalanceCalibrationProps {
  account: AssetAccount;
  ledger: Ledger;
  date: string;
  onSave: (input: AccountSave) => Promise<void>;
  onClose: () => void;
}
export function BalanceCalibration({
  account,
  ledger,
  date,
  onSave,
  onClose,
}: BalanceCalibrationProps): React.JSX.Element {
  const now = localNow();
  const form = useBalanceCalibration({
    account,
    ledger,
    initialAt:
      date === now.slice(0, DATE_KEY_LENGTH) ? now : date + " 23:59:59",
    now: localNow,
    onSave,
    onClose,
  });
  const currency = account.currency ?? "CNY";
  const amount = (minor: number): string => formatCurrency({ minor, currency });
  return (
    <Dialog title="校准账户余额" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.save();
        }}
      >
        <p className="calibration-account">
          {account.name} · {currency}
        </p>
        <p className="account-form-help">
          核对银行、钱包或账单上的实际余额。差额只调整资产，不记作收入或支出。
        </p>
        <div className="form-grid">
          <TextInput
            label={account.kind === "liability" ? "实际负债" : "实际余额"}
            value={form.amount}
            onChange={(event) => form.setAmount(event.currentTarget.value)}
            inputMode="decimal"
            required
          />
          <DateField
            label="余额确认时间"
            type="datetime-local"
            value={form.at.replace(" ", "T")}
            onChange={(value) =>
              form.setAt(
                value.replace("T", " ") +
                  (value.length === MINUTE_PRECISION_LENGTH ? ":00" : ""),
              )
            }
            required
          />
          <TextInput
            className="full-width"
            label="校准说明"
            value={form.note}
            onChange={(event) => form.setNote(event.currentTarget.value)}
            placeholder="如：核对银行余额、更新投资估值"
          />
        </div>
        <div className="calibration-preview" aria-live="polite">
          <div>
            <span>账面余额</span>
            <strong>
              {form.preview?.expected == null
                ? "尚无基准"
                : amount(form.preview.expected)}
            </strong>
          </div>
          <div>
            <span>校准差额</span>
            <strong>
              {form.preview?.difference == null
                ? "—"
                : `${form.preview.difference >= 0 ? "+" : ""}${amount(form.preview.difference)}`}
            </strong>
          </div>
          <div>
            <span>校准后</span>
            <strong>{form.preview ? amount(form.preview.actual) : "—"}</strong>
          </div>
        </div>
        <p className="account-form-help">
          保留原有余额历史。确认时间之后的流水继续累计；负债填正数，信用卡预存款填负数。
        </p>
        {form.error ? (
          <p className="error-message" role="alert">
            {form.error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={form.isSaving}>
            取消
          </Button>
          <Button type="submit" loading={form.isSaving}>
            确认校准
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
