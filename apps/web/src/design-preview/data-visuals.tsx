import { NOVEMBER_DAYS, NOVEMBER_AMOUNTS, WEEKDAYS } from "./calendar-fixture";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  LineChart,
  Line,
  YAxis,
} from "recharts";
import { DesignIcon } from "./icons";
import type { BlockProps } from "./model";
const BAR_CORNER_RADIUS = 5;
export function VisualChart({ block }: BlockProps): React.JSX.Element {
  const rows =
    block.items?.map((item) => ({
      label: item.label,
      amount: Number(item.value),
    })) ?? [];
  const isNetWorth = block.heading === "净资产变化";
  return (
    <section className="block chart-block">
      <h2>{block.heading}</h2>
      <div
        className="chart"
        role="img"
        aria-label={rows.map((row) => `${row.label}：${row.amount}`).join("；")}
      >
        <ResponsiveContainer width="100%" height="100%">
          {isNetWorth ? (
            <LineChart
              data={rows}
              margin={{ top: 18, right: 14, bottom: 0, left: 10 }}
            >
              <CartesianGrid vertical={false} stroke="#e9e6df" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#62684f" }}
              />
              <YAxis hide domain={["dataMin - 1000", "dataMax + 1000"]} />
              <Tooltip formatter={(value) => `¥${value}`} />
              <Line
                type="linear"
                dataKey="amount"
                stroke="#747d4c"
                strokeWidth={2.5}
                dot={{ fill: "#c65e35", strokeWidth: 0, r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          ) : (
            <BarChart
              data={rows}
              margin={{ top: 12, right: 8, bottom: 0, left: 8 }}
            >
              <CartesianGrid vertical={false} stroke="#e9e6df" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#62684f" }}
              />
              <Tooltip formatter={(value) => `¥${value}`} />
              <Bar
                dataKey="amount"
                fill="#cd6d44"
                radius={[BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0]}
                maxBarSize={30}
                isAnimationActive={false}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
export function MonthCalendar(): React.JSX.Element {
  return (
    <section className="block month-calendar">
      <div className="calendar-weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {NOVEMBER_DAYS.map((cell) => (
          <button
            key={cell.date}
            type="button"
            className={`${cell.isCurrentMonth ? "" : "outside"} ${cell.isToday ? "today" : ""}`}
            aria-label={`${cell.date}${cell.isToday ? "，今天" : ""}`}
          >
            <strong>{cell.day}</strong>
            <small>
              {cell.isCurrentMonth ? (NOVEMBER_AMOUNTS[cell.day] ?? "") : ""}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
export function NumericPad(): React.JSX.Element {
  return (
    <div className="keypad">
      {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "删除"].map(
        (key) => (
          <button type="button" key={key}>
            {key === "删除" ? <DesignIcon name="back" /> : key}
          </button>
        ),
      )}
    </div>
  );
}
export function ThemeTiles({
  block,
  onNavigate,
}: BlockProps): React.JSX.Element {
  return (
    <section className="block theme-tiles">
      {block.items?.map((item, index) => (
        <button
          key={item.label}
          type="button"
          className={`theme-tile theme-${index} ${item.selected ? "selected" : ""}`}
          onClick={() => (item.target ? onNavigate(item.target) : undefined)}
        >
          <span className="mini-sheet">
            <small>本月支出</small>
            <strong>¥1,286.40</strong>
            <span>收入 ¥8,500.00</span>
          </span>
          <b>{item.label}</b>
          {item.selected ? <DesignIcon name="check" size={18} /> : null}
        </button>
      ))}
    </section>
  );
}
