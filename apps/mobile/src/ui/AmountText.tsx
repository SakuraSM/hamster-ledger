import type { ComponentProps, ReactNode } from "react";
import { StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import tokens from "@hamster-ledger/design-tokens/tokens.json";
import { AMOUNT_TONES, type AmountTone } from "./amount-tones";
interface AmountTextProps extends Omit<
  ComponentProps<typeof Text>,
  "children" | "ref"
> {
  children: ReactNode;
  amount: number;
  tone: AmountTone;
  isMuted?: boolean;
}
export function useAmountColors(): Record<AmountTone, string> {
  const theme = useTheme();
  return {
    income: theme.dark ? tokens.color.incomeDark : tokens.color.income,
    expense: theme.dark ? tokens.color.expenseDark : tokens.color.expense,
    neutral: theme.colors.onSurfaceVariant,
  };
}
export function AmountText({
  children,
  amount,
  tone,
  isMuted = false,
  style,
  ...props
}: AmountTextProps): React.JSX.Element {
  const colors = useAmountColors();
  const resolvedTone = isMuted || amount === 0 ? AMOUNT_TONES.NEUTRAL : tone;
  return (
    <Text
      {...props}
      style={[styles.amount, { color: colors[resolvedTone] }, style]}
    >
      {children}
    </Text>
  );
}
const styles = StyleSheet.create({
  amount: { fontVariant: ["tabular-nums"], fontWeight: "600" },
});
