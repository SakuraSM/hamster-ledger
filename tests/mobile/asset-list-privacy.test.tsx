// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { AssetAccountList } from "../../apps/mobile/src/screens/AssetAccountList";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
    hairlineWidth: 1,
  },
}));
vi.mock("react-native-paper", () => ({
  useTheme: () => ({
    colors: { onSurfaceVariant: "#555", outlineVariant: "#ccc" },
  }),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    label,
    value,
    onChangeText,
  }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
  }) => (
    <label>
      {label}
      <input
        value={value}
        onChange={(event) => onChangeText(event.currentTarget.value)}
      />
    </label>
  ),
  Checkbox: {
    Item: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <button onClick={onPress}>{label}</button>
    ),
  },
  List: {
    Item: ({
      title,
      description,
      accessibilityLabel,
      onPress,
      right,
    }: {
      title: string;
      description: string;
      accessibilityLabel: string;
      onPress: () => void;
      right: () => ReactNode;
    }) => (
      <button aria-label={accessibilityLabel} onClick={onPress}>
        {title} {description} {right()}
      </button>
    ),
    Icon: () => null,
  },
}));
afterEach(cleanup);
it("masks amount-bearing account names, values and movement direction without losing account selection", () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "prepaid",
    name: "卡 8.88",
    kind: "liability" as const,
    type: "信用卡" as const,
    openingBalance: -888,
    balanceAt: "2026-01-01 00:00:00",
    aliases: [],
    checkpoints: [],
  };
  const ledger = { ...example, records: [], accounts: [account] };
  const onSelect = vi.fn();
  const view = render(
    <AssetAccountList
      ledger={ledger}
      through="2026-11-06 23:59:59"
      changes={{ prepaid: 888 }}
      isAmountHidden
      onSelect={onSelect}
    />,
  );
  expect(view.container.textContent).not.toContain("8.88");
  expect(view.container.textContent).not.toContain("+••••");
  expect(view.container.textContent).not.toContain("预存");
  expect(view.container.querySelector('[aria-label*="8.88"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /负债账户 1/ }));
  expect(onSelect).toHaveBeenCalledWith("prepaid");
});
