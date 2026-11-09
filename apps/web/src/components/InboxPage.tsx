import {
  money,
  pendingReviewCount,
  pendingPreviewRecord,
  periodRecords,
  resolveAssetAccount,
  signedMoney,
  summarize,
  type Ledger,
} from "@hamster-ledger/core";
import { Icons } from "./Icons";

export interface InboxPageProps {
  ledger: Ledger;
  month: string;
  onReview: () => void;
  onAi: () => void;
  onImport: () => void;
  onLater: () => void;
}

export function InboxPage({
  ledger,
  month,
  onReview,
  onAi,
  onImport,
  onLater,
}: InboxPageProps): React.JSX.Element {
  const drafts = (ledger.aiDrafts ?? []).filter(
    (draft) => draft.state === "pending",
  );
  const reviewCount = pendingReviewCount(ledger);
  const draft = drafts[0];
  const record = pendingPreviewRecord(ledger);
  const isHidden = Boolean(ledger.preferences?.hideAmounts);
  const name = isHidden
    ? "待核对账单"
    : draft
      ? draft.candidate.merchant || "交易对象待确认"
      : record?.merchant || "待核对账单";
  const date = draft ? draft.candidate.date : record?.date;
  const category = draft ? draft.candidate.category : record?.category;
  const amount = isHidden
    ? "••••"
    : draft
      ? `${draft.candidate.currency} ${draft.candidate.amount || "金额待填写"}`
      : record
        ? signedMoney(record)
        : "";
  const summary = summarize(periodRecords(ledger, month));
  const pendingCount = drafts.length + reviewCount;
  const canReview = Boolean(draft || record || reviewCount);
  return (
    <section className="inbox-workspace" aria-labelledby="inbox-title">
      <div className="inbox-main">
        <header className="inbox-heading">
          <div>
            <h1 id="inbox-title">待处理</h1>
            <p>核对后才会入账</p>
          </div>
          <strong aria-label={`${pendingCount} 项待处理`}>
            {String(pendingCount).padStart(2, "0")}
          </strong>
        </header>
        <div className="inbox-filters" aria-label="待处理入口">
          <button type="button" onClick={onAi}>
            AI 草稿 {drafts.length}
          </button>
          <button type="button" onClick={onReview}>
            账单核对 {reviewCount}
          </button>
        </div>
        {canReview ? (
          <div className="inbox-paper">
            <div className="inbox-paper-content">
              <span className="inbox-source">
                <Icons.Receipt size={17} /> {draft ? "AI 草稿" : "账单核对"} ·
                未入账
              </span>
              <h2>{name}</h2>
              {amount ? (
                <strong className="inbox-amount">{amount}</strong>
              ) : (
                <p>存在待核对的账单</p>
              )}
              {!isHidden && date ? <p className="inbox-date">{date}</p> : null}
              {!isHidden && (draft || record) ? (
                <dl>
                  <div>
                    <dt>分类</dt>
                    <dd>{category || "待选择"}</dd>
                  </div>
                  <div>
                    <dt>账户</dt>
                    <dd>
                      {draft
                        ? (ledger.accounts.find(
                            (account) =>
                              account.id === draft.candidate.accountId,
                          )?.name ?? "待选择")
                        : record
                          ? (resolveAssetAccount(record, ledger.accounts)
                              ?.name ?? "待选择")
                          : "待选择"}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="inbox-empty">
            <Icons.Check size={32} />
            <h2>暂时没有待处理账单</h2>
            <p>导入账单或添加凭证后，可以在这里核对。</p>
          </div>
        )}
        {canReview ? (
          <button
            type="button"
            className="primary-button inbox-primary"
            onClick={draft ? onAi : onReview}
          >
            {draft ? "核对并入账" : "核对这笔账单"}
          </button>
        ) : (
          <button
            type="button"
            className="primary-button inbox-primary"
            onClick={onImport}
          >
            导入账单
          </button>
        )}
        {canReview ? (
          <button type="button" className="inbox-later" onClick={onLater}>
            查看总览
          </button>
        ) : null}
      </div>
      <aside className="inbox-context" aria-label="本期收支依据">
        <p className="inbox-context-eyebrow">{month} · 已确认账单</p>
        <h2>每次确认，都有依据。</h2>
        <small>本期支出</small>
        <strong>{isHidden ? "••••" : `¥${money(summary.expense)}`}</strong>
        <div>
          <span>本期收入</span>
          <b>{isHidden ? "••••" : `¥${money(summary.income)}`}</b>
        </div>
        <p className="inbox-context-note">
          待核对的记录不会计入收支；转账和还款不计为消费。
        </p>
        <button type="button" onClick={onImport}>
          <Icons.Upload size={18} /> 导入账单
        </button>
      </aside>
    </section>
  );
}
