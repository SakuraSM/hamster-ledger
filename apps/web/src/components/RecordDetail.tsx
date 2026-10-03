import { TextInput, Checkbox, UnstyledButton, Button } from "@mantine/core";
import { Choice } from "../ui/Choice";
import { RecordAccountFields } from "./RecordAccountFields";
import { useState } from "react";
import {
  categoryNames,
  KINDS,
  type BillRecord,
  type Category,
  type Kind,
  signedMoney,
  resolveAssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import { Dialog } from "./Dialog";
import { CategoryIcon, Icons } from "./Icons";
import type { LedgerController } from "../hooks/useLedger";
interface RecordDetailProps {
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  record: BillRecord;
  onClose: () => void;
  onSave: LedgerController["editRecord"];
  ledger: Ledger;
  onRelated: (record: BillRecord) => void;
}
export function RecordDetail({
  onEdit,
  onDelete,
  record,
  onClose,
  onSave,
  ledger,
  onRelated,
}: RecordDetailProps): React.JSX.Element {
  const [isDeleting, setIsDeleting] = useState(false);
  const [category, setCategory] = useState<Category>(record.category);
  const [kind, setKind] = useState<Kind>(record.kind);
  const [account, setAccount] = useState(record.account);
  const [accountId, setAccountId] = useState(
    record.accountId === null
      ? ""
      : (record.accountId ??
          resolveAssetAccount(record, ledger.accounts)?.id ??
          ""),
  );
  const [transferToAccountId, setTransferToAccountId] = useState(
    record.transferToAccountId ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const related = ledger.records.filter(
    (item) =>
      item.id !== record.id &&
      (item.duplicateOf === record.id ||
        item.id === record.duplicateOf ||
        (record.duplicateOf && item.duplicateOf === record.duplicateOf)),
  );
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  async function handleSubmit(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        id: record.id,
        expectedRecord: record,
        category,
        kind,
        account,
        remember,
        accountId: accountId || null,
        transferToAccountId:
          kind === "转账" ? transferToAccountId || null : null,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <Dialog title="账单详情" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="detail-hero">
          <span className="merchant-icon">
            <CategoryIcon
              category={record.category}
              merchant={record.merchant}
            />
          </span>
          <div>
            <h3>{record.merchant}</h3>
            <p>{record.date}</p>
          </div>
          <strong>{signedMoney(record)}</strong>
        </div>
        {record.status === "pending" ? (
          <p className="notice warning">
            <Icons.Warning size={19} />
            {record.reason || "疑似重复，请在核对中心确认。"}
          </p>
        ) : null}
        <div className="form-grid">
          <Choice
            label={<>分类</>}
            value={category}
            onChange={(value) => setCategory(value as Category)}
          >
            {[...new Set([category, ...categoryNames(ledger)])].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Choice>
          <Choice
            label={<>交易类型</>}
            value={kind}
            onChange={(value) => setKind(value as Kind)}
          >
            {KINDS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Choice>
          <TextInput
            label={<>实际付款 / 收款账户</>}
            className="full-width"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder="如：招商银行 · 6628"
          />
        </div>
        <RecordAccountFields
          record={record}
          accounts={ledger.accounts}
          kind={kind}
          accountId={accountId}
          transferToAccountId={transferToAccountId}
          onAccount={setAccountId}
          onDestination={setTransferToAccountId}
        />
        <Checkbox
          label={<>记住“{record.merchant}”的分类，用于下次导入</>}
          className="checkbox-label"

          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        <dl className="detail-meta">
          <div>
            <dt>交易说明</dt>
            <dd>{record.description || record.merchant}</dd>
          </div>
          <div>
            <dt>原始交易状态</dt>
            <dd>{record.sourceStatus}</dd>
          </div>
          <div>
            <dt>计入状态</dt>
            <dd>
              {record.status === "confirmed"
                ? "已确认"
                : record.status === "duplicate"
                  ? "重复，未计入"
                  : "待确认，未计入"}
            </dd>
          </div>
          <div>
            <dt>账单来源</dt>
            <dd>{[record.source, ...record.linkedSources].join(" + ")}</dd>
          </div>
          <div>
            <dt>原始文件</dt>
            <dd>{record.fileName}</dd>
          </div>
          <div>
            <dt>交易单号</dt>
            <dd>{record.orderId || "原账单未提供"}</dd>
          </div>
          <div>
            <dt>识别方式</dt>
            <dd>账单字段提取与商户分类规则</dd>
          </div>
        </dl>
        {related.length ? (
          <section className="related-records">
            <h3>同一交易的关联流水</h3>
            {related.map((item) => (
              <UnstyledButton
                className="related-record"
                type="button"
                key={item.id}
                onClick={() => onRelated(item)}
              >
                <span>
                  {item.source} · {item.merchant}
                  <small>
                    {item.date} ·{" "}
                    {item.status === "duplicate"
                      ? "重复记录，不重复计算"
                      : "主账单"}
                  </small>
                </span>
                <span>
                  {signedMoney(item)} <Icons.Caret size={16} />
                </span>
              </UnstyledButton>
            ))}
          </section>
        ) : null}
        <details className="raw-details">
          <summary>查看原始字段</summary>
          <dl>
            {Object.entries(record.raw).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </details>
        {error ? (
          <p role="alert" className="error-message">
            {error}
          </p>
        ) : null}
        <div className="button-row">
          {onEdit ? (
            <Button
              variant="outline"
              type="button"
              className="secondary-button"
              onClick={onEdit}
            >
              编辑金额、日期与备注
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              variant="subtle"
              type="button"
              className="text-button"
              onClick={() => {
                if (!isDeleting) {
                  setIsDeleting(true);
                  return;
                }
                void onDelete().catch((cause) =>
                  setError(cause instanceof Error ? cause.message : "删除失败"),
                );
              }}
            >
              {isDeleting ? "确认移入回收站" : "删除账单"}
            </Button>
          ) : null}
        </div>
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
            className="primary-button"
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? "保存中…" : "保存修改"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
