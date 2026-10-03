import { MD3LightTheme, MD3DarkTheme, type MD3Theme } from "react-native-paper";
import tokens from "@hamster-ledger/design-tokens/tokens.json";
export function ledgerTheme(isDark: boolean): MD3Theme {
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    roundness: 3,
    colors: {
      ...base.colors,
      primary: isDark ? "#f0b38e" : tokens.color.primary,
      onPrimary: isDark ? "#39291f" : "#ffffff",
      primaryContainer: isDark ? "#64432d" : tokens.color.selected,
      onPrimaryContainer: isDark ? "#ffe2ce" : tokens.color.text,
      secondary: isDark ? "#cbb7a7" : tokens.color.muted,
      background: isDark ? "#201b17" : tokens.color.canvas,
      surface: isDark ? "#28221d" : tokens.color.canvas,
      surfaceVariant: isDark ? "#44382f" : tokens.color.sidebar,
      onSurface: isDark ? "#f3e4d5" : tokens.color.text,
      secondaryContainer: isDark ? "#493a2e" : tokens.color.selected,
      onSecondaryContainer: isDark ? "#f3e4d5" : tokens.color.text,
      tertiary: isDark ? "#b9c9a8" : tokens.color.positive,
      tertiaryContainer: isDark ? "#34442f" : "#e7eee0",
      onTertiaryContainer: isDark ? "#e7eee0" : "#263b20",
      elevation: {
        level0: "transparent",
        level1: isDark ? "#28221d" : "#fbf5ed",
        level2: isDark ? "#30271f" : "#f6f0e7",
        level3: isDark ? "#34291f" : "#f5ecdf",
        level4: isDark ? "#392c21" : "#f3e8d8",
        level5: isDark ? "#3e2f23" : "#f0e4d2",
      },
      outlineVariant: isDark ? "#574536" : tokens.color.divider,
    },
  };
}
