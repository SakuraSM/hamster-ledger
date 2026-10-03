import type { ReactNode } from "react";
import { createTheme, MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import tokens from "@hamster-ledger/design-tokens/tokens.json";
import "dayjs/locale/zh-cn";

const SUNDAY = 0;
const SATURDAY = 6;
export const ledgerTheme = createTheme({
  primaryColor: "hamster",
  primaryShade: 6,
  colors: {
    hamster: [
      "#fff4e8",
      "#f9e7d4",
      "#f1cdac",
      "#e5ad80",
      "#d58b59",
      "#c16b3e",
      tokens.color.primary,
      tokens.color.primaryHover,
      "#76391d",
      "#60301b",
    ],
  },
  defaultRadius: tokens.radius.control,
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
  respectReducedMotion: true,
  focusRing: "auto",
  components: {
    Input: { defaultProps: { size: "md" } },
    Button: { defaultProps: { size: "md" } },
    Select: {
      defaultProps: {
        size: "md",
        nothingFoundMessage: "没有匹配的选项",
        comboboxProps: {
          transitionProps: { transition: "pop", duration: 130 },
        },
      },
    },
    Modal: {
      defaultProps: {
        centered: true,
        overlayProps: { backgroundOpacity: 0.3, blur: 3 },
        transitionProps: { transition: "pop", duration: 160 },
      },
    },
  },
});

export function LedgerUIProvider({
  children,
  test = false,
}: {
  children: ReactNode;
  test?: boolean;
}): React.JSX.Element {
  return (
    <MantineProvider
      theme={ledgerTheme}
      env={test ? "test" : "default"}
      defaultColorScheme="light"
    >
      <DatesProvider
        settings={{
          locale: "zh-cn",
          firstDayOfWeek: 1,
          weekendDays: [SUNDAY, SATURDAY],
        }}
      >
        {children}
      </DatesProvider>
    </MantineProvider>
  );
}
