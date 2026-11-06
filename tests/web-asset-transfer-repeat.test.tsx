// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "./helpers/render";
import { EMPTY_LEDGER, type AssetAccount } from "@hamster-ledger/core";
import { TransferEditor } from "../apps/web/src/components/assets/TransferEditor";

const { testClient } = vi.hoisted(() => ({ testClient: { request: vi.fn() } }));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => testClient,
}));
// Delivers an explicit repeated selection event, which some select implementations suppress.
vi.mock("../apps/web/src/ui/Choice", () => ({
  Choice: ({
    label,
    value,
    onChange,
    children,
    disabled,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
    disabled?: boolean;
  }) => (
    <div>
      <label>
        {label}
        <select
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          disabled={disabled}
        >
          {children}
        </select>
      </label>
      <button
        type="button"
        aria-label={`再次选择${label}`}
        onClick={() => onChange(value)}
      >
        再次选择
      </button>
    </div>
  ),
}));
afterEach(cleanup);
const source: AssetAccount = {
  id: "cny",
  name: "人民币账户",
  kind: "asset",
  type: "银行卡",
  currency: "CNY",
  openingBalance: 100000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [],
};
const foreign: AssetAccount = {
  ...source,
  id: "usd",
  name: "美元账户",
  currency: "USD",
};

it("keeps received amount and rate on repeated source or destination selection", () => {
  render(
    <TransferEditor
      ledger={{ ...EMPTY_LEDGER, accounts: [source, foreign] }}
      sourceId="cny"
      isHidden={false}
      onSave={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "转入账户" }), {
    target: { value: "usd" },
  });
  const received = screen.getByRole("textbox", {
    name: "实际转入金额（USD）",
  }) as HTMLInputElement;
  const rate = screen.getByRole("textbox", {
    name: "转入汇率：1 USD 折合人民币",
  }) as HTMLInputElement;
  fireEvent.change(received, { target: { value: "12.34" } });
  fireEvent.change(rate, { target: { value: "7.10" } });
  fireEvent.click(screen.getByRole("button", { name: "再次选择转入账户" }));
  expect(received.value).toBe("12.34");
  expect(rate.value).toBe("7.10");
  fireEvent.click(screen.getByRole("button", { name: "再次选择转出账户" }));
  expect(received.value).toBe("12.34");
  expect(rate.value).toBe("7.10");
});
