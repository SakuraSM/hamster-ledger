const MINUTE_PRECISION_LENGTH = 16;
const DATE_KEY_LENGTH = 10;
import { Button, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  assetAccountSchema,
  type AssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import { useBalanceCalibration } from "@hamster-ledger/ledger-react";
import { localNow } from "../../platform/browser/runtime";
import { DateField } from "../../ui/DateField";
import { Dialog } from "../Dialog";
import {
  isSameAssetBook,
  snapshotAssetBook,
  type AccountSave,
  type AssetBookContext,
} from "./AccountEditor";
import { accountAmount, assetAccountLabel } from "./asset-format";

interface BalanceCalibrationProps {
  account: AssetAccount;
  ledger: Ledger;
  date: string;
  isHidden: boolean;
  bookContext?: AssetBookContext;
  onRecords: () => void;
  onSave: (input: AccountSave) => Promise<void>;
  onClose: () => void;
}
interface CalibrationPreview {
  balance: {
    expected: number | null;
    actual: number;
    difference: number | null;
  };
  account: AssetAccount;
  book?: AssetBookContext;
}
function accountSnapshot(account: AssetAccount): string {
  return JSON.stringify(assetAccountSchema.parse(account));
}
export function BalanceCalibration({
  account,
  ledger,
  date,
  isHidden,
  bookContext,
  onRecords,
  onSave,
  onClose,
}: BalanceCalibrationProps): React.JSX.Element {
  const [hasEditedAmount, setHasEditedAmount] = useState(false);
  const [expectedBook] = useState(() => snapshotAssetBook(bookContext));
  const [review, setReview] = useState<CalibrationPreview | null>(null);
  const [hasBookChanged, setHasBookChanged] = useState(false);
  const [hasReviewChanged, setHasReviewChanged] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [error, setError] = useState("");
  const now = localNow();
  const currentAccount = ledger.accounts.find((item) => item.id === account.id);
  const displayedAccount = review?.account ?? currentAccount ?? account;
  const form = useBalanceCalibration({
    account: currentAccount ?? account,
    ledger,
    initialAt:
      date === now.slice(0, DATE_KEY_LENGTH) ? now : date + " 23:59:59",
    now: localNow,
    onSave: (input) =>
      onSave({
        ...input,
        ...(review ? { expectedAccount: review.account } : {}),
        ...(expectedBook ? { expectedBook } : {}),
        ...(review?.book ? { previewGuard: review.book } : {}),
      }),
    onClose,
  });
  useEffect(() => {
    form.setAmount("");
  }, [form.setAmount]);
  const currentAccountSnapshot = currentAccount
    ? accountSnapshot(currentAccount)
    : null;
  const isBookMismatch = !isSameAssetBook(expectedBook, bookContext);
  const isReviewOutdated = Boolean(
    review &&
    (!isSameAssetBook(review.book, bookContext) ||
      review.book?.revision !== bookContext?.revision ||
      accountSnapshot(review.account) !== currentAccountSnapshot ||
      JSON.stringify(review.balance) !== JSON.stringify(form.preview)),
  );
  useEffect(() => {
    if (isBookMismatch) setHasBookChanged(true);
  }, [isBookMismatch]);
  useEffect(() => {
    if (isReviewOutdated) setHasReviewChanged(true);
  }, [isReviewOutdated]);
  const currency = displayedAccount.currency ?? "CNY";
  const amount = (minor: number): string =>
    accountAmount({ minor, currency, isHidden });
  const preview = review?.balance ?? (hasEditedAmount ? form.preview : null);

  function submit(event: React.SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError("");
    if (hasBookChanged || isBookMismatch) {
      setError("账本或绑定身份已变化，请关闭后重新打开；当前草稿尚未保存。");
      return;
    }
    if (!currentAccount || !currentAccountSnapshot) {
      setError("账户已不存在；当前草稿尚未保存。");
      return;
    }
    if (!review) {
      if (!hasEditedAmount || !form.amount.trim() || !form.preview) {
        setError("请填写有效的实际余额和确认时间。");
        return;
      }
      if (form.at > localNow()) {
        setError("余额确认时间不能晚于当前时间。");
        return;
      }
      if (
        bookContext?.isNetwork &&
        (!bookContext.cloud || bookContext.revision === undefined)
      ) {
        setError("联网账本身份或版本不可用，请刷新后重新核对。");
        return;
      }
      setReview({
        balance: { ...form.preview },
        account: assetAccountSchema.parse(currentAccount),
        book: snapshotAssetBook(bookContext),
      });
      return;
    }
    if (hasReviewChanged || isReviewOutdated) {
      setError("账户、账本或差额已变化，请返回修改并重新核对。");
      return;
    }
    setHasAttemptedSave(true);
    void form.save();
  }
  return (
    <Dialog title="校准账户余额" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="calibration-account">
          {assetAccountLabel({
            account: displayedAccount,
            accounts: ledger.accounts,
            isHidden,
          })}{" "}
          · {currency}
        </p>
        <p className="account-form-help">
          {review
            ? "请核对以下差额，确认后保存新的余额基准。"
            : "核对银行、钱包或账单上的实际余额。差额只调整资产，不记作收入或支出。"}
        </p>
        {review ? <p>余额确认时间：{form.at}</p> : null}
        {!review ? (
          <div className="form-grid">
            <TextInput
              label={
                displayedAccount.kind === "liability" ? "实际负债" : "实际余额"
              }
              value={hasEditedAmount ? form.amount : ""}
              onChange={(event) => {
                setHasEditedAmount(true);
                form.setAmount(event.currentTarget.value);
              }}
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
        ) : null}
        <div className="calibration-preview" aria-live="polite">
          <div>
            <span>账面余额</span>
            <strong>
              {!preview
                ? "—"
                : preview.expected === null
                  ? "尚无基准"
                  : amount(preview.expected)}
            </strong>
          </div>
          <div>
            <span>校准差额</span>
            <strong>
              {preview?.difference == null
                ? "—"
                : `${!isHidden && preview.difference >= 0 ? "+" : ""}${amount(preview.difference)}`}
            </strong>
          </div>
          <div>
            <span>校准后</span>
            <strong>{preview ? amount(preview.actual) : "—"}</strong>
          </div>
        </div>
        <p className="account-form-help">
          保留原有余额历史。确认时间之后的流水继续累计；负债填正数，信用卡预存款填负数。
        </p>
        {error || (hasAttemptedSave && form.error) ? (
          <p className="error-message" role="alert">
            {error || form.error}
          </p>
        ) : null}
        <div className="dialog-actions">
          {review ? (
            <Button
              variant="subtle"
              type="button"
              disabled={form.isSaving}
              onClick={() => {
                setReview(null);
                setHasReviewChanged(false);
                setHasAttemptedSave(false);
                setError("");
              }}
            >
              返回修改
            </Button>
          ) : (
            <Button
              variant="subtle"
              type="button"
              onClick={onRecords}
              disabled={form.isSaving}
            >
              先查账单
            </Button>
          )}
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            disabled={form.isSaving}
          >
            取消
          </Button>
          <Button type="submit" loading={form.isSaving}>
            {review ? "确认校准" : "查看校准差额"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
