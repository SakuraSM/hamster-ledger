// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { LedgerViewBoundary } from "../apps/web/src/ui/LedgerViewBoundary";
vi.mock("@mantine/core", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("allows recovery even when the requested tools route is already selected", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let broken = true;
  function View() {
    if (broken) throw new Error("synthetic-render-overflow");
    return <p>恢复内容</p>;
  }
  render(
    <LedgerViewBoundary
      onRecovery={() => {
        broken = false;
      }}
    >
      <View />
    </LedgerViewBoundary>,
  );
  expect(screen.getByRole("alert").textContent).toContain("数据已保留");
  fireEvent.click(screen.getByRole("button", { name: "打开工具与备份" }));
  expect(screen.getByText("恢复内容")).toBeTruthy();
});
