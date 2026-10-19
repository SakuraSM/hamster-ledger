// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createStatement,
  parseStatement,
  type StatementFile,
} from "@hamster-ledger/importers";
import { StatementMapping } from "../../apps/mobile/src/screens/StatementMapping";
vi.mock("../../apps/mobile/src/platform/storage", () => ({
  nativeStore: { getItem: async () => null, setItem: async () => {} },
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => (
    <section role="dialog">{children}</section>
  ),
}));
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
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));
vi.mock("react-native-paper", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  HelperText: ({ children }: { children: ReactNode }) => (
    <span role="alert">{children}</span>
  ),
  TextInput: ({
    label,
    value,
    onChangeText,
  }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
  }) => (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChangeText(event.target.value)}
    />
  ),
  Button: ({
    children,
    disabled,
    onPress,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onPress: () => void;
  }) => (
    <button disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
afterEach(cleanup);
function initial(): StatementFile {
  return createStatement({
    name: "alipay-qa.csv",
    hash: "mapping-qa",
    rows: [
      ["交易时间", "交易对方", "金额", "收/支"],
      ["2026-10-01 12:00:00", "合成午餐", "12.34", "支出"],
      ["2026-10-02 12:00:00", "合成交通", "5.60", "支出"],
    ],
  });
}
function Harness({
  file: initialFile,
}: {
  file: StatementFile;
}): React.JSX.Element {
  const [file, setFile] = useState(initialFile);
  return (
    <StatementMapping
      file={file}
      preview={parseStatement(file, {})}
      onChange={setFile}
      onClose={vi.fn()}
    />
  );
}
it("shows why rows fail and reparses when the date mapping is corrected", () => {
  const file = initial();
  render(<Harness file={{ ...file, mapping: { ...file.mapping, date: 1 } }} />);
  expect(screen.getByText("当前映射可解析 0 条流水")).toBeTruthy();
  expect(screen.getByText(/第 2 行：交易日期缺失或格式错误/)).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "交易时间" }), {
    target: { value: "0" },
  });
  expect(screen.getByText("当前映射可解析 2 条流水")).toBeTruthy();
  expect(screen.queryByText(/交易日期缺失或格式错误/)).toBeNull();
});
it("updates the live count after unsetting and reselecting the amount column", () => {
  render(<Harness file={initial()} />);
  fireEvent.change(screen.getByRole("combobox", { name: "金额" }), {
    target: { value: "" },
  });
  expect(screen.getByText("当前映射可解析 0 条流水")).toBeTruthy();
  expect(
    screen.getAllByText("请设置交易时间和金额字段。").length,
  ).toBeGreaterThan(0);
  fireEvent.change(screen.getByRole("combobox", { name: "金额" }), {
    target: { value: "2" },
  });
  expect(screen.getByText("当前映射可解析 2 条流水")).toBeTruthy();
  expect(screen.queryByText("请设置交易时间和金额字段。")).toBeNull();
});
it("explains an empty suffix and recovers after applying the real header row", () => {
  const file = initial();
  render(<Harness file={{ ...file, headerIndex: file.rows.length - 1 }} />);
  expect(screen.getByText(/表头之后没有可识别的交易明细/)).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "表头所在行" }), {
    target: { value: "1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "应用表头行" }));
  expect(screen.getByText("当前映射可解析 2 条流水")).toBeTruthy();
  expect(screen.queryByText(/表头之后没有可识别的交易明细/)).toBeNull();
});
