// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { APP_ROUTES } from "../../apps/mobile/src/ui/AppNavigation";
import { ToolsScreen } from "../../apps/mobile/src/screens/ToolsScreen";

vi.mock("react-native", () => ({ StyleSheet: { hairlineWidth: 1 } }));
vi.mock("../../apps/mobile/src/ui/Icons", () => ({ AppIcon: () => null }));
vi.mock("../../apps/mobile/src/ui/motion", () => ({
  NATIVE_SCENE_EASING: () => 0,
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("react-native-paper", () => {
  const ListItem = ({
    title,
    onPress,
  }: {
    title: string;
    onPress?: () => void;
  }) => <button onClick={onPress}>{title}</button>;
  const Container = ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  );
  return {
    BottomNavigation: () => null,
    useTheme: () => ({ colors: {} }),
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    List: {
      Item: ListItem,
      Section: Container,
      Subheader: Container,
      Icon: () => null,
    },
  };
});
afterEach(cleanup);
it("uses the three approved primary destinations", () => {
  expect(APP_ROUTES.map((route) => route.title)).toEqual([
    "待处理",
    "账单",
    "资产",
  ]);
});
it("keeps overview and reports accessible through tools", () => {
  const overview = vi.fn(),
    reports = vi.fn();
  render(
    <ToolsScreen
      ledger={createDemoLedger()}
      storageDescription="本机账本"
      onAssets={vi.fn()}
      onSelect={vi.fn()}
      onOverview={overview}
      onReports={reports}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "收支总览" }));
  fireEvent.click(screen.getByRole("button", { name: "收支报表" }));
  expect(overview).toHaveBeenCalledOnce();
  expect(reports).toHaveBeenCalledOnce();
});
it("lists each pending workflow only once and opens it", () => {
  const select = vi.fn();
  render(
    <ToolsScreen
      ledger={createDemoLedger()}
      storageDescription="本机账本"
      onAssets={vi.fn()}
      onSelect={select}
      onOverview={vi.fn()}
      onReports={vi.fn()}
    />,
  );
  for (const name of ["AI 记账与凭证", "支付消息记账", "重复核对"]) {
    expect(screen.getAllByRole("button", { name })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name }));
  }
  expect(select.mock.calls.map(([page]) => page)).toEqual([
    "ai",
    "payment-inbox",
    "review",
  ]);
});
