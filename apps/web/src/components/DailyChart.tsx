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

import type { BillRecord } from "@hamster-ledger/core";
const DAY_START = 8;
const DAY_END = 10;
const PERCENT_SCALE = 100;
const MONTH_START = 5;
const MID_MONTH_TICK = 15;
const LATE_MONTH_TICK = 20;
const LAST_WEEK_TICK = 25;
const TWO_DIGITS = 2;
export function DailyChart({
  records,
  month,
}: {
  records: BillRecord[];
  month: string;
}): React.JSX.Element {
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const daily = Array.from({ length: days }, (_, index) => ({
    day: index + 1,
    amount:
      records
        .filter(
          (record) =>
            Number(record.date.slice(DAY_START, DAY_END)) === index + 1 &&
            record.kind === "支出",
        )
        .reduce((total, record) => total + record.amount, 0) / PERCENT_SCALE,
  }));
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
            tickFormatter={(day: number) =>
              [
                1,
                MONTH_START,
                DAY_END,
                MID_MONTH_TICK,
                LATE_MONTH_TICK,
                LAST_WEEK_TICK,
                days,
              ].includes(day)
                ? `${month.slice(MONTH_START)}.${String(day).padStart(TWO_DIGITS, "0")}`
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
              `${month.slice(MONTH_START)}.${String(label).padStart(TWO_DIGITS, "0")}`
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
                  activeDay === index || day.day === days
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
