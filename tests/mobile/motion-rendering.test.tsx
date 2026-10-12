// @vitest-environment jsdom
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ViewProps } from "react-native";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { NavigationLayer } from "../../apps/mobile/src/ui/NavigationLayer";
import { RecordRow } from "../../apps/mobile/src/screens/RecordRow";
const probes = vi.hoisted(() => ({
  row: vi.fn(),
  timing: vi.fn(),
  setValue: vi.fn(),
  stopped: vi.fn(),
}));
vi.mock("react-native", () => {
  const view = (props: ViewProps) => (
    <div
      aria-hidden={
        props.accessibilityElementsHidden ||
        props.importantForAccessibility === "no-hide-descendants"
      }
      data-pointer-events={props.pointerEvents}
    >
      {props.children}
    </div>
  );
  return {
    View: view,
    Keyboard: { dismiss: vi.fn() },
    StyleSheet: {
      create: <Styles,>(styles: Styles): Styles => styles,
      absoluteFill: {},
    },
    Easing: { bezier: () => (value: number) => value },
    Animated: {
      Value: class {
        setValue(value: number): void {
          probes.setValue(value);
        }
        interpolate(): number {
          return 0;
        }
      },
      View: view,
      timing: (_value: unknown, config: unknown) => {
        probes.timing(config);
        return { start: () => undefined, stop: probes.stopped };
      },
    },
  };
});
vi.mock("react-native-paper", () => ({
  useTheme: () => ({
    dark: false,
    colors: { onSurfaceVariant: "#75685d", background: "#fffcf7" },
  }),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  List: {
    Item: ({ title, onPress }: { title: string; onPress: () => void }) => {
      probes.row(title);
      return <button onClick={onPress}>{title}</button>;
    },
    Icon: () => null,
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function ToolProbe({
  onUnmount,
}: {
  onUnmount: () => void;
}): React.JSX.Element {
  useEffect(() => onUnmount, [onUnmount]);
  return <button>核对</button>;
}
describe("native motion lifecycle", () => {
  it("unmounts a closed tool immediately while retaining the underlying page", () => {
    const unmount = vi.fn();
    const view = render(
      <NavigationLayer tool={<ToolProbe onUnmount={unmount} />}>
        <input aria-label="报表日期" defaultValue="2026-09-01" />
      </NavigationLayer>,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    const input = screen.getByDisplayValue("2026-09-01");
    view.rerender(
      <NavigationLayer tool={null}>
        <input aria-label="报表日期" defaultValue="2026-09-01" />
      </NavigationLayer>,
    );
    expect(unmount).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "核对" })).toBeNull();
    expect(screen.getByRole("textbox")).toBe(input);
    expect(probes.timing).toHaveBeenLastCalledWith(
      expect.objectContaining({
        useNativeDriver: true,
        isInteraction: false,
        toValue: 0,
      }),
    );
  });
  it("does not restart entry motion on a same-page data refresh and stops it on close", () => {
    const view = render(
      <NavigationLayer transitionKey="preferences" tool={<span>已保存</span>}>
        主页面
      </NavigationLayer>,
    );
    const count = probes.timing.mock.calls.length;
    view.rerender(
      <NavigationLayer transitionKey="preferences" tool={<span>再次保存</span>}>
        主页面
      </NavigationLayer>,
    );
    expect(probes.timing).toHaveBeenCalledTimes(count);
    view.rerender(<NavigationLayer tool={null}>主页面</NavigationLayer>);
    expect(probes.stopped).toHaveBeenCalledOnce();
  });
  it("respects reduced motion without scheduling an animation", () => {
    const view = render(
      <NavigationLayer hasReducedMotion tool={<span>设置</span>}>
        主页面
      </NavigationLayer>,
    );
    expect(probes.timing).not.toHaveBeenCalled();
    expect(probes.setValue).toHaveBeenLastCalledWith(1);
    view.rerender(
      <NavigationLayer hasReducedMotion tool={null}>
        主页面
      </NavigationLayer>,
    );
    expect(probes.setValue).toHaveBeenLastCalledWith(0);
    view.rerender(
      <NavigationLayer tool={<span>设置</span>}>主页面</NavigationLayer>,
    );
    view.rerender(<NavigationLayer tool={null}>主页面</NavigationLayer>);
    const writes = probes.setValue.mock.calls.length;
    view.rerender(
      <NavigationLayer hasReducedMotion tool={null}>
        主页面
      </NavigationLayer>,
    );
    expect(probes.setValue).toHaveBeenCalledTimes(writes + 1);
    expect(probes.setValue).toHaveBeenLastCalledWith(0);
  });
  it("does not redraw an unchanged financial row when its parent updates", () => {
    const record = createDemoLedger().records[0],
      open = vi.fn();
    const view = render(<RecordRow record={record} onPress={open} />);
    view.rerender(<RecordRow record={record} onPress={open} />);
    expect(probes.row).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: record.merchant }));
    expect(open).toHaveBeenCalledWith(record);
    view.rerender(
      <RecordRow
        record={{ ...record, merchant: "更新的商户" }}
        onPress={open}
      />,
    );
    expect(probes.row).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "更新的商户" })).toBeTruthy();
  });
});
