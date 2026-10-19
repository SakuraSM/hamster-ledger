import { Component, type ReactNode } from "react";
import { Button } from "@mantine/core";
export class LedgerViewBoundary extends Component<
  { children: ReactNode; onRecovery: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="panel" role="alert">
        <h2>此页面暂时无法计算</h2>
        <p>
          账本数据已保留。可以先打开工具页导出备份，或切换账本后检查金额、余额基准和汇率。
        </p>
        <Button
          onClick={() => {
            this.setState({ failed: false });
            this.props.onRecovery();
          }}
        >
          打开工具与备份
        </Button>
        <Button
          variant="subtle"
          onClick={() => this.setState({ failed: false })}
        >
          重试页面
        </Button>
      </section>
    );
  }
}
