import {
  DATE_KEY_LENGTH,
  MONTH_KEY_LENGTH,
  DAYS_PER_WEEK,
  DATE_PART_WIDTH,
} from "../constants";
const MONDAY_OFFSET = 6;
import { useState } from "react";
import { View } from "react-native";
import { Button, Text, IconButton, useTheme } from "react-native-paper";
import {
  summarize,
  calendarHeat,
  money,
  type Ledger,
  type BillRecord,
} from "@hamster-ledger/core";
import { Screen } from "../ui/Screen";
import { RecordRow } from "./RecordRow";
import { localNow } from "../platform/runtime";
interface CalendarScreenProps {
  ledger: Ledger;
  onRecord: (record: BillRecord) => void;
  onAdd: (date: string) => void;
}
export function CalendarScreen({
  ledger,
  onRecord,
  onAdd,
}: CalendarScreenProps): React.JSX.Element {
  const [selected, setSelected] = useState(
    localNow().slice(0, DATE_KEY_LENGTH),
  );
  const month = selected.slice(0, MONTH_KEY_LENGTH);
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(year, monthNumber, 0).getDate();
  const offset =
    (new Date(year, monthNumber - 1, 1).getDay() + MONDAY_OFFSET) %
    DAYS_PER_WEEK;
  const theme = useTheme();
  const records = ledger.records.filter(
    (record) => !record.isDeleted && record.status === "confirmed",
  );
  const daily = records.filter((record) => record.date.startsWith(selected));
  const totals = summarize(daily);
  const heat = calendarHeat(ledger, month);
  const heatColors = [
    theme.colors.surface,
    "#faf0e5",
    "#f4dfca",
    "#edc5a6",
    "#e0a780",
  ];
  function move(delta: number): void {
    const date = new Date(year, monthNumber - 1 + delta, 1);
    setSelected(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(DATE_PART_WIDTH, "0")}-01`,
    );
  }
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        账单日历
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton
          icon="chevron-left"
          accessibilityLabel="上个月"
          onPress={() => move(-1)}
        />
        <Text variant="titleLarge">{month}</Text>
        <IconButton
          icon="chevron-right"
          accessibilityLabel="下个月"
          onPress={() => move(1)}
        />
      </View>
      <View style={{ flexDirection: "row" }}>
        {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
          <Text key={day} style={{ width: "14.285%", textAlign: "center" }}>
            {day}
          </Text>
        ))}
      </View>
      <Text>底色越深，当日净支出越多。</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {Array.from({ length: offset }, (_, index) => (
          <View key={`offset-${index}`} style={{ width: "14.285%" }} />
        ))}
        {Array.from({ length: count }, (_, index) => {
          const day = index + 1;
          const date = `${month}-${String(day).padStart(DATE_PART_WIDTH, "0")}`;
          const hasRecords = records.some((record) =>
            record.date.startsWith(date),
          );
          return (
            <View key={date} style={{ width: "14.285%" }}>
              <Button
                compact
                mode={date === selected ? "contained" : "text"}
                onPress={() => setSelected(date)}
                accessibilityLabel={`${date}，净支出 ${money(heat[index]?.expense ?? 0)} 元`}
                style={{
                  borderRadius: 12,
                  backgroundColor:
                    date === selected
                      ? theme.colors.primary
                      : heatColors[heat[index]?.level ?? 0],
                }}
                contentStyle={{ minHeight: 48 }}
              >
                {day}
              </Button>
              {hasRecords ? (
                <View
                  style={{
                    alignSelf: "center",
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: theme.colors.primary,
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <Text variant="titleMedium">
        {selected} · 支出 ¥{money(totals.expense)} · 收入 ¥
        {money(totals.income)}
      </Text>
      <Button mode="outlined" icon="plus" onPress={() => onAdd(selected)}>
        为这一天记一笔
      </Button>
      {daily.length ? (
        daily.map((record) => (
          <RecordRow key={record.id} record={record} onPress={onRecord} />
        ))
      ) : (
        <Text>这一天还没有已确认账单。</Text>
      )}
    </Screen>
  );
}
