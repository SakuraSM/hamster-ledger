// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "./helpers/render";
import { EMPTY_LEDGER } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import type { CloudController } from "../apps/web/src/hooks/useCloudSync";
import { ToolsPage } from "../apps/web/src/components/settings/ToolsPage";

vi.mock("../apps/web/src/components/ai/AiPanel", () => ({
  AiPanel: () => <p>AI 工具</p>,
}));
vi.mock("../apps/web/src/components/auth/AccountSecurityPanel", () => ({
  AccountSecurityPanel: () => <p>账号安全内容</p>,
}));
afterEach(cleanup);

const controller = {
  ledger: EMPTY_LEDGER,
  books: [{ id: "demo", name: "示例账本" }],
  mode: "demo",
  canUndo: false,
} as unknown as LedgerController;
const sync = { isLinked: false } as CloudController;

it("opens a requested destination and retains an unsaved book name while navigating tools", () => {
  const view = render(
    <ToolsPage
      controller={controller}
      sync={sync}
      onNavigate={vi.fn()}
      onMonth={vi.fn()}
      destination={{ section: "books", serial: 1 }}
    />,
  );
  const name = screen.getByLabelText(/新账本名称/) as HTMLInputElement;
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "返回工具与设置" }),
  );
  fireEvent.change(name, { target: { value: "家庭账本草稿" } });
  fireEvent.click(screen.getByRole("button", { name: "返回工具与设置" }));
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "工具与设置" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "AI 记账与凭证" }));
  expect(screen.getByText("AI 工具")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "返回工具与设置" }));
  fireEvent.click(screen.getByRole("button", { name: "账本管理" }));
  expect((screen.getByLabelText(/新账本名称/) as HTMLInputElement).value).toBe(
    "家庭账本草稿",
  );
  view.rerender(
    <ToolsPage
      controller={controller}
      sync={sync}
      onNavigate={vi.fn()}
      onMonth={vi.fn()}
      destination={{ section: "account", serial: 2 }}
    />,
  );
  expect(screen.getByText("账号安全内容")).toBeTruthy();
});
