import {
  type DaisyTheme,
  type ThemeChoice,
  themeService,
} from "@/services/themeService";
import { useCallback, useEffect, useState } from "react";
import { useTimeBasedTheme } from "./useTimeBasedTheme";

export type { ThemeChoice } from "@/services/themeService";

export function useTheme() {
  const [themeChoice, setThemeChoiceState] = useState<ThemeChoice>(() =>
    themeService.getStoredThemeChoice(),
  );
  const [theme, setTheme] = useState<DaisyTheme>(() => {
    const resolved = themeService.resolveTheme(
      themeService.getStoredThemeChoice(),
    );
    themeService.applyTheme(resolved);
    return resolved;
  });
  const { timeBasedTheme } = useTimeBasedTheme();

  const setThemeChoice = useCallback((choice: ThemeChoice) => {
    const resolved = themeService.setThemeChoice(choice);
    setThemeChoiceState(choice);
    setTheme(resolved);
  }, []);

  useEffect(() => {
    if (themeChoice !== "system") return;

    if (!themeService.canDetectSystemTheme()) {
      themeService.applyTheme(timeBasedTheme);
      setTheme(timeBasedTheme);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      const nextTheme: DaisyTheme = event.matches ? "black" : "lofi";
      themeService.applyTheme(nextTheme);
      setTheme(nextTheme);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeChoice, timeBasedTheme]);

  return { theme, themeChoice, setThemeChoice };
}
