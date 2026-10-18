// @vitest-environment jsdom
import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, type ViewProps } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import type { AssetAccount, BillRecord, Ledger } from "@hamster-ledger/core";
import { AccountRecordList } from "../../apps/mobile/src/screens/AccountRecordList";
import { NavigationLayer } from "../../apps/mobile/src/ui/NavigationLayer";

// These adapters expose native component behavior to React DOM; pixels and hit
// testing are verified separately with the actual Android APK.
vi.mock("react-native", () => ({
  Keyboard: { dismiss: vi.fn() },
  View: (props: ViewProps) => (
    <div
      aria-hidden={
        props.accessibilityElementsHidden ||
        props.importantForAccessibility === "no-hide-descendants"
      }
      data-pointer-events={props.pointerEvents}
    >
      {props.children}
    </div>
  ),
  Animated: {
    Value: class {
      setValue(): void {}
      interpolate(): number {
        return 0;
      }
    },
    timing: () => ({ start: () => undefined, stop: () => undefined }),
    View: (props: ViewProps) => (
      <div
        aria-hidden={
          props.accessibilityElementsHidden ||
          props.importantForAccessibility === "no-hide-descendants"
        }
        data-pointer-events={props.pointerEvents}
      >
        {props.children}
      </div>
    ),
  },
  Easing: { bezier: () => (value: number) => value },
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
    absoluteFill: {},
  },
}));
vi.mock("react-native-paper", () => {
  const container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useTheme: () => ({ colors: { background: "#fffcf7" } }),
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Card: Object.assign(container, { Content: container, Actions: container }),
    Button: ({
      children,
      onPress,
      disabled,
      accessibilityLabel,
    }: {
      children: ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      accessibilityLabel?: string;
    }) => (
      <button
        onClick={onPress}
        disabled={disabled}
        aria-label={accessibilityLabel}
      >
        {children}
      </button>
    ),
  };
});
vi.mock("../../apps/mobile/src/ui/ChoiceField", () => ({
  ChoiceField: ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
  }) => (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({ styles: { row: {} } }));
vi.mock("../../apps/mobile/src/screens/RecordRow", () => ({
  RecordRow: ({
    record,
    onPress,
  }: {
    record: BillRecord;
    onPress: (record: BillRecord) => void;
  }) => <button onClick={() => onPress(record)}>{record.merchant}</button>,
}));
afterEach(cleanup);

const example = createDemoLedger(),
  bank = example.accounts[0];
function bill(input: Partial<BillRecord>): BillRecord {
  return { ...example.records[0], accountId: undefined, ...input };
}
function book(
  records: BillRecord[],
  accounts: AssetAccount[] = example.accounts,
): Ledger {
  return { ...example, records, accounts };
}
describe("native account records", () => {
  it("shows legacy fixture records that already contribute to the account balance", () => {
    const open = vi.fn();
    render(
      <AccountRecordList
        ledger={example}
        account={bank}
        through="2026-10-18 23:59:59"
        onRecord={open}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "关联账单" }));
    expect(screen.getByText(/共 123 条/)).toBeTruthy();
    expect(screen.getAllByRole("button").length).toBeLessThanOrEqual(24);
    fireEvent.click(screen.getByRole("button", { name: "瑞幸咖啡" }));
    expect(open).toHaveBeenCalledWith(
      example.records.find((record) => record.id === "demo-coffee"),
    );
  });
  it("resolves names and aliases while honoring a stable ID after renaming", () => {
    const records = [
      bill({ id: "name", merchant: "旧名称账单", account: bank.name }),
      bill({ id: "alias", merchant: "别名账单", account: bank.aliases[0] }),
      bill({
        id: "stable",
        merchant: "稳定 ID 账单",
        accountId: bank.id,
        account: "更名前的名称",
      }),
    ];
    render(
      <AccountRecordList
        ledger={book(records)}
        account={bank}
        through="2026-10-18 23:59:59"
        onRecord={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "关联账单" }));
    for (const record of records)
      expect(
        screen.getByRole("button", { name: record.merchant }),
      ).toBeTruthy();
  });
  it("does not relink explicitly unassigned or deleted bills", () => {
    const records = [
      bill({ id: "keep", merchant: "保留的账单" }),
      bill({ id: "unlinked", merchant: "主动解除关联", accountId: null }),
      bill({
        id: "deleted",
        merchant: "已删除账单",
        accountId: bank.id,
        isDeleted: true,
      }),
    ];
    render(
      <AccountRecordList
        ledger={book(records)}
        account={bank}
        through="2026-10-18 23:59:59"
        onRecord={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "关联账单" }));
    expect(screen.queryByRole("button", { name: "已删除账单" })).toBeNull();
    expect(screen.queryByRole("button", { name: "主动解除关联" })).toBeNull();
    expect(screen.getByRole("button", { name: "保留的账单" })).toBeTruthy();
  });
  it("shows an empty state rather than guessing an ambiguous account label", () => {
    const accounts = [bank, { ...bank, id: "ambiguous-bank" }];
    render(
      <AccountRecordList
        ledger={book([bill({})], accounts)}
        account={bank}
        through="2026-10-18 23:59:59"
        onRecord={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "关联账单" }));
    expect(screen.getByText("所选账期暂无关联账单。")).toBeTruthy();
  });
  it("includes a transfer received by the selected account", () => {
    const transfer = bill({
      id: "received",
      merchant: "转入流水",
      kind: "转账",
      accountId: "demo-wechat",
      transferToAccountId: bank.id,
      account: "微信零钱",
    });
    render(
      <AccountRecordList
        ledger={book([transfer])}
        account={bank}
        through="2026-10-18 23:59:59"
        onRecord={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "关联账单" }));
    expect(screen.getByRole("button", { name: "转入流水" })).toBeTruthy();
  });
});

interface ReportProbeProps {
  onUnmount: () => void;
}
function ReportProbe({ onUnmount }: ReportProbeProps): React.JSX.Element {
  const [start, setStart] = useState("2026-10-01");
  const [selected, setSelected] = useState("2026-10-11");
  useEffect(() => onUnmount, [onUnmount]);
  return (
    <section>
      <input
        aria-label="开始日期"
        value={start}
        onChange={(event) => setStart(event.target.value)}
      />
      <button onClick={() => setSelected("2026-09-30")}>选择月末</button>
      <output>{selected}</output>
    </section>
  );
}
describe("native navigation session", () => {
  it("retains range and point state while hiding background input during a tool visit", () => {
    vi.mocked(Keyboard.dismiss).mockClear();
    const unmount = vi.fn();
    const view = render(
      <NavigationLayer tool={null}>
        <ReportProbe onUnmount={unmount} />
      </NavigationLayer>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "开始日期" }), {
      target: { value: "2026-09-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "选择月末" }));
    expect(Keyboard.dismiss).not.toHaveBeenCalled();
    view.rerender(
      <NavigationLayer tool={<button>记账偏好</button>}>
        <ReportProbe onUnmount={unmount} />
      </NavigationLayer>,
    );
    expect(screen.getByRole("button", { name: "记账偏好" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "开始日期" })).toBeNull();
    expect(
      screen
        .getByDisplayValue("2026-09-01")
        .closest('[data-pointer-events="none"]'),
    ).toBeTruthy();
    expect(unmount).not.toHaveBeenCalled();
    expect(Keyboard.dismiss).toHaveBeenCalledOnce();
    view.rerender(
      <NavigationLayer tool={null}>
        <ReportProbe onUnmount={unmount} />
      </NavigationLayer>,
    );
    expect(screen.getByRole("textbox", { name: "开始日期" })).toBe(
      screen.getByDisplayValue("2026-09-01"),
    );
    expect(screen.getByText("2026-09-30")).toBeTruthy();
    expect(unmount).not.toHaveBeenCalled();
  });
});
