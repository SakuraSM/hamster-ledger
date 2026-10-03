import { UnstyledButton, Button } from "@mantine/core";
import { DateField } from "../../ui/DateField";
const MONDAY_OFFSET = 6;
const DAYS_PER_WEEK = 7;
const DATE_DIGITS = 2;
import { useState } from "react";
import {
  money,
  summarize,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { TransactionTable } from "../TransactionTable";
interface Props {
  ledger: Ledger;
  month: string;
  onMonth: (month: string) => void;
  onSelect: (record: BillRecord) => void;
  onAdd: (date: string) => void;
}
export function CalendarPage({
  ledger,
  month,
  onMonth,
  onSelect,
  onAdd,
}: Props): React.JSX.Element {
  const [selected, setSelected] = useState(month + "-01");
  const day = selected.startsWith(month) ? selected : month + "-01";
  const [year, monthNumber] = month.split("-").map(Number);
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const offset =
    (new Date(year, monthNumber - 1, 1).getDay() + MONDAY_OFFSET) %
    DAYS_PER_WEEK;
  const records = ledger.records.filter(
    (record) => !record.isDeleted && record.status === "confirmed",
  );
  const dayRecords = records.filter((record) => record.date.startsWith(day));
  const totals = summarize(dayRecords);
  return (
    <section className="planning-page">
      <div className="page-heading heading-with-action">
        <div>
          <h1>日子翻过，账目留下</h1>
          <p>按自然月查看每天的收入与支出。</p>
        </div>
        <DateField
          label={<>日历月份</>}
          type="month"
          value={month}
          onChange={(value) => value && onMonth(value)}
        />
      </div>
      <div className="calendar-grid" role="group" aria-label="账单日历">
        {["一", "二", "三", "四", "五", "六", "日"].map((name) => (
          <div className="calendar-weekday" key={name}>
            {name}
          </div>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <div key={`blank-${index}`} />
        ))}
        {Array.from({ length: dayCount }, (_, index) => {
          const date =
            month + "-" + String(index + 1).padStart(DATE_DIGITS, "0");
          const total = summarize(
            records.filter((record) => record.date.startsWith(date)),
          );
          return (
            <UnstyledButton
              type="submit"
              className={
                date === day ? "calendar-day selected" : "calendar-day"
              }
              key={date}
              onClick={() => setSelected(date)}
              aria-pressed={date === day}
            >
              <span>{index + 1}</span>
              {total.expense !== 0 ? (
                <small>支 {money(total.expense)}</small>
              ) : null}
              {total.income !== 0 ? (
                <small className="income">收 {money(total.income)}</small>
              ) : null}
            </UnstyledButton>
          );
        })}
      </div>
      <div className="section-heading">
        <div>
          <h2>{day}</h2>
          <p className="muted">
            支出 ¥{money(totals.expense)} · 收入 ¥{money(totals.income)}
          </p>
        </div>
        <Button
          variant="filled"
          type="submit"
          className="primary-button"
          onClick={() => onAdd(day)}
        >
          当天记一笔
        </Button>
      </div>
      <TransactionTable
        accounts={ledger.accounts}
        records={dayRecords}
        onSelect={onSelect}
      />
    </section>
  );
}
