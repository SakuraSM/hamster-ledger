import {
  TRANSACTION_LABELS,
  formatCurrency,
  money,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { useBookMembers, type SplitMember } from "@hamster-ledger/ledger-react";
import { useNetworkClient } from "../../hooks/useNetworkController";
interface Props {
  record: BillRecord;
  ledger: Ledger;
  bookId?: string;
}
export function TransactionFacts(props: Props): React.JSX.Element | null {
  if (!props.record.detail || props.record.detail.origin === "legacy")
    return null;
  return props.bookId ? (
    <NetworkTransactionFacts {...props} />
  ) : (
    <FactsContent {...props} members={[]} />
  );
}
function NetworkTransactionFacts(props: Props): React.JSX.Element {
  const members = useBookMembers(useNetworkClient(), props.bookId);
  return <FactsContent {...props} members={members} />;
}
function FactsContent({
  record,
  ledger,
  members,
}: Props & { members: SplitMember[] }): React.JSX.Element {
  const detail = record.detail!;
  const memberName = (id: string): string =>
    members.find((item) => item.id === id)?.username ?? id;
  return (
    <dl className="detail-meta">
      {detail.origin === "ai" ? (
        <div>
          <dt>记账来源</dt>
          <dd>
            AI 草稿 ·{" "}
            {ledger.aiDrafts?.find((draft) => draft.recordId === record.id)
              ?.sourceLabel ?? "历史识别记录"}
          </dd>
        </div>
      ) : null}
      <div>
        <dt>完整交易类型</dt>
        <dd>{TRANSACTION_LABELS[detail.type]}</dd>
      </div>
      <div>
        <dt>原币金额</dt>
        <dd>{formatCurrency(detail.original)}</dd>
      </div>
      {detail.original.currency !== "CNY" ? (
        <div>
          <dt>入账汇率快照</dt>
          <dd>
            1 {detail.original.currency} = ¥{detail.original.rate} ·{" "}
            {detail.original.date} ·{" "}
            {detail.original.source === "manual" ? "手动" : "参考汇率"}
          </dd>
        </div>
      ) : null}
      {detail.destination ? (
        <div>
          <dt>实际转入</dt>
          <dd>{formatCurrency(detail.destination)}</dd>
        </div>
      ) : null}
      {detail.relatedId ? (
        <div>
          <dt>关联原支出</dt>
          <dd>
            {ledger.records.find((item) => item.id === detail.relatedId)
              ?.merchant ?? "历史记录"}
          </dd>
        </div>
      ) : null}
      {detail.isReimbursable ? (
        <div>
          <dt>报销</dt>
          <dd>待报销支出，回款请使用「报销回款」并关联本笔。</dd>
        </div>
      ) : null}
      {detail.memberId ? (
        <div>
          <dt>记账成员</dt>
          <dd>{memberName(detail.memberId)}</dd>
        </div>
      ) : null}
      {detail.splits.length ? (
        <div>
          <dt>成员承担额（人民币）</dt>
          <dd>
            {detail.splits.map((split) => (
              <p key={split.memberId}>
                {memberName(split.memberId)} · ¥{money(split.amount)}
              </p>
            ))}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
