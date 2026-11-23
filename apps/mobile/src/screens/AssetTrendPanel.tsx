import { valuationLabels, type ValuationMetric } from "@hamster-ledger/core";
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
  const [metric, setMetric] = useState<ValuationMetric>("netAssets");
  const [months, setMonths] = useState<number>(DEFAULT_TREND_MONTHS);
  const [earlier, setEarlier] = useState(false);
  const year = Number(end.slice(0, 4)) - (earlier ? 1 : 0);
  const selectedEnd = earlier ? year + "-12-31" : end;
  const start = earlier
    ? year + "-01-01"
    : netWorthRangeStart({ end: selectedEnd, months });
  return (
    <View style={styles.content}>
      <View style={styles.ranges}>
        {(Object.keys(valuationLabels) as ValuationMetric[]).map((k) => (
          <Button
            key={k}
            compact
            mode={k === metric ? "contained-tonal" : "outlined"}
            accessibilityState={{ selected: k === metric }}
            onPress={() => setMetric(k)}
          >
            {valuationLabels[k]}
          </Button>
        ))}
      </View>
      <View style={styles.ranges}>
        {RANGES.map((range) => (
          <Button
            key={range.months}
            compact
            mode={
              !earlier && months === range.months ? "contained-tonal" : "text"
            }
            accessibilityState={{
              selected: !earlier && months === range.months,
            }}
            onPress={() => {
              setEarlier(false);
              setMonths(range.months);
            }}
          >
            {range.label}
          </Button>
        ))}
      </View>
      <Button
        accessibilityState={{ selected: earlier }}
        onPress={() => setEarlier(!earlier)}
      >
        {earlier
          ? "返回估值日"
          : "查看上年（" + (Number(end.slice(0, 4)) - 1) + "）"}
      </Button>
      <NetWorthReport
        key={`${start}:${end}`}
        metric={metric}
        ledger={ledger}
        start={start}
        end={selectedEnd}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 12 },
  ranges: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
});
