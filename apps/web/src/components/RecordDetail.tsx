import { useState } from "react";
import {
  CATEGORIES,
  KINDS,
  type BillRecord,
  type Category,
  type Kind,
  signedMoney,
} from "@hamster-ledger/core";
import { Dialog } from "./Dialog";
import { CategoryIcon, Icons } from "./Icons";
import type { LedgerController } from "../hooks/useLedger";
interface RecordDetailProps {
  record: BillRecord;
  onClose: () => void;
  onSave: LedgerController["editRecord"];
}
export function RecordDetail({
  record,
  onClose,
  onSave,
}: RecordDetailProps): React.JSX.Element {
  const [category, setCategory] = useState<Category>(record.category);
  const [kind, setKind] = useState<Kind>(record.kind);
  const [account, setAccount] = useState(record.account);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  async function handleSubmit(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    try {
      await onSave({ id: record.id, category, kind, account, remember });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
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
          <label>
            分类
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
            >
              {CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            交易类型
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as Kind)}
            >
              {KINDS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="full-width">
            实际付款 / 收款账户
            <input
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="如：招商银行 · 6628"
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          记住“{record.merchant}”的分类，用于下次导入
        </label>
        <dl className="detail-meta">
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
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button" type="submit">
            保存修改
          </button>
        </div>
      </form>
    </Dialog>
  );
}
