// @vitest-environment jsdom
import { paymentUiFixture } from "./payment-ui-fixture";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { confirmPaymentNotification, type Book } from "@hamster-ledger/core";
import type {
  PaymentInboxConfig,
  PaymentInboxStatus,
} from "../../apps/mobile/src/platform/payment-inbox";
import type { PaymentInboxController } from "../../apps/mobile/src/hooks/usePaymentInbox";
import { PaymentInboxSettings } from "../../apps/mobile/src/screens/PaymentInboxSettings";
import { PaymentReceiptRecovery } from "../../apps/mobile/src/screens/PaymentReceiptRecovery";
vi.mock("../../apps/mobile/modules/payment-inbox", () => ({ default: null }));
vi.mock("react-native-paper", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onPress,
    disabled,
  }: {
    children: ReactNode;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
  Switch: ({
    value,
    onValueChange,
    disabled,
    accessibilityLabel,
  }: {
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
    accessibilityLabel: string;
  }) => (
    <input
      role="switch"
      type="checkbox"
      aria-label={accessibilityLabel}
      checked={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.checked)}
    />
  ),
  Checkbox: {
    Item: ({
      label,
      status,
      onPress,
      disabled,
    }: {
      label: string;
      status: string;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <button
        role="checkbox"
        aria-checked={status === "checked"}
        disabled={disabled}
        onClick={onPress}
      >
        {label}
      </button>
    ),
  },
  List: {
    Item: ({ title, right }: { title: string; right: () => ReactNode }) => (
      <div>
        {title}
        {right()}
      </div>
    ),
  },
}));
vi.mock("../../apps/mobile/src/ui/ChoiceField", () => ({
  ChoiceField: ({
    label,
    value,
    options,
    onChange,
    disabled,
  }: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">请选择</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ title, children }: { title: string; children: ReactNode }) => (
    <section role="dialog" aria-label={title}>
      {children}
    </section>
  ),
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  ErrorMessage: ({ message }: { message: string }) => (
    <span role="alert">{message}</span>
  ),
}));
afterEach(cleanup);
const status: PaymentInboxStatus = {
  available: true,
  enabled: false,
  bookId: "",
  sources: [],
  permissionGranted: false,
  connected: false,
  pendingCount: 0,
  error: "",
};
const books: Book[] = [
  { id: "demo", name: "示例账本" },
  { id: "personal", name: "我的账本" },
  { id: "book:archived", name: "归档账本", isArchived: true },
  {
    id: "book:network",
    name: "联网账本",
    cloud: {
      id: "server-book",
      server: "https://synthetic.example",
      userId: "user",
      role: "owner",
    },
  },
];
describe("payment inbox consent and recovery UI", () => {
  it("starts off, never saves on mount, and excludes demo, archived and network targets", () => {
    const save = vi.fn();
    render(
      <PaymentInboxSettings
        value={{ enabled: false, bookId: "", sources: [] }}
        onChange={() => {}}
        status={status}
        books={books}
        isBusy={false}
        isLoading={false}
        onSave={save}
        onSettings={() => {}}
        onRefresh={() => {}}
        onClear={() => {}}
      />,
    );
    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(
      false,
    );
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "我的账本" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "示例账本" })).toBeNull();
    expect(screen.queryByRole("option", { name: "归档账本" })).toBeNull();
    expect(screen.queryByRole("option", { name: "联网账本" })).toBeNull();
  });
  it("requires an explicit settings save after choosing sources and a local target", () => {
    const save = vi.fn();
    function Harness() {
      const [value, setValue] = useState<PaymentInboxConfig>({
        enabled: false,
        bookId: "",
        sources: [],
      });
      return (
        <PaymentInboxSettings
          value={value}
          onChange={setValue}
          status={status}
          books={books}
          isBusy={false}
          isLoading={false}
          onSave={() => save(value)}
          onSettings={() => {}}
          onRefresh={() => {}}
          onClear={() => {}}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("checkbox", { name: "采集微信支付通知" }));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "personal" },
    });
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "保存采集设置" }));
    expect(save).toHaveBeenCalledWith({
      enabled: true,
      bookId: "personal",
      sources: ["微信支付"],
    });
  });
  it("saved-but-unacknowledged records expose only a status recovery action", async () => {
    const { receipt, ledger, entry } = paymentUiFixture();
    const saved = confirmPaymentNotification({ ledger, receipt, entry }),
      close = vi.fn(),
      link = vi.fn(async () => true),
      confirm = vi.fn(async () => {});
    const inbox: PaymentInboxController = {
      status,
      receipts: [receipt],
      error: "消息状态更新失败",
      isLoading: false,
      isBusy: false,
      refresh: async () => {},
      configure: async () => true,
      openSettings: async () => {},
      clear: async () => true,
      discard: async () => true,
      confirm,
      link,
    };
    render(
      <PaymentReceiptRecovery
        record={saved.records[0]}
        receipt={receipt}
        inbox={inbox}
        onClose={close}
      />,
    );
    expect(screen.getByText("账单已保存，消息状态尚未更新。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "完成消息状态更新" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(link).toHaveBeenCalledWith({
      receipt,
      recordId: saved.records[0].id,
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(saved.records).toHaveLength(1);
  });
});
