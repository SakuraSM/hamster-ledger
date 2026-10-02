const MILLISECONDS_PER_DAY = 86400000;
const CENTS_PER_YUAN = 100;
const CHART_TICK_INTERVAL = 5;
const MONTH_DAY_START = 5;
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import {
  type BillRecord,
  cycleRange,
  addDays,
  summarize,
} from "@hamster-ledger/core";
const TWO_DIGITS = 2;
export function DailyChart({
  records,
  month,
  cycleStartDay = 1,
}: {
  records: BillRecord[];
  month: string;
  cycleStartDay?: number;
}): React.JSX.Element {
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const range = cycleRange(month, cycleStartDay);
  const days = Math.round(
    (Date.parse(range.end) - Date.parse(range.start)) / MILLISECONDS_PER_DAY,
  );
  const daily = Array.from({ length: days }, (_, index) => {
    const date = addDays(range.start, index);
    return {
      day: date,
      amount:
        summarize(records.filter((record) => record.date.startsWith(date)))
          .expense / CENTS_PER_YUAN,
    };
  });
  return (
    <div className="chart-container" role="group" aria-label="每日支出柱状图">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={daily}
          margin={{ top: 16, right: 18, left: -20, bottom: 0 }}
          onMouseLeave={() => setActiveDay(null)}
        >
          <CartesianGrid
            stroke="#eadfd3"
            vertical={false}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#86796e", fontSize: 12 }}
            interval={0}
            tickFormatter={(day: string, index: number) =>
              index % CHART_TICK_INTERVAL === 0 || index === days - 1
                ? day.slice(MONTH_DAY_START).replace("-", ".")
                : ""
            }
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#86796e", fontSize: 12 }}
            width={60}
            tickCount={4}
          />
          <Tooltip
            cursor={false}
            contentStyle={{
              background: "#a95f38",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
            }}
            itemStyle={{ color: "#fff" }}
            labelFormatter={(label) =>
              String(label).slice(MONTH_DAY_START).replace("-", ".")
            }
            formatter={(value) => [
              `¥${Number(value).toFixed(TWO_DIGITS)}`,
              "支出",
            ]}
          />
          <Bar
            dataKey="amount"
            maxBarSize={12}
            radius={[TWO_DIGITS, TWO_DIGITS, 0, 0]}
            onMouseEnter={(_, index) => setActiveDay(index)}
            isAnimationActive={false}
          >
            {daily.map((day, index) => (
              <Cell
                key={day.day}
                fill={
                  activeDay === index || index === days - 1
                    ? "#aa613a"
                    : "#d6a587"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
