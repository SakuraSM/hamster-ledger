// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { useTheme } from "react-native-paper";
import { useAppTheme } from "../../apps/mobile/src/hooks/useAppTheme";
import { LedgerProvider } from "../../apps/mobile/src/ui/LedgerProvider";
vi.mock("../../apps/mobile/src/ui/Icons", () => ({ iconSettings: {} }));
vi.mock("react-native-paper", async () => {
  const { createContext, useContext } = await import("react");
  const context = createContext<{ animation: { scale: number } } | null>(null);
  interface ProviderProps {
    theme: { animation: { scale: number } };
    children: ReactNode;
  }
  return {
    MD3LightTheme: {
      colors: {},
      animation: { scale: 1 },
      dark: false,
      version: 3,
      isV3: true,
    },
    MD3DarkTheme: {
      colors: {},
      animation: { scale: 1 },
      dark: true,
      version: 3,
      isV3: true,
    },
    PaperProvider: ({ theme, children }: ProviderProps) => (
      <context.Provider value={{ ...theme, animation: { scale: 1 } }}>
        {children}
      </context.Provider>
    ),
    ThemeProvider: ({ theme, children }: ProviderProps) => (
      <context.Provider value={theme}>{children}</context.Provider>
    ),
    useTheme: () => {
      const theme = useContext(context);
      if (!theme) throw new Error("missing provider");
      return theme;
    },
  };
});
afterEach(cleanup);
it("retains the theme identity across unrelated navigation renders", () => {
  const { result, rerender } = renderHook(() =>
    useAppTheme({ themeName: "warm", hasReducedMotion: false }),
  );
  const original = result.current;
  rerender();
  expect(result.current).toBe(original);
});
it("updates actual theme preferences without mutating earlier themes", () => {
  const { result, rerender } = renderHook(
    ({ isReduced }: { isReduced: boolean }) =>
      useAppTheme({ themeName: "night", hasReducedMotion: isReduced }),
    { initialProps: { isReduced: false } },
  );
  const original = result.current;
  rerender({ isReduced: true });
  expect(result.current).not.toBe(original);
  expect(result.current.animation.scale).toBe(0);
  expect(original.animation.scale).toBe(1);
  expect(result.current.dark).toBe(true);
});
it("preserves reduced motion for Paper consumers despite the outer provider default", () => {
  function Scale(): React.JSX.Element {
    return <span>scale:{useTheme().animation.scale}</span>;
  }
  function App(): React.JSX.Element {
    const theme = useAppTheme({ themeName: "warm", hasReducedMotion: true });
    return (
      <LedgerProvider theme={theme}>
        <Scale />
      </LedgerProvider>
    );
  }
  render(<App />);
  expect(screen.getByText("scale:0")).toBeTruthy();
});
