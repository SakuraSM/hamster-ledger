import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";
import { netWorthRangeStart, type Ledger } from "@hamster-ledger/core";
import { NetWorthReport } from "./NetWorthReport";

const DEFAULT_TREND_MONTHS = 6;
const RANGES = [
  { label: "1 月", months: 1 },
  { label: "3 月", months: 3 },
  { label: "6 月", months: 6 },
  { label: "1 年", months: 12 },
] as const;
interface AssetTrendPanelProps {
  ledger: Ledger;
  end: string;
}
export function AssetTrendPanel({
  ledger,
  end,
}: AssetTrendPanelProps): React.JSX.Element {
  const [months, setMonths] = useState<number>(DEFAULT_TREND_MONTHS);
  const start = netWorthRangeStart({ end, months });
  return (
    <View style={styles.content}>
      <View style={styles.ranges}>
        {RANGES.map((range) => (
          <Button
            key={range.months}
            compact
            mode={months === range.months ? "contained-tonal" : "text"}
            accessibilityState={{ selected: months === range.months }}
            onPress={() => setMonths(range.months)}
          >
            {range.label}
          </Button>
        ))}
      </View>
      <NetWorthReport
        key={`${start}:${end}`}
        ledger={ledger}
        start={start}
        end={end}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 12 },
  ranges: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
});
