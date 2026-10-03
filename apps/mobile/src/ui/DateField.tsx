import { DATE_PART_WIDTH, DATE_KEY_LENGTH } from "../constants";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Button } from "react-native-paper";
import { localNow } from "../platform/runtime";
interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
}
function formatDate(date: Date): string {
  const pad = (part: number): string =>
    String(part).padStart(DATE_PART_WIDTH, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
export function DateField({
  label,
  value,
  onChange,
  withTime = false,
}: DateFieldProps): React.JSX.Element {
  function pick(): void {
    const parsed = new Date((value || localNow()).replace(" ", "T"));
    DateTimePickerAndroid.open({
      value: parsed,
      mode: "date",
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return;
        if (!withTime) {
          onChange(formatDate(date).slice(0, DATE_KEY_LENGTH));
          return;
        }
        DateTimePickerAndroid.open({
          value: date,
          mode: "time",
          is24Hour: true,
          onChange: (timeEvent, time) => {
            if (timeEvent.type === "set" && time) onChange(formatDate(time));
          },
        });
      },
    });
  }
  return (
    <Button
      mode="outlined"
      icon="calendar"
      onPress={pick}
      contentStyle={{ minHeight: 48 }}
      style={{ marginBottom: 12 }}
    >
      {label}：{value || "请选择"}
    </Button>
  );
}
