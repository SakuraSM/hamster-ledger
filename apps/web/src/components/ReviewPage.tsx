import { Button, UnstyledButton } from "@mantine/core";
const MONTH_START = 5;
const MINUTE_END = 16;
import { useState } from "react";
import {
  type Ledger,
  type Review,
  type BillRecord,
  money,
} from "@hamster-ledger/core";
import { Icons, SourceIcon } from "./Icons";
interface ReviewPageProps {
  ledger: Ledger;
  onDecide: (review: Review, decision: "linked" | "separate") => void;
  onSelect: (record: BillRecord) => void;
  canUndo: boolean;
  onUndo: () => void;
}
export function ReviewPage({
  ledger,
  onDecide,
  onSelect,
  canUndo,
  onUndo,
}: ReviewPageProps): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pending = ledger.reviews.filter((review) => review.state === "pending");
  const selected =
    pending.find((review) => review.id === selectedId) ?? pending[0];
  const left = ledger.records.find((record) => record.id === selected?.leftId);
  const right = ledger.records.find(
    (record) => record.id === selected?.rightId,
  );
  return (
    <section>
      <div className="page-heading heading-with-action">
        <div>
          <h1>把同一笔，核对清楚</h1>
          <p>关联原始流水，让收支只计算一次</p>
        </div>
        {canUndo ? (
          <Button
            variant="outline"
            type="submit"
            className="secondary-button"
            onClick={onUndo}
          >
            <Icons.Undo size={19} />
            撤销上一步
          </Button>
        ) : null}
      </div>
      {selected && left && right ? (
        <div className="review-workspace">
          <aside className="review-queue">
            <h2>
              待核对 <span>{pending.length}</span>
            </h2>
            {pending.map((review) => {
              const record = ledger.records.find(
                (item) => item.id === review.leftId,
              );
              return record ? (
                <UnstyledButton
                  type="submit"
                  key={review.id}
                  className={review.id === selected.id ? "selected" : ""}
                  onClick={() => setSelectedId(review.id)}
                >
                  <span>
                    <strong>{record.merchant}</strong>
                    <b>¥{money(record.amount)}</b>
                  </span>
                  <small>{record.source} · 跨平台疑似重复</small>
                  <small>{record.date.slice(MONTH_START, MINUTE_END)}</small>
                </UnstyledButton>
              ) : null;
            })}
          </aside>
          <div className="review-detail">
            <span className="record-status pending">疑似同一笔消费</span>
            <div className="review-title">
              <h2>{left.merchant}</h2>
              <strong>¥{money(left.amount)}</strong>
            </div>
            <div className="table-scroll">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>核对项目</th>
                    <th>
                      <SourceIcon source={left.source} />
                      {left.source}流水
                    </th>
                    <th>
                      <SourceIcon source={right.source} />
                      {right.source}流水
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>金额</th>
                    <td>¥{money(left.amount)}</td>
                    <td>¥{money(right.amount)}</td>
                  </tr>
                  <tr>
                    <th>交易时间</th>
                    <td>{left.date.slice(MONTH_START)}</td>
                    <td>{right.date.slice(MONTH_START)}</td>
                  </tr>
                  <tr>
                    <th>商户</th>
                    <td>{left.merchant}</td>
                    <td>{right.merchant}</td>
                  </tr>
                  <tr>
                    <th>付款账户</th>
                    <td>{left.account || "未提供"}</td>
                    <td>{right.account || "未提供"}</td>
                  </tr>
                  <tr>
                    <th>交易状态</th>
                    <td>{left.sourceStatus}</td>
                    <td>{right.sourceStatus}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="match-evidence">
              {selected.reasons.map((reason) => (
                <span key={reason}>
                  <Icons.Check size={18} />
                  {reason}
                </span>
              ))}
              <p>相似信息仅用于提示。请核对原始记录后确认。</p>
            </div>
            <div className="merge-preview">
              <h3>关联后只计一笔支出</h3>
              <p>保留两份原始流水，采用支付平台的商户信息。</p>
              <Button
                variant="subtle"
                type="submit"
                className="text-button"
                onClick={() => onSelect(left)}
              >
                查看原始记录 <Icons.Arrow size={17} />
              </Button>
            </div>
            <div className="review-actions">
              <Button
                variant="outline"
                type="submit"
                className="secondary-button"
                onClick={() => onDecide(selected, "separate")}
              >
                保留为两笔
              </Button>
              <Button
                variant="filled"
                type="submit"
                className="primary-button"
                onClick={() => onDecide(selected, "linked")}
              >
                <Icons.Link size={19} />
                确认关联
              </Button>
            </div>
            <p className="muted small">
              操作后可撤销。已确认的历史支出在核对期间继续计入汇总。
            </p>
          </div>
        </div>
      ) : (
        <div className="empty-state success-state">
          <Icons.Check size={50} weight="duotone" />
          <h2>重复账单已核对完</h2>
          <p>所有关联均保留原始流水，你可以在全部账单中查看。</p>
        </div>
      )}
    </section>
  );
}
