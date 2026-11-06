// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { CSSProperties, ReactNode } from "react";
import { useToolHistory } from "../../apps/mobile/src/ui/tool-history";
import { RetainedToolPages } from "../../apps/mobile/src/ui/RetainedToolPages";
vi.mock("react-native", () => ({
  View: ({
    children,
    style,
  }: {
    children: ReactNode;
    style?: CSSProperties;
  }) => <div style={style}>{children}</div>,
  StyleSheet: { create: <T,>(value: T): T => value },
}));
afterEach(cleanup);
it("returns from review to the same overview or import instance before tools", () => {
  const { result } = renderHook(() => useToolHistory());
  act(() => result.current.open("tools-home"));
  act(() => result.current.open("overview-home"));
  const overviewId = result.current.entries[1]!.id;
  act(() => result.current.open("review"));
  act(() => result.current.back());
  expect(result.current.current).toBe("overview-home");
  expect(result.current.entries[1]!.id).toBe(overviewId);
  act(() => result.current.back());
  expect(result.current.current).toBe("tools-home");
  act(() => result.current.open("import"));
  const importId = result.current.entries[1]!.id;
  act(() => result.current.open("review"));
  act(() => result.current.back());
  expect(result.current.current).toBe("import");
  expect(result.current.entries[1]!.id).toBe(importId);
  act(() => result.current.clear());
  expect(result.current.current).toBeNull();
});

function HistoryHarness(): React.JSX.Element {
  const history = useToolHistory();
  return (
    <>
      <button onClick={() => history.open("import")}>打开导入</button>
      <button onClick={() => history.open("review")}>打开核对</button>
      <button onClick={history.back}>返回</button>
      <RetainedToolPages
        entries={history.entries}
        identity="demo"
        renderPage={(page) =>
          page === "import" ? <input aria-label="待导入文件" /> : <p>核对页</p>
        }
      />
    </>
  );
}
it("preserves an import screen's input when visiting review and returning", () => {
  render(<HistoryHarness />);
  fireEvent.click(screen.getByRole("button", { name: "打开导入" }));
  const input = screen.getByRole("textbox", {
    name: "待导入文件",
  }) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "待处理.csv" } });
  fireEvent.click(screen.getByRole("button", { name: "打开核对" }));
  expect(screen.queryByRole("textbox", { name: "待导入文件" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "返回" }));
  expect(
    (screen.getByRole("textbox", { name: "待导入文件" }) as HTMLInputElement)
      .value,
  ).toBe("待处理.csv");
});
