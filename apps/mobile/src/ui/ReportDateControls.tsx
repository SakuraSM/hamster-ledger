import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { DateField } from "./DateField";
import { ReportRangePresets } from "./ReportRangePresets";

interface ReportDateControlsProps {
  today: string;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}
export function ReportDateControls({
  today,
  start,
  end,
  onChange,
}: ReportDateControlsProps): React.JSX.Element {
  const [isOpen, setOpen] = useState(false);
  return (
    <>
      <ReportRangePresets
        today={today}
        start={start}
        end={end}
        onChange={onChange}
      />
      <View style={styles.row}>
        <Text>
          {start} 至 {end}
        </Text>
        <Button
          compact
          accessibilityState={{ expanded: isOpen }}
          onPress={() => setOpen(!isOpen)}
        >
          {isOpen ? "收起日期" : "自定义日期"}
        </Button>
      </View>
      {isOpen ? (
        <>
          <DateField
            label="开始日期"
            value={start}
            onChange={(value) => onChange(value, end)}
          />
          <DateField
            label="结束日期"
            value={end}
            onChange={(value) => onChange(start, value)}
          />
        </>
      ) : null}
    </>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
});
