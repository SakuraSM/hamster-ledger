import { useMemo } from "react";
import { Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme, Text } from "react-native-paper";
import { monthPreview, type Ledger } from "@hamster-ledger/core";
export function AssetSpark({
  ledger,
  date,
  onOpen,
}: {
  ledger: Ledger;
  date: string;
  onOpen: () => void;
}) {
  const path = useMemo(() => monthPreview(ledger, date), [ledger, date]),
    theme = useTheme();
  return path ? (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel="展开本月净资产走势"
      style={{ minHeight: 44, alignItems: "flex-end" }}
    >
      <Text variant="labelSmall">本月走势</Text>
      <Svg width={82} height={30} viewBox="0 0 100 38">
        <Path
          d={path}
          fill="none"
          stroke={theme.colors.primary}
          strokeWidth={2}
        />
      </Svg>
    </Pressable>
  ) : null;
}
