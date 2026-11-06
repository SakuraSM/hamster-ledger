import { useState } from "react";
import { Button } from "@mantine/core";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  categoryBreakdown,
  memberExpenses,
  money,
  reimbursementReport,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { useBookMembers, useReportData } from "@hamster-ledger/ledger-react";
import { useNetworkClient } from "../../hooks/useNetworkController";
const MINOR_PER_YUAN = 100;
const MONEY_PRECISION = 2;

export function ExtendedReports({
  ledger,
  records,
  start,
  end,
  kind,
  bookId,
  onRecord,
  onReimburse,
}: {
  ledger: Ledger;
  records: BillRecord[];
  start: string;
  end: string;
  kind: "支出" | "收入";
  bookId?: string;
  onRecord?: (record: BillRecord) => void;
  onReimburse?: (record: BillRecord) => void;
}): React.JSX.Element {
  const isHidden = Boolean(ledger.preferences?.hideAmounts);
  const amountLabel = (minor: number): string =>
    isHidden ? "••••" : `¥${money(minor)}`;
  const reimbursementAmount = (minor: number | null): string =>
    minor === null ? "数据状态需核对" : amountLabel(minor);
  const client = useNetworkClient();
  const members = useBookMembers(client, bookId);
  const report = useReportData({ ledger, start, end, client });
  const [parentId, setParent] = useState<string>();
  const categories = categoryBreakdown({ ledger, records, kind, parentId });
  const shares = memberExpenses(ledger, records);
  const reimbursement = reimbursementReport({ ledger, start, end });
  return (
    <div className="report-extra">
      <section className="panel" aria-label="回款与分摊">
        <h2>回款与分摊</h2>
        <p className="muted">
          统计 {start} 至 {end} 的已确认、未删除且非重复的可报销支出；
          已确认的关联退款和报销回款按截至 {end}{" "}
          抵减。当前可继续记录上限按全部已确认关联回款计算，金额为人民币记账金额。
        </p>
        <div className="report-summary">
          <div>
            <span>待回款</span>
            <strong>{reimbursementAmount(reimbursement.outstanding)}</strong>
          </div>
          <div>
            <span>已回款</span>
            <strong>{reimbursementAmount(reimbursement.received)}</strong>
          </div>
        </div>
        {reimbursement.rows.map((row, index) => (
          <div className="stat-row" key={row.record.id}>
            <div>
              <p>
                {isHidden || row.hasConflict
                  ? `原支出 ${index + 1}`
                  : row.record.merchant}
              </p>
              {row.hasConflict ? (
                <>
                  <p>数据状态需核对</p>
                  <p>存在重复关联或交易类型不一致，请检查原支出及异常关联。</p>
                </>
              ) : (
                <>
                  <p>
                    原金额 {amountLabel(row.record.amount)} · 已回款{" "}
                    {reimbursementAmount(row.received)} · 待回款{" "}
                    {reimbursementAmount(row.outstanding)}
                  </p>
                  <p>
                    当前可继续记录上限：
                    {reimbursementAmount(row.currentAvailable)}
                  </p>
                </>
              )}
              {onRecord ? (
                <Button
                  variant="subtle"
                  aria-label={`查看原支出 ${index + 1}`}
                  onClick={() => onRecord(row.record)}
                >
                  查看原支出
                </Button>
              ) : null}
              {row.returns.map((record, returnIndex) =>
                onRecord ? (
                  <Button
                    key={record.id}
                    variant="subtle"
                    aria-label={`查看回款 ${index + 1}-${returnIndex + 1}`}
                    onClick={() => onRecord(record)}
                  >
                    查看回款 {returnIndex + 1}
                  </Button>
                ) : null,
              )}
              {row.laterReturns.map((record, returnIndex) =>
                onRecord ? (
                  <Button
                    key={record.id}
                    variant="subtle"
                    aria-label={`查看截止日后回款 ${index + 1}-${returnIndex + 1}`}
                    onClick={() => onRecord(record)}
                  >
                    查看截止日后回款 {returnIndex + 1}
                  </Button>
                ) : null,
              )}
              {row.anomalies.map((record, returnIndex) =>
                onRecord ? (
                  <Button
                    key={record.id}
                    variant="subtle"
                    aria-label={`查看异常关联 ${index + 1}-${returnIndex + 1}`}
                    onClick={() => onRecord(record)}
                  >
                    查看异常关联 {returnIndex + 1}
                  </Button>
                ) : null,
              )}
              {onReimburse &&
              row.currentAvailable !== null &&
              row.currentAvailable > 0 ? (
                <Button
                  variant="outline"
                  aria-label={`记录回款 ${index + 1}`}
                  onClick={() => onReimburse(row.record)}
                >
                  记录回款
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {!reimbursement.rows.length ? <p>当前范围没有可报销支出。</p> : null}
      </section>
      <section className="panel">
        <h2>净资产曲线</h2>
        <p className="muted">
          按各期末及所选起止日估值；人民币记账金额保持历史汇率，账户按估值日期的归档状态统计。
        </p>
        {report.error ? <p role="alert">{report.error}</p> : null}
        {report.isLoading ? (
          <p role="status">正在查询各估值日的参考汇率…</p>
        ) : null}
        {report.rows.some((row) => row.amount === null) && !report.isLoading ? (
          <p role="status">部分日期缺少有效汇率，图中保留空缺。</p>
        ) : null}
        {isHidden ? (
          <p className="empty-panel">金额已隐藏，净资产曲线与明细暂不展示。</p>
        ) : (
          <>
            <div
              className="report-chart trend"
              role="group"
              aria-label="净资产曲线，金额明细见下方列表"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={report.rows.map((row) => ({
                    ...row,
                    value:
                      row.amount === null ? null : row.amount / MINOR_PER_YUAN,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis width={65} />
                  <Tooltip
                    formatter={(value) =>
                      `¥${Number(value).toFixed(MONEY_PRECISION)}`
                    }
                  />
                  <Line
                    dataKey="value"
                    name="净资产"
                    stroke="#a96140"
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details>
              <summary>查看净资产明细</summary>
              {report.rows.map((row) => (
                <p key={row.date}>
                  {row.date} ·{" "}
                  {row.amount === null
                    ? `未估值：缺少 ${row.missing.join("、")} 汇率`
                    : `¥${money(row.amount)}`}
                </p>
              ))}
            </details>
          </>
        )}
      </section>
      <div className="report-grid">
        <section className="panel">
          <h2>分类层级</h2>
          {parentId ? (
            <Button variant="subtle" onClick={() => setParent(undefined)}>
              返回一级分类
            </Button>
          ) : null}
          {categories.map((item, index) => (
            <div className="stat-row" key={item.id}>
              {item.hasChildren ? (
                <Button variant="subtle" onClick={() => setParent(item.id)}>
                  {isHidden ? `分类 ${index + 1}` : item.name} · 查看子分类
                </Button>
              ) : (
                <span>{isHidden ? `分类 ${index + 1}` : item.name}</span>
              )}
              <strong>{amountLabel(item.amount)}</strong>
            </div>
          ))}
          {!categories.length ? <p>当前范围没有分类流水。</p> : null}
        </section>
        <section className="panel">
          <h2>成员承担额</h2>
          <p className="muted">
            家庭净支出按分摊归属计算；退款、报销抵减原账单分摊，AA
            结算不重复计入。
          </p>
          {shares.map((item, index) => (
            <div className="stat-row" key={item.memberId}>
              <span>
                {item.memberId === "unassigned"
                  ? "未分配成员"
                  : isHidden
                    ? `成员 ${index + 1}`
                    : (members.find((member) => member.id === item.memberId)
                        ?.username ?? item.memberId)}
              </span>
              <strong>{amountLabel(item.amount)}</strong>
            </div>
          ))}
          {!shares.length ? <p>当前范围没有支出。</p> : null}
        </section>
      </div>
    </div>
  );
}
