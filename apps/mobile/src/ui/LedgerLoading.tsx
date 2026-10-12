import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

interface LedgerLoadingProps {
  error: string;
}
export function LedgerLoading({
  error,
}: LedgerLoadingProps): React.JSX.Element {
  return (
    <View style={styles.content}>
      <ActivityIndicator animating={!error} />
      <Text>
        {error ? "本机数据已保留，读取失败时禁止写入。" : "正在打开加密账本…"}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
});
