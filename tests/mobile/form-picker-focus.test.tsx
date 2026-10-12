// @vitest-environment jsdom
import { Fragment, type ReactNode } from "react";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChoiceField } from "../../apps/mobile/src/ui/ChoiceField";
import { DateField } from "../../apps/mobile/src/ui/DateField";

interface Option {
  value: string;
  label: string;
}
interface ButtonAdapterProps {
  children: ReactNode;
  accessibilityLabel?: string;
  onPress: () => void;
}
vi.mock("react-native", () => ({
  Keyboard: {
    dismiss: () => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    },
  },
  FlatList: ({
    data,
    renderItem,
  }: {
    data: Option[];
    renderItem: (input: { item: Option }) => ReactNode;
  }) => (
    <>
      {data.map((item) => (
        <Fragment key={item.value}>{renderItem({ item })}</Fragment>
      ))}
    </>
  ),
}));
vi.mock("react-native-paper", () => ({
  Button: (props: ButtonAdapterProps) => (
    <button aria-label={props.accessibilityLabel} onClick={props.onPress}>
      {props.children}
    </button>
  ),
  Searchbar: (props: {
    value: string;
    accessibilityLabel: string;
    onChangeText: (value: string) => void;
  }) => (
    <input
      aria-label={props.accessibilityLabel}
      value={props.value}
      onChange={(event) => props.onChangeText(event.target.value)}
    />
  ),
  RadioButton: {
    Item: (props: { label: string; status: string; onPress: () => void }) => (
      <input
        type="radio"
        aria-label={props.label}
        checked={props.status === "checked"}
        onChange={props.onPress}
      />
    ),
  },
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ title, children }: { title: string; children: ReactNode }) => (
    <section role="dialog" aria-label={title}>
      {children}
    </section>
  ),
}));
vi.mock("../../apps/mobile/src/platform/runtime", () => ({
  localNow: () => "2026-10-12 12:00:00",
}));
vi.mock("@react-native-community/datetimepicker", () => ({
  DateTimePickerAndroid: { open: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("native form picker focus", () => {
  it("blurs the background draft before opening searchable choices", () => {
    const choose = vi.fn();
    render(
      <>
        <input aria-label="账户名称" defaultValue="PLAN-FOCUS" />
        <ChoiceField
          label="账户类别"
          value="bank"
          onChange={choose}
          options={[
            { value: "bank", label: "银行卡" },
            { value: "cash", label: "现金" },
          ]}
        />
      </>,
    );
    const draft = screen.getByRole("textbox", { name: "账户名称" });
    draft.focus();
    fireEvent.click(screen.getByRole("button", { name: "账户类别：银行卡" }));
    expect(document.activeElement).not.toBe(draft);
    expect(screen.getByDisplayValue("PLAN-FOCUS")).toBe(draft);
    fireEvent.change(screen.getByRole("textbox", { name: "搜索选项" }), {
      target: { value: "现金" },
    });
    expect(screen.queryByRole("radio", { name: "银行卡" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "现金" }));
    expect(choose).toHaveBeenCalledWith("cash");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("blurs the background draft and preserves the date when the native picker is canceled", () => {
    const change = vi.fn();
    render(
      <>
        <input aria-label="账户名称" defaultValue="PLAN-FOCUS" />
        <DateField label="余额确认时间" value="2026-10-12" onChange={change} />
      </>,
    );
    const draft = screen.getByRole("textbox", { name: "账户名称" });
    draft.focus();
    fireEvent.click(
      screen.getByRole("button", { name: "余额确认时间：2026-10-12" }),
    );
    expect(document.activeElement).not.toBe(draft);
    const options = vi.mocked(DateTimePickerAndroid.open).mock.calls[0][0];
    options.onChange?.(
      { type: "dismissed", nativeEvent: { timestamp: 0, utcOffset: 0 } },
      undefined,
    );
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("PLAN-FOCUS")).toBe(draft);
  });
});
