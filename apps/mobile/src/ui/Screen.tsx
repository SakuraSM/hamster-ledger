import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Text, HelperText } from "react-native-paper";
export function Screen({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text variant="titleLarge" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}
export function ErrorMessage({
  message,
}: {
  message: string;
}): React.JSX.Element | null {
  return message ? (
    <HelperText type="error" visible accessibilityLiveRegion="assertive">
      {message}
    </HelperText>
  ) : null;
}
export const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 20, paddingBottom: 100, gap: 16 },
  section: { gap: 12, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  field: { marginBottom: 12 },
  card: { padding: 16, gap: 10 },
  amount: { fontVariant: ["tabular-nums"] },
});
