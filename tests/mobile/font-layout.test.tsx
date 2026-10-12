// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Screen } from "../../apps/mobile/src/ui/Screen";

const metrics = vi.hoisted(() => ({ fontScale: 1 }));
const listeners = vi.hoisted(() => new Set<(value: unknown) => void>());
vi.mock("react-native", () => ({
  DeviceEventEmitter: {
    addListener: (_name: string, listener: (value: unknown) => void) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  },
  useWindowDimensions: () => metrics,
  Platform: { OS: "android" },
  KeyboardAvoidingView: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  ScrollView: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
  StyleSheet: { create: <Styles,>(styles: Styles): Styles => styles },
}));
vi.mock("react-native-paper", () => ({
  Text: () => null,
  HelperText: () => null,
}));
afterEach(() => {
  act(() => listeners.forEach((listener) => listener(1)));
  cleanup();
  metrics.fontScale = 1;
});

function DraftProbe(): React.JSX.Element {
  const [name, setName] = useState("");
  return (
    <Screen>
      <input
        aria-label="账单草稿"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
    </Screen>
  );
}
describe("native font layout refresh", () => {
  it("refreshes from the native configuration even when Dimensions retains its old font scale", () => {
    render(<DraftProbe />);
    const original = screen.getByRole("textbox");
    fireEvent.change(original, { target: { value: "PLAN-NATIVE-FONT" } });
    act(() => listeners.forEach((listener) => listener(1.3)));
    expect(screen.getByRole("textbox")).not.toBe(original);
    expect(screen.getByDisplayValue("PLAN-NATIVE-FONT")).toBeTruthy();
  });
  it("uses the last native scale in a newly opened form before the scale changes back", () => {
    const view = render(<Screen>Existing page</Screen>);
    act(() => listeners.forEach((listener) => listener(1.3)));
    view.rerender(<DraftProbe />);
    const original = screen.getByRole("textbox");
    fireEvent.change(original, { target: { value: "PLAN-LATE-FORM" } });
    act(() => listeners.forEach((listener) => listener(1)));
    expect(screen.getByRole("textbox")).not.toBe(original);
    expect(screen.getByDisplayValue("PLAN-LATE-FORM")).toBeTruthy();
  });
  it("keeps the same input and focus during ordinary rerenders", () => {
    const view = render(<DraftProbe />),
      original = screen.getByRole("textbox");
    original.focus();
    view.rerender(<DraftProbe />);
    expect(screen.getByRole("textbox")).toBe(original);
    expect(document.activeElement).toBe(original);
  });
  it("ignores invalid native scales and releases the native subscription on unmount", () => {
    const view = render(<DraftProbe />),
      original = screen.getByRole("textbox");
    act(() => {
      for (const invalid of [0, -1, NaN, Infinity, "1.3"])
        listeners.forEach((listener) => listener(invalid));
    });
    expect(screen.getByRole("textbox")).toBe(original);
    view.unmount();
    expect(listeners.size).toBe(0);
  });
});
