import {
  SegmentedControl,
  Autocomplete,
  TextInput,
  Button,
} from "@mantine/core";
import { Choice } from "../ui/Choice";
import { DateField } from "../ui/DateField";
const CENTS_PER_YUAN = 100;
const NOTE_SUGGESTION_LIMIT = 12;
const MINUTE_TIMESTAMP_LENGTH = 16;
import { useState } from "react";
import {
  categoryNames,
  defaultCategory,
  RecordConflictError,
  resolveAssetAccount,
  type Ledger,
  type BillRecord,
  type Kind,
  type EntryInput,
} from "@hamster-ledger/core";
import { parseAmount } from "@hamster-ledger/importers";
import { localNow, newEntityId } from "../platform/browser/runtime";
import { Dialog } from "./Dialog";
interface EntryEditorProps {
  ledger: Ledger;
  record?: BillRecord;
  date?: string;
  onSave: (input: EntryInput) => Promise<void>;
  onClose: () => void;
  onReload?: () => void;
}
export function EntryEditor({
  ledger,
  record,
  date,
  onSave,
  onClose,
  onReload,
}: EntryEditorProps): React.JSX.Element {
  const [baseline] = useState(record);
  const [hasConflict, setHasConflict] = useState(false);
  const [kind, setKind] = useState<Kind>(record?.kind ?? "支出");
  const [amount, setAmount] = useState(
    record ? String(record.amount / CENTS_PER_YUAN) : "",
  );
  const [merchant, setMerchant] = useState(record?.merchant ?? "");
  const [timestamp, setTimestamp] = useState(
    (record?.date ?? (date ? date + " 12:00:00" : localNow())).replace(
      " ",
      "T",
    ),
  );
  const [category, setCategory] = useState(
    record?.category ??
      defaultCategory(ledger, { kind: record?.kind ?? "支出" }),
  );
  const [description, setDescription] = useState(record?.description ?? "");
  const [tags, setTags] = useState(record?.tags?.join("，") ?? "");
  const [accountId, setAccountId] = useState(
    record ? (resolveAssetAccount(record, ledger.accounts)?.id ?? "") : "",
  );
  const [destination, setDestination] = useState(
    record?.transferToAccountId ?? "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const suggestions = [
    ...new Set(
      ledger.records
        .filter((item) => !item.isDeleted)
        .map((item) => item.description)
        .filter(Boolean),
    ),
  ].slice(-NOTE_SUGGESTION_LIMIT);
  async function submit(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) {
      setError("请填写大于零的金额。");
      return;
    }
    const isHistoricalCategory =
      baseline?.category === category && baseline?.kind === kind;
    if (
      !category ||
      (!isHistoricalCategory && !categoryNames(ledger, kind).includes(category))
    ) {
      setError(
        "分类已变更或没有可用分类，请重新选择，或先在更多功能中添加分类。",
      );
      return;
    }
    setBusy(true);
    try {
      let dateValue = timestamp.replace("T", " ");
      if (dateValue.length === MINUTE_TIMESTAMP_LENGTH) dateValue += ":00";
      await onSave({
        id: record?.id ?? newEntityId(),
        expectedRecord: baseline,
        date: dateValue,
        merchant,
        amount: cents,
        kind,
        category,
        description,
        tags: tags
          .split(/[，,]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        accountId: accountId || null,
        transferToAccountId: destination || null,
      });
      onClose();
    } catch (cause) {
      setHasConflict(cause instanceof RecordConflictError);
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={record ? "编辑账单" : "记一笔"} onClose={onClose}>
      <form onSubmit={submit}>
        <SegmentedControl
          fullWidth
          aria-label="收支类型"
          value={kind}
          data={["支出", "收入", "转账", "退款"]}
          onChange={(value) => {
            const nextKind = value as Kind;
            setKind(nextKind);
            if (!categoryNames(ledger, nextKind).includes(category))
              setCategory(defaultCategory(ledger, { kind: nextKind }));
          }}
        />
        <TextInput
          label={<>金额（元）</>}
          className="entry-amount"
          autoFocus
          inputMode="decimal"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
        />
        <div className="form-grid">
          <TextInput
            label={<>商户 / 交易名称</>}
            required
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            placeholder="如：午餐、工资"
          />
          <Choice
            label={<>分类</>}
            value={category}
            onChange={(value) => setCategory(value)}
          >
            {!category ? <option value="">请先添加分类</option> : null}
            {!categoryNames(ledger, kind).includes(category) &&
            category &&
            !(baseline?.category === category && baseline?.kind === kind) ? (
              <option value={category} disabled>
                {category}（分类已变更，请重新选择）
              </option>
            ) : null}
            {[
              ...new Set([
                ...(baseline?.kind === kind ? [baseline.category] : []),
                ...categoryNames(ledger, kind),
              ]),
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Choice>
          <DateField
            label={<>交易时间</>}
            className="full-width"
            required
            type="datetime-local"

            value={timestamp}
            onChange={(value) => setTimestamp(value)}
          />
          <Choice
            label={<>收付款账户</>}
            value={accountId}
            onChange={(value) => setAccountId(value)}
          >
            <option value="">不关联资产</option>
            {ledger.accounts
              .filter((item) => !item.isArchived)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </Choice>
          {kind === "转账" ? (
            <Choice
              label={<>转入账户</>}
              value={destination}
              onChange={(value) => setDestination(value)}
            >
              <option value="">请选择</option>
              {ledger.accounts
                .filter((item) => !item.isArchived && item.id !== accountId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </Choice>
          ) : null}
          <Autocomplete
            className="full-width"
            label="备注"
            data={suggestions}
            value={description}
            onChange={setDescription}
            placeholder="记录用途，或选用历史备注"
          />
          <TextInput
            label={<>标签</>}
            className="full-width"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="旅行，家庭，报销"
          />
        </div>
        {error ? (
          <p role="alert" className="error-message">
            {error}
          </p>
        ) : null}
        {hasConflict && onReload ? (
          <p className="notice warning">
            加载最新账单会替换当前草稿。
            <Button
              variant="subtle"
              type="button"
              className="text-button"
              onClick={onReload}
            >
              加载最新账单
            </Button>
          </p>
        ) : null}
        <div className="dialog-actions">
          <Button
            variant="outline"
            type="button"
            className="secondary-button"
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            variant="filled"
            type="submit"
            className="primary-button"
            loading={busy}
          >
            {busy ? "保存中…" : "保存账单"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
