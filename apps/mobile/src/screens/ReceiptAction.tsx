import type { ReactNode } from "react";
import { Button, useTheme } from "react-native-paper";
import tokens from "@hamster-ledger/design-tokens/tokens.json";

interface ReceiptActionProps {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  accessibilityLabel?: string;
}
export function ReceiptAction({
  children,
  onPress,
  disabled,
  loading,
  icon,
  accessibilityLabel,
}: ReceiptActionProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <Button
      mode="contained"
      buttonColor={theme.dark ? theme.colors.primary : tokens.color.action}
      textColor={theme.dark ? theme.colors.onPrimary : tokens.color.actionText}
      contentStyle={{ minHeight: 48 }}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      icon={icon}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Button>
  );
}
