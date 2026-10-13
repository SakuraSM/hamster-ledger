import type { ReactNode } from "react";
import {
  PaperProvider,
  ThemeProvider,
  type MD3Theme,
} from "react-native-paper";
import { iconSettings } from "./Icons";
export function LedgerProvider({
  theme,
  children,
}: {
  theme: MD3Theme;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <PaperProvider theme={theme} settings={iconSettings}>
      {/* PaperProvider otherwise replaces a custom animation.scale with its own default. */}
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </PaperProvider>
  );
}
