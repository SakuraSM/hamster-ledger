import { Component, type ReactNode } from "react";
import { Button, Text } from "react-native-paper";
import { Screen } from "./Screen";
export class LedgerViewBoundary extends Component<
  { children: ReactNode; onRecovery: () => void; resetKey: string },
  { failed: boolean; resetKey: string }
> {
  state = { failed: false, resetKey: this.props.resetKey };
  static getDerivedStateFromProps(
    props: { resetKey: string },
    state: { resetKey: string },
  ) {
    return props.resetKey === state.resetKey
      ? null
      : { failed: false, resetKey: props.resetKey };
  }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <Screen>
        <Text variant="headlineSmall" accessibilityRole="alert">
          此页面暂时无法计算
        </Text>
        <Text>
          账本数据已保留。可以先导出备份，或切换账本后检查金额、余额基准和汇率。
        </Text>
        <Button
          onPress={() => {
            this.setState({ failed: false });
            this.props.onRecovery();
          }}
        >
          打开备份
        </Button>
        <Button onPress={() => this.setState({ failed: false })}>
          重试页面
        </Button>
      </Screen>
    );
  }
}
