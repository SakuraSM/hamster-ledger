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
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { useBookMembers, useReportData } from "@hamster-ledger/ledger-react";
import { useNetworkClient } from "../../hooks/useNetworkController";
export function ExtendedReports({
  ledger,
  records,
  start,
  end,
  kind,
  bookId,
}: {
  ledger: Ledger;
  records: BillRecord[];
  start: string;
  end: string;
  kind: "支出" | "收入";
  bookId?: string;
}): React.JSX.Element {
  const client = useNetworkClient();
  const members = useBookMembers(client, bookId);
  const report = useReportData({ ledger, start, end, client });
  const [parentId, setParent] = useState<string>();
  const categories = categoryBreakdown({ ledger, records, kind, parentId });
  const shares = memberExpenses(ledger, records);
  return (
    <div className="report-extra">
      <section className="panel">
        <h2>净资产曲线</h2>
        <p className="muted">
          按各期末及所选起止日估值；人民币记账金额保持历史汇率。归档账户不参与估值。
        </p>
        {report.error ? <p role="alert">{report.error}</p> : null}
        {report.isLoading ? (
          <p role="status">正在查询各估值日的参考汇率…</p>
        ) : null}
        {report.rows.some((row) => row.amount === null) && !report.isLoading ? (
          <p role="status">部分日期缺少有效汇率，图中保留空缺。</p>
        ) : null}
        <div
          className="report-chart trend"
          role="group"
          aria-label="净资产曲线，金额明细见下方列表"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={report.rows.map((row) => ({
                ...row,
                value: row.amount === null ? null : row.amount / 100,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis width={65} />
              <Tooltip formatter={(value) => `¥${Number(value).toFixed(2)}`} />
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
      </section>
      <div className="report-grid">
        <section className="panel">
          <h2>分类层级</h2>
          {parentId ? (
            <Button variant="subtle" onClick={() => setParent(undefined)}>
              返回一级分类
            </Button>
          ) : null}
          {categories.map((item) => (
            <div className="stat-row" key={item.id}>
              {item.hasChildren ? (
                <Button variant="subtle" onClick={() => setParent(item.id)}>
                  {item.name} · 查看子分类
                </Button>
              ) : (
                <span>{item.name}</span>
              )}
              <strong>¥{money(item.amount)}</strong>
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
          {shares.map((item) => (
            <div className="stat-row" key={item.memberId}>
              <span>
                {item.memberId === "unassigned"
                  ? "未分配成员"
                  : (members.find((member) => member.id === item.memberId)
                      ?.username ?? item.memberId)}
              </span>
              <strong>¥{money(item.amount)}</strong>
            </div>
          ))}
          {!shares.length ? <p>当前范围没有支出。</p> : null}
        </section>
      </div>
    </div>
  );
}
