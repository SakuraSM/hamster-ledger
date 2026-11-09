// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "./helpers/render";
import { AppHeader } from "../apps/web/src/components/AppHeader";

vi.mock("../apps/web/src/auth/auth-context", () => ({
  useAuth: () => ({ user: { username: "test.user" } }),
}));
afterEach(cleanup);

it("routes book, account and tools entries to their own destinations", () => {
  const books = vi.fn(),
    account = vi.fn(),
    tools = vi.fn();
  render(
    <AppHeader
      bookName="我的账本"
      page="inbox"
      mode="personal"
      months={[]}
      month="2026-11"
      onMonth={vi.fn()}
      onAdd={vi.fn()}
      onImport={vi.fn()}
      onBooks={books}
      onAccount={account}
      onSettings={tools}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "切换账本：我的账本" }));
  fireEvent.click(screen.getByRole("button", { name: "账号 test.user" }));
  fireEvent.click(screen.getByRole("button", { name: "工具与设置" }));
  expect(books).toHaveBeenCalledOnce();
  expect(account).toHaveBeenCalledOnce();
  expect(tools).toHaveBeenCalledOnce();
});
