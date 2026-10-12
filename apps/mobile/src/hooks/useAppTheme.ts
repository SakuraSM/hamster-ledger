import { useMemo } from "react";
import type { LedgerPreferences } from "@hamster-ledger/core";
import type { MD3Theme } from "react-native-paper";
import tokens from "@hamster-ledger/design-tokens/tokens.json";
import { ledgerTheme } from "../ui/theme";
export function useAppTheme({
  themeName,
  hasReducedMotion,
}: {
  themeName?: LedgerPreferences["theme"];
  hasReducedMotion: boolean;
}): MD3Theme {
  return useMemo(() => {
    const theme = ledgerTheme(themeName === "night");
    if (themeName === "sage") theme.colors.primary = tokens.color.positive;
    theme.animation.scale = hasReducedMotion ? 0 : 1;
    return theme;
  }, [themeName, hasReducedMotion]);
}
