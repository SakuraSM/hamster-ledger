const DATE_KEY_LENGTH = 10;
const TIME_START_INDEX = 11;
const TIME_END_INDEX = 16;
import { useMantineColorScheme } from "@mantine/core";
import { useEffect } from "react";
import { DEFAULT_PREFERENCES, type Ledger } from "@hamster-ledger/core";
import { localNow } from "../platform/browser/runtime";
const REMINDER_INTERVAL_MS = 30000;
export function usePreferences(input: {
  ledger: Ledger;
  mode: string;
  notify: (message: string) => void;
}): void {
  const { setColorScheme } = useMantineColorScheme();
  const preferences = input.ledger.preferences ?? DEFAULT_PREFERENCES;
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    setColorScheme(preferences.theme === "night" ? "dark" : "light");
  }, [preferences.theme, setColorScheme]);
  useEffect(() => {
    if (!preferences.reminderEnabled) return;
    let reminded = "";
    const check = (): void => {
      const now = localNow();
      const key = `hamster-reminder.${input.mode}.${now.slice(0, DATE_KEY_LENGTH)}`;
      if (
        document.visibilityState === "visible" &&
        now.slice(TIME_START_INDEX, TIME_END_INDEX) >=
          preferences.reminderTime &&
        reminded !== key
      ) {
        try {
          if (sessionStorage.getItem(key)) return;
          sessionStorage.setItem(key, "1");
        } catch {
          /* In-memory marker still prevents repeats in this tab. */
        }
        reminded = key;
        input.notify("到记账时间了，今天的收支记好了吗？");
      }
    };
    check();
    const timer = setInterval(check, REMINDER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [
    preferences.reminderEnabled,
    preferences.reminderTime,
    input.mode,
    input.notify,
  ]);
}
