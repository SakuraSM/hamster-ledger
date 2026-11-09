import { useState } from "react";
import tokens from "@hamster-ledger/design-tokens/tokens.json";
import { ReportRecordList } from "./ReportRecordList";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  money,
  reportDistribution,
  reportGroupRecords,
  type BillRecord,
} from "@hamster-ledger/core";

const CENTS_PER_YUAN = 100;
const MONEY_DIGITS = 2;
const UNSELECTED_OPACITY = 0.55;
const COLORS = tokens.chart.categories.map(
  (_, index) => `var(--chart-category-${index + 1})`,
);
interface ReportDistributionProps {
  groups: Array<{ name: string; amount: number }>;
  records: BillRecord[];
  dimension: "category" | "tag";
  kind: "支出" | "收入";
  isHidden: boolean;
  onRecord?: (record: BillRecord) => void;
}
export function ReportDistribution({
  groups,
  records,
  dimension,
  kind,
  isHidden,
  onRecord,
}: ReportDistributionProps): React.JSX.Element {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = groups.find((group) => group.name === selectedName);
  const distribution = reportDistribution(groups);
  const matching = selected
    ? reportGroupRecords({ records, dimension, kind, name: selected.name })
    : [];
  function toggleGroup(name: string): void {
    setSelectedName((current) => (current === name ? null : name));
  }
  return (
    <>
      {isHidden ? (
        <p className="empty-panel">金额已隐藏，图表和账单明细暂不展示。</p>
      ) : distribution.slices.length ? (
        <div
          className="report-donut-wrap"
          role="group"
          aria-label={`${kind}分布图，可点击扇区或在下方选择分类`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                isAnimationActive={false}
                data={distribution.slices.map((slice) => ({
                  ...slice,
                  value: slice.amount / CENTS_PER_YUAN,
                }))}
                dataKey="value"
                nameKey="name"
                innerRadius="68%"
                outerRadius="90%"
                paddingAngle={2}
                stroke="none"
              >
                {distribution.slices.map((slice, index) => (
                  <Cell
                    key={slice.name}
                    fill={COLORS[index % COLORS.length]}
                    opacity={
                      selected && selected.name !== slice.name
                        ? UNSELECTED_OPACITY
                        : 1
                    }
                    onClick={() => toggleGroup(slice.name)}
                    cursor="pointer"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `¥${Number(value).toFixed(MONEY_DIGITS)}`}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="report-donut-center" aria-hidden="true">
            <span>正向{dimension === "tag" ? "标签" : "分类"}合计</span>
            <strong>
              {distribution.total === null
                ? "金额过大"
                : `¥${money(distribution.total)}`}
            </strong>
          </div>
        </div>
      ) : (
        <p className="empty-panel">这个时间段暂无正向{kind}分布</p>
      )}
      {dimension === "tag" ? (
        <p className="muted small">一笔账单可含多个标签，标签合计可能重复。</p>
      ) : null}
      {distribution.hasNegativeGroups && !isHidden ? (
        <p className="muted small">
          退款超过支出的分类单独列出，不计入正向占比。
        </p>
      ) : null}
      <div className="report-group-list">
        {groups.map((group, index) => {
          const sliceIndex = distribution.slices.findIndex(
            (slice) => slice.name === group.name,
          );
          const slice = distribution.slices[sliceIndex];
          const label = isHidden
            ? `${dimension === "category" ? "分类" : "标签"} ${index + 1}`
            : group.name;
          return (
            <button
              type="button"
              className="report-group-row"
              key={group.name}
              disabled={isHidden}
              aria-pressed={selected?.name === group.name && !isHidden}
              onClick={() => toggleGroup(group.name)}
            >
              <span className="report-group-name">
                <i
                  aria-hidden="true"
                  style={{
                    background: slice
                      ? COLORS[sliceIndex % COLORS.length]
                      : "var(--muted)",
                  }}
                />
                {label}
              </span>
              <span className="report-group-share">
                {isHidden
                  ? "••••"
                  : slice
                    ? `${slice.percent.toFixed(1)}%`
                    : "退款抵减"}
              </span>
              <strong>{isHidden ? "••••" : `¥${money(group.amount)}`}</strong>
            </button>
          );
        })}
      </div>
      {selected && !isHidden ? (
        <div
          className="report-group-detail"
          aria-label={`${selected.name}账单明细`}
        >
          <div className="section-heading">
            <h3>
              {selected.name} · {matching.length} 笔
            </h3>
            <button type="button" onClick={() => setSelectedName(null)}>
              收起
            </button>
          </div>
          <ReportRecordList
            key={selected.name}
            records={matching}
            onRecord={onRecord}
          />
        </div>
      ) : null}
    </>
  );
}
