import { DATE_KEY_LENGTH, MONTH_KEY_LENGTH } from "../constants";
import { Button } from "react-native-paper";
import { StyleSheet, View } from "react-native";

interface ReportRangePresetsProps {
  today: string;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}
const QUARTER_MONTH_OFFSET = 2;
const YEAR_KEY_LENGTH = 4;
export function ReportRangePresets({
  today,
  start,
  end,
  onChange,
}: ReportRangePresetsProps): React.JSX.Element {
  const quarter = new Date(today + "T00:00:00Z");
  quarter.setUTCDate(1);
  quarter.setUTCMonth(quarter.getUTCMonth() - QUARTER_MONTH_OFFSET);
  const presets = [
    { label: "本月", start: today.slice(0, MONTH_KEY_LENGTH) + "-01" },
    { label: "近3月", start: quarter.toISOString().slice(0, DATE_KEY_LENGTH) },
    { label: "今年", start: today.slice(0, YEAR_KEY_LENGTH) + "-01-01" },
  ];
  return (
    <View style={styles.row}>
      {presets.map((preset) => {
        const isSelected = start === preset.start && end === today;
        return (
          <Button
            key={preset.label}
            compact
            mode={isSelected ? "contained-tonal" : "text"}
            style={styles.button}
            contentStyle={styles.content}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(preset.start, today)}
          >
            {preset.label}
          </Button>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  button: { flexGrow: 1 },
  content: { minHeight: 48 },
});
